import {
  ChatResponse, ChatResult, createResponse, errorResponse, finishJobConfirmCard, helpCard, jobCard,
  jobCompletedCard, mainMenuCard, noJobsCard, openFormCard, updateResponse
} from "./cards";
import { parseCommand } from "./commands";
import { getActiveJobForDriver, getNextJobForDriver, startJob } from "../jobs/jobs.service";
import { beginJob, finishJob } from "../workflow/workflow.engine";
import { ValidationError } from "../workflow/validation.engine";
import { PermanentTaskError } from "../queue/queue.types";
import { ChatAttachment, JobStatus } from "../jobs/job.types";
import { setContext, log } from "../utils/logger";
import { PhaseTimer } from "../utils/timing";
import { eventKeyFor, runOnce } from "./replay.guard";
import { ScenarioKey, SCENARIOS } from "./scenario.spec";
import { scenarioLinkFor } from "./scenario.link";

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

function attachments(event: GoogleChatEvent): ChatAttachment[] {
  return event.message?.attachment ?? event.message?.attachments ?? [];
}

async function showCurrentOrNext(event: GoogleChatEvent, sync = false): Promise<ChatResponse> {
  // Only the "jobs" command and APP_COMMAND need fresh Calendar data. Resuming an
  // existing job does not — the job is already in Sheets.
  const { job } = await getNextJobForDriver(identifier(event), { sync });
  if (!job) return noJobsCard();
  setContext({ jobId: job.jobId });
  return job.status === "IN_PROGRESS" ? mainMenuCard(job) : jobCard(job);
}

/**
 * Shared by every MENU_* / FINISH_JOB_CONFIRM click: fresh-reads the driver's active or
 * next job and runs the requested action against it directly — no "start a job first"
 * prompt. If the job hasn't been started yet, it's started silently first (so
 * actualStart/status/the claim-on-first-tap logic in startJob() all still happen
 * correctly), then the scenario/finish flow proceeds immediately. Only genuinely having
 * no eligible job at all still short-circuits, since there's nothing to attach the data
 * to.
 */
async function withActiveJob(
  event: GoogleChatEvent,
  run: (job: NonNullable<Awaited<ReturnType<typeof getActiveJobForDriver>>["job"]>) => Promise<ChatResponse>
): Promise<ChatResponse> {
  const { job } = await getActiveJobForDriver(identifier(event));
  if (!job) return noJobsCard();
  const active = job.status === JobStatus.IN_PROGRESS ? job : await startJob(job.jobId, identifier(event));
  return run(active);
}

function scenarioMenuAction(scenario: ScenarioKey) {
  return async (event: GoogleChatEvent): Promise<ChatResponse> =>
    withActiveJob(event, async job => {
      const spec = SCENARIOS[scenario];
      const url = scenarioLinkFor(scenario, job.jobId);
      return openFormCard(job.jobId, spec.title, spec.menuDescription, url);
    });
}

export async function handleChatEvent(event: GoogleChatEvent): Promise<ChatResult> {
  const isClick = event.type === "CARD_CLICKED";
  const timer = new PhaseTimer();
  setContext({ userEmail: identifier(event) || undefined });

  try {
    switch (event.type) {
      case "ADDED_TO_SPACE": {
        const { job } = await getNextJobForDriver(identifier(event));
        return createResponse(mainMenuCard(job));
      }

      case "MESSAGE": {
        if (attachments(event).length) {
          // Photos are no longer accepted as bare Chat attachments — every scenario
          // form (Check In, Check Out, Parking Liability, Liability Report) has its
          // own photo upload built into the form itself.
          return createResponse({ text: "Please use the menu buttons to upload photos — open the relevant form and attach them there." });
        }

        const command = parseCommand(event.message?.argumentText || event.message?.text || "");
        if (command === "resume") return createResponse(await showCurrentOrNext(event, true));
        if (command === "jobs" || command === "help") {
          const { job } = await getNextJobForDriver(identifier(event), { sync: true });
          return createResponse(mainMenuCard(job));
        }
        return createResponse({ text: "Hello from TMV Bot ✅" });
      }

      case "CARD_CLICKED": {
        const fn = actionName(event);

        if (fn === "RESUME_JOB") return updateResponse(await showCurrentOrNext(event));
        if (fn === "MAIN_MENU") {
          const { job } = await getActiveJobForDriver(identifier(event));
          return updateResponse(mainMenuCard(job));
        }
        if (fn === "MENU_CHECK_IN") return updateResponse(await scenarioMenuAction("checkin")(event));
        if (fn === "MENU_CHECK_OUT") return updateResponse(await scenarioMenuAction("checkout")(event));
        if (fn === "MENU_PARKING_LIABILITY") return updateResponse(await scenarioMenuAction("parking")(event));
        if (fn === "MENU_LIABILITY_REPORT") return updateResponse(await scenarioMenuAction("liability")(event));
        if (fn === "FINISH_JOB_CONFIRM") {
          return updateResponse(await withActiveJob(event, async job => finishJobConfirmCard(job.jobId)));
        }

        const jobId = actionParam(event, "jobId");
        if (!jobId) throw new Error("Missing job ID in card action.");

        // Card clicks are replay-guarded too: a double-tap or a Chat retry must not
        // run a state transition twice.
        const clickKey = event.message?.name
          ? eventKeyFor({ messageName: `${event.message.name}#${fn}` })
          : null;

        if (fn === "START_JOB") {
          return await runOnce(
            clickKey,
            { jobId },
            async () => {
              const job = await beginJob(jobId, identifier(event));
              timer.mark("action");
              log.info("card action handled", { job_id: jobId, action: fn, ...timer.fields() });
              return { result: updateResponse(mainMenuCard(job)), outcomeState: job.currentState, jobId: job.jobId };
            },
            async () => updateResponse(mainMenuCard(null))
          );
        }

        if (fn === "FINISH_JOB") {
          return await runOnce(
            clickKey,
            { jobId },
            async () => {
              const job = await finishJob(jobId, identifier(event));
              timer.mark("action");
              log.info("card action handled", { job_id: jobId, action: fn, ...timer.fields() });
              return { result: updateResponse(jobCompletedCard(job)), outcomeState: job.currentState, jobId: job.jobId };
            },
            async () => updateResponse(mainMenuCard(null))
          );
        }

        throw new ValidationError(`Unknown action: ${fn}`);
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
