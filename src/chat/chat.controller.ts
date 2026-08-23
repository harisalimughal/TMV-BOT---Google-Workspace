import { DateTime } from "luxon";
import {
  ChatResponse, ChatResult, createResponse, errorResponse, evidenceFailedCard, evidencePendingCard, helpCard,
  jobCard, mainMenuCard, noJobsCard, photoAckCard, renderScenarioStep, updateResponse, workflowCard
} from "./cards";
import { parseCommand } from "./commands";
import { getActiveJobForDriver, getNextJobForDriver } from "../jobs/jobs.service";
import {
  CUSTOMER_CONFIRMATION_TEXT, EvidenceFailedError, EvidencePendingError, handleAction, handlePhotoStep,
  reopenPhotoStep, retryFailedEvidence
} from "../workflow/workflow.engine";
import { ValidationError } from "../workflow/validation.engine";
import { PHOTO_STATES, WorkflowState } from "../workflow/workflow.states";
import { PermanentTaskError } from "../queue/queue.types";
import { ChatAttachment, EvidenceType } from "../jobs/job.types";
import { setContext, log } from "../utils/logger";
import { PhaseTimer } from "../utils/timing";
import { eventKeyFor, runOnce } from "./replay.guard";
import { ScenarioKey, SCENARIOS } from "./scenario.spec";
import {
  acknowledgeScenarioNotice, continueFromScenarioPhotos, describeStep, isPhotosStep, receiveScenarioPhoto,
  resolveOrStartScenario, submitScenarioField
} from "./scenario.engine";
import {
  commitWrites, getJob, getScenarioProgress, getSetting, listScenarioProgressForJob, pendingSignatureWrite
} from "../google/sheets";

export interface GoogleChatEvent {
  type?: string;
  eventTime?: string;
  user?: { name?: string; email?: string; displayName?: string };
  message?: {
    name?: string;
    text?: string;
    argumentText?: string;
    attachment?: ChatAttachment[];
    attachments?: ChatAttachment[];
  };
  action?: {
    function?: string;
    actionMethodName?: string;
    parameters?: Array<{ key?: string; value?: string }>;
  };
  common?: { formInputs?: Record<string, any> };
  commonEventObject?: { formInputs?: Record<string, any> };
  appCommandMetadata?: Record<string, unknown>;
}

function identifier(event: GoogleChatEvent): string {
  return event.user?.email?.trim() || event.user?.name?.trim() || "";
}

function actionName(event: GoogleChatEvent): string {
  return event.action?.function || event.action?.actionMethodName || "";
}

function actionParam(event: GoogleChatEvent, key: string): string {
  return event.action?.parameters?.find(p => p.key === key)?.value || "";
}

function formInputs(event: GoogleChatEvent): Record<string, string[]> {
  const source = event.common?.formInputs || event.commonEventObject?.formInputs || {};
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(source)) {
    const strings = value?.stringInputs?.value;
    if (Array.isArray(strings)) {
      result[key] = strings.map(String);
      continue;
    }
    // A dateTimePicker (DATE_ONLY) field's submission comes back shaped completely
    // differently from every other widget -- a millisecond epoch for UTC midnight of
    // the chosen calendar date, not a string. Read with the UTC zone so e.g. a driver
    // west of Greenwich picking "15 Aug" doesn't get shifted back to "14 Aug" by a
    // local-timezone conversion.
    const dateMs = value?.dateInput?.msSinceEpoch ?? value?.dateTimeInput?.msSinceEpoch;
    if (dateMs !== undefined && dateMs !== null && dateMs !== "") {
      result[key] = [DateTime.fromMillis(Number(dateMs), { zone: "utc" }).toFormat("dd/MM/yyyy")];
    }
  }
  return result;
}

function attachments(event: GoogleChatEvent): ChatAttachment[] {
  return event.message?.attachment ?? event.message?.attachments ?? [];
}

/**
 * "Next Job" — resumes the classic Start Job workflow wherever the driver left off
 * (or shows the job summary card with a Start Job button if it hasn't been started),
 * exactly as this worked before the menu existed. This is separate from the menu:
 * Check In / Check Out / Parking Liability / Liability Report / Finish Job are all
 * reachable independently of this, whether or not Start Job's workflow is mid-flight.
 */
async function showCurrentOrNext(event: GoogleChatEvent, confirmationText: string, sync = false): Promise<ChatResponse> {
  // Only the "jobs" command and APP_COMMAND need fresh Calendar data. Resuming an
  // existing job does not — the job is already in Sheets.
  const { job } = await getNextJobForDriver(identifier(event), { sync });
  if (!job) return noJobsCard();
  setContext({ jobId: job.jobId });
  return job.status === "IN_PROGRESS" ? workflowCard(job, confirmationText) : jobCard(job);
}

/**
 * Shared by every MENU_* click: fresh-reads the driver's active or next job and runs
 * the requested scenario against it directly. Deliberately does NOT start the job
 * first — Check In, Check Out, Parking Liability and Liability Report are independent,
 * standalone flows that never require Start Job's classic workflow to have run at all.
 */
async function withActiveJob(
  event: GoogleChatEvent,
  run: (job: NonNullable<Awaited<ReturnType<typeof getActiveJobForDriver>>["job"]>) => Promise<ChatResponse>
): Promise<ChatResponse> {
  const { job } = await getActiveJobForDriver(identifier(event));
  if (!job) return noJobsCard();
  return run(job);
}

/**
 * Menu tap for a scenario: resumes it if the driver already has it in progress,
 * otherwise starts fresh, then renders whatever card that position calls for — the
 * bot asks one field at a time in Chat itself now, matching the classic workflow's
 * pattern, instead of opening a bundled web form (see chat/scenario.engine.ts).
 */
function scenarioMenuAction(scenario: ScenarioKey) {
  return async (event: GoogleChatEvent): Promise<ChatResponse> =>
    withActiveJob(event, async job => {
      const spec = SCENARIOS[scenario];
      const progress = await resolveOrStartScenario(scenario, job.jobId, identifier(event), event.message?.name ?? "");
      const step = await describeStep(spec, progress);
      return renderScenarioStep(spec, scenario, job.jobId, step);
    });
}

export async function handleChatEvent(event: GoogleChatEvent): Promise<ChatResult> {
  const isClick = event.type === "CARD_CLICKED";
  const timer = new PhaseTimer();
  setContext({ userEmail: identifier(event) || undefined });

  try {
    // Admin-editable via /admin (Settings tab) — cached, so this is a Sheets read only
    // once every few minutes, not on every interaction.
    const confirmationText = await getSetting("CUSTOMER_CONFIRMATION_TEXT", CUSTOMER_CONFIRMATION_TEXT);

    switch (event.type) {
      case "ADDED_TO_SPACE": {
        const { job } = await getNextJobForDriver(identifier(event));
        return createResponse(mainMenuCard(job));
      }

      case "MESSAGE": {
        const files = attachments(event);
        if (files.length) {
          // Replay guard: Chat redelivers a message event when the endpoint misses the
          // deadline. Without this, the redelivery is judged against the state the
          // first delivery already advanced to, and files the photo as the wrong
          // evidence type.
          const eventKey = eventKeyFor({
            messageName: event.message?.name,
            resourceNames: files
              .map(f => f.attachmentDataRef?.resourceName)
              .filter((v): v is string => Boolean(v))
          });

          // A photo belongs to whichever the driver's active job is actually waiting
          // on: a scenario mid-flight (Check In/Check Out/Parking Liability/Liability
          // Report), or the classic Start Job workflow's own photo steps. At most one
          // scenario is normally "waiting on a photo" at a time; if more than one
          // somehow is, the most recently touched one wins.
          const { job: activeJob, driver } = await getActiveJobForDriver(identifier(event));
          const scenarioProgressList = activeJob ? await listScenarioProgressForJob(activeJob.jobId, 0) : [];
          const scenarioWaiting = scenarioProgressList.find(p => isPhotosStep(p.step));
          const classicWaiting = Boolean(activeJob && PHOTO_STATES.has(activeJob.currentState as WorkflowState));
          // Neither actually wants this photo (it moved past its own photo step already,
          // e.g. via the auto-advance above, or a redelivery arriving after the fact) --
          // rather than falling through to the classic flow's "not expecting a photo"
          // error, which has nothing to do with a stray send here, just show wherever
          // this scenario actually is now. receiveScenarioPhoto() already renders that
          // gracefully for a non-photos-step progress record, with no write attempted.
          const scenarioTarget = scenarioWaiting ??
            (!classicWaiting ? scenarioProgressList.find(p => p.step !== "done") : undefined);

          if (activeJob && scenarioTarget) {
            const scenario = scenarioTarget.scenario as ScenarioKey;
            const spec = SCENARIOS[scenario];
            return await runOnce(
              eventKey,
              { jobId: activeJob.jobId },
              async () => {
                // receiveScenarioPhoto never blocks: a stray/duplicate photo (redelivery,
                // or one sent out of habit) always resolves to a legitimate current card
                // rather than a dead-end error, and auto-advances once the max is reached
                // -- for Check In/Check Out (photoMin === photoMax === 1) that's every
                // time, so there's never a manual CONTINUE to tap there. Parking
                // Liability/Liability Report still show it, since a driver there can
                // genuinely choose to send more before continuing.
                const messageName = event.message?.name ?? scenarioTarget.messageName;
                const progress = await receiveScenarioPhoto(
                  scenario, activeJob, driver.email || driver.chatUserName, files, messageName
                );
                timer.mark("photo_accept");
                log.info("scenario photo accepted", { job_id: activeJob.jobId, scenario, step: progress.step, ...timer.fields() });
                const step = await describeStep(spec, progress);
                return {
                  result: createResponse(renderScenarioStep(spec, scenario, activeJob.jobId, step)),
                  outcomeState: progress.step,
                  jobId: activeJob.jobId
                };
              },
              async replay => {
                // Show the current real state, not a snapshot from before the retry --
                // re-read rather than fabricate, so startedAt (and thus the photo count)
                // reflects the real attempt, not a synthetic stand-in.
                const current = await getScenarioProgress(replay.jobId, scenario, 0);
                const step = current
                  ? await describeStep(spec, current)
                  : ({ kind: "photos", received: 0 } as const);
                return createResponse(renderScenarioStep(spec, scenario, replay.jobId, step));
              }
            );
          }

          return await runOnce(
            eventKey,
            {},
            async () => {
              // Fast path: validate, persist evidence as RECEIVED, advance state,
              // enqueue. No Drive call happens before this response is written.
              const { job, accepted, degraded } = await handlePhotoStep(identifier(event), files);
              timer.mark("photo_accept");
              log.info("photo accepted", {
                job_id: job.jobId,
                photos: accepted.length,
                degraded,
                ...timer.fields()
              });
              return {
                result: createResponse(photoAckCard(job, accepted, workflowCard(job, confirmationText))),
                outcomeState: job.currentState,
                jobId: job.jobId
              };
            },
            async replay => {
              // Show the card the original delivery produced, not an out-of-order error.
              const job = replay.jobId ? await getJob(replay.jobId) : null;
              return createResponse(job ? workflowCard(job, confirmationText) : helpCard());
            }
          );
        }

        // Chat can't push a card with zero interaction — nothing fires until the driver
        // sends something — so instead of requiring an exact keyword ("jobs"/"help"),
        // any message shows the menu. "resume"/"continue" stay a distinct explicit path
        // since they mean "take me back to the classic workflow step", not "show menu".
        const command = parseCommand(event.message?.argumentText || event.message?.text || "");
        if (command === "resume") return createResponse(await showCurrentOrNext(event, confirmationText, true));
        const { job } = await getNextJobForDriver(identifier(event), { sync: true });
        return createResponse(mainMenuCard(job));
      }

      case "CARD_CLICKED": {
        const fn = actionName(event);

        if (fn === "RESUME_JOB") return updateResponse(await showCurrentOrNext(event, confirmationText));
        if (fn === "MAIN_MENU") {
          const { job } = await getActiveJobForDriver(identifier(event));
          return updateResponse(mainMenuCard(job));
        }
        if (fn === "MENU_CHECK_IN") return updateResponse(await scenarioMenuAction("checkin")(event));
        if (fn === "MENU_CHECK_OUT") return updateResponse(await scenarioMenuAction("checkout")(event));
        if (fn === "MENU_PARKING_LIABILITY") return updateResponse(await scenarioMenuAction("parking")(event));
        if (fn === "MENU_LIABILITY_REPORT") return updateResponse(await scenarioMenuAction("liability")(event));

        if (fn === "SCENARIO_FIELD_SUBMIT" || fn === "SCENARIO_NOTICE_ACK" || fn === "SCENARIO_PHOTOS_CONTINUE") {
          const scenario = actionParam(event, "scenario") as ScenarioKey;
          const spec = SCENARIOS[scenario];
          if (!spec) throw new ValidationError("This scenario is no longer available.");

          return updateResponse(await withActiveJob(event, async job => {
            const messageName = event.message?.name ?? "";
            let progress;
            if (fn === "SCENARIO_FIELD_SUBMIT") {
              const fieldIndex = Number(actionParam(event, "fieldIndex"));
              const field = spec.fields[fieldIndex];
              const values = field ? (formInputs(event)[field.name] ?? []) : [];
              progress = await submitScenarioField(scenario, job.jobId, fieldIndex, values, messageName);
            } else if (fn === "SCENARIO_NOTICE_ACK") {
              progress = await acknowledgeScenarioNotice(scenario, job.jobId, messageName);
            } else {
              progress = await continueFromScenarioPhotos(scenario, job.jobId, messageName);
            }
            const step = await describeStep(spec, progress);
            return renderScenarioStep(spec, scenario, job.jobId, step);
          }));
        }

        const jobId = actionParam(event, "jobId");
        if (!jobId) throw new Error("Missing job ID in card action.");

        if (fn === "RETRY_EVIDENCE") {
          await retryFailedEvidence(jobId, identifier(event));
          return updateResponse(evidencePendingCard(jobId, ["your photo"]));
        }
        if (fn === "REOPEN_PHOTO_STEP") {
          const evidenceType = (actionParam(event, "evidenceType") || "Arrival") as EvidenceType;
          const job = await reopenPhotoStep(jobId, identifier(event), evidenceType);
          return updateResponse(workflowCard(job, confirmationText));
        }

        // Card clicks are replay-guarded too: a double-tap or a Chat retry must not
        // run a state transition twice.
        const clickKey = event.message?.name
          ? eventKeyFor({ messageName: `${event.message.name}#${fn}` })
          : null;

        // Everything else — START_JOB, FINISH_MOVE, SUBMIT_EXTRA_CHARGES, SUBMIT_OVERTIME,
        // SUBMIT_TOTAL_CHARGES, SUBMIT_PAYMENT, SUBMIT_CLIENT_DETAILS, COMPLETE_JOB — runs
        // through the classic Start Job workflow engine.
        return await runOnce(
          clickKey,
          { jobId },
          async () => {
            const job = await handleAction(fn, jobId, identifier(event), formInputs(event));
            timer.mark("action");
            log.info("card action handled", { job_id: jobId, action: fn, ...timer.fields() });

            // This click's response card is about to become "waiting on the customer
            // to sign" — remember which Chat message that is, so the signature POST
            // handler can push it forward automatically once they've signed (see
            // chat/signature.routes.ts). Best-effort: CHECK AGAIN is still the fallback
            // if this write or the later push fails for any reason.
            if (job.currentState === WorkflowState.WAITING_CLIENT_CONFIRMATION && event.message?.name) {
              await commitWrites([pendingSignatureWrite(job.jobId, event.message.name)]).catch(error =>
                log.warn("failed to record pending-signature message", { job_id: job.jobId, error: String(error) })
              );
            }

            return { result: updateResponse(workflowCard(job, confirmationText)), outcomeState: job.currentState, jobId: job.jobId };
          },
          async () => {
            const job = await getJob(jobId);
            return updateResponse(job ? workflowCard(job, confirmationText) : helpCard());
          }
        );
      }

      case "APP_COMMAND":
        return createResponse(await showCurrentOrNext(event, confirmationText, true));

      case "REMOVED_FROM_SPACE":
        return createResponse({});

      default:
        return createResponse(helpCard());
    }
  } catch (error) {
    return { message: await errorCard(error, event, timer), update: isClick };
  }
}

/**
 * Maps a thrown error onto something a driver can act on.
 *
 * Only errors we raised deliberately have their text shown. Anything else — a Sheets
 * schema problem, a Google 500 — is logged in full and replaced with a generic message,
 * because internal detail is neither useful nor safe on a driver's phone.
 */
async function errorCard(error: unknown, event: GoogleChatEvent, timer: PhaseTimer): Promise<ChatResponse> {
  const jobId = actionParam(event, "jobId");

  if (error instanceof EvidencePendingError) {
    log.info("completion deferred: evidence still processing", { job_id: jobId, pending: error.pending.length });
    return evidencePendingCard(jobId, error.pending);
  }
  if (error instanceof EvidenceFailedError) {
    log.warn("completion blocked: evidence failed", { job_id: jobId, failed: error.failedTypes.join(",") });
    return evidenceFailedCard(jobId, error.message, error.failedTypes);
  }
  if (error instanceof ValidationError || error instanceof PermanentTaskError) {
    log.info("action rejected", { job_id: jobId, event_type: event.type, reason: error.message, ...timer.fields() });

    // A rejected scenario field/notice/photos submit never wrote anything — the
    // ScenarioProgress row is exactly where it was. Re-show that same step with the
    // error on it, rather than a generic "Action blocked" card whose only button
    // (RETRY -> RESUME_JOB) jumped to the classic flow's job/menu card and lost the
    // scenario entirely, forcing the driver to start the whole thing over.
    const fn = actionName(event);
    const isScenarioAction = fn === "SCENARIO_FIELD_SUBMIT" || fn === "SCENARIO_NOTICE_ACK" || fn === "SCENARIO_PHOTOS_CONTINUE";
    if (isScenarioAction && jobId) {
      const scenario = actionParam(event, "scenario") as ScenarioKey;
      const spec = SCENARIOS[scenario];
      const progress = spec ? await getScenarioProgress(jobId, scenario, 0) : null;
      if (spec && progress) {
        const step = await describeStep(spec, progress);
        return renderScenarioStep(spec, scenario, jobId, step, error.message);
      }
    }

    return errorResponse(error.message, jobId);
  }

  log.error("chat event failed", error, { event_type: event.type, job_id: jobId, ...timer.fields() });
  return errorResponse(
    "Something went wrong on our side. Your last step was not lost — tap RETRY to reload this job.",
    jobId
  );
}
