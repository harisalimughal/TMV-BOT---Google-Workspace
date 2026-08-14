import {
  ChatResponse, ChatResult, createResponse, errorResponse, evidenceFailedCard, evidencePendingCard, helpCard,
  jobCard, noJobsCard, photoAckCard, updateResponse, workflowCard
} from "./cards";
import { parseCommand } from "./commands";
import { getNextJobForDriver } from "../jobs/jobs.service";
import {
  EvidenceFailedError, EvidencePendingError, handleAction, handlePhotoStep, reopenPhotoStep, retryFailedEvidence
} from "../workflow/workflow.engine";
import { ValidationError } from "../workflow/validation.engine";
import { PermanentTaskError } from "../queue/queue.types";
import { ChatAttachment, EvidenceType } from "../jobs/job.types";
import { setContext, log } from "../utils/logger";
import { PhaseTimer } from "../utils/timing";
import { eventKeyFor, runOnce } from "./replay.guard";
import { getJob } from "../google/sheets";

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
    if (Array.isArray(strings)) result[key] = strings.map(String);
  }
  return result;
}

function attachments(event: GoogleChatEvent): ChatAttachment[] {
  return event.message?.attachment ?? event.message?.attachments ?? [];
}

async function showCurrentOrNext(event: GoogleChatEvent, sync = false): Promise<ChatResponse> {
  // Only the "jobs" command and APP_COMMAND need fresh Calendar data. Resuming an
  // existing job does not — the job is already in Sheets.
  const { job } = await getNextJobForDriver(identifier(event), { sync });
  if (!job) return noJobsCard();
  setContext({ jobId: job.jobId });
  return job.status === "IN_PROGRESS" ? workflowCard(job) : jobCard(job);
}

export async function handleChatEvent(event: GoogleChatEvent): Promise<ChatResult> {
  const isClick = event.type === "CARD_CLICKED";
  const timer = new PhaseTimer();
  setContext({ userEmail: identifier(event) || undefined });

  try {
    switch (event.type) {
      case "ADDED_TO_SPACE":
        return createResponse(helpCard());

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
                result: createResponse(photoAckCard(job, accepted, degraded, workflowCard(job))),
                outcomeState: job.currentState,
                jobId: job.jobId
              };
            },
            async replay => {
              // Show the card the original delivery produced, not an out-of-order error.
              const job = replay.jobId ? await getJob(replay.jobId) : null;
              return createResponse(job ? workflowCard(job) : helpCard());
            }
          );
        }

        const command = parseCommand(event.message?.argumentText || event.message?.text || "");
        if (command === "jobs" || command === "resume") return createResponse(await showCurrentOrNext(event, true));
        if (command === "help") return createResponse(helpCard());
        return createResponse({ text: "Hello from TMV Bot ✅" });
      }

      case "CARD_CLICKED": {
        const fn = actionName(event);
        if (fn === "RESUME_JOB") return updateResponse(await showCurrentOrNext(event));
        const jobId = actionParam(event, "jobId");
        if (!jobId) throw new Error("Missing job ID in card action.");

        if (fn === "RETRY_EVIDENCE") {
          await retryFailedEvidence(jobId, identifier(event));
          return updateResponse(evidencePendingCard(jobId, ["your photo"]));
        }
        if (fn === "REOPEN_PHOTO_STEP") {
          const evidenceType = (actionParam(event, "evidenceType") || "Arrival") as EvidenceType;
          const job = await reopenPhotoStep(jobId, identifier(event), evidenceType);
          return updateResponse(workflowCard(job));
        }

        // Card clicks are replay-guarded too: a double-tap or a Chat retry must not
        // run a state transition twice.
        const clickKey = event.message?.name
          ? eventKeyFor({ messageName: `${event.message.name}#${fn}` })
          : null;

        return await runOnce(
          clickKey,
          { jobId },
          async () => {
            const job = await handleAction(fn, jobId, identifier(event), formInputs(event));
            timer.mark("action");
            log.info("card action handled", { job_id: jobId, action: fn, ...timer.fields() });
            return { result: updateResponse(workflowCard(job)), outcomeState: job.currentState, jobId: job.jobId };
          },
          async () => {
            const job = await getJob(jobId);
            return updateResponse(job ? workflowCard(job) : helpCard());
          }
        );
      }

      case "APP_COMMAND":
        return createResponse(await showCurrentOrNext(event, true));

      case "REMOVED_FROM_SPACE":
        return createResponse({});

      default:
        return createResponse(helpCard());
    }
  } catch (error) {
    return { message: errorCard(error, event, timer), update: isClick };
  }
}

/**
 * Maps a thrown error onto something a driver can act on.
 *
 * Only errors we raised deliberately have their text shown. Anything else — a Sheets
 * schema problem, a Google 500 — is logged in full and replaced with a generic message,
 * because internal detail is neither useful nor safe on a driver's phone.
 */
function errorCard(error: unknown, event: GoogleChatEvent, timer: PhaseTimer): ChatResponse {
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
    return errorResponse(error.message, jobId);
  }

  log.error("chat event failed", error, { event_type: event.type, job_id: jobId, ...timer.fields() });
  return errorResponse(
    "Something went wrong on our side. Your last step was not lost — tap RETRY to reload this job.",
    jobId
  );
}
