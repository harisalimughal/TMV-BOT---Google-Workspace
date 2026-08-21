import { DateTime } from "luxon";
import { env } from "../config/env";
import { formatPounds } from "../utils/money";
import { Job } from "../jobs/job.types";

export type ChatResponse = Record<string, unknown>;

export interface ChatResult {
  message: ChatResponse;
  /** true => updateMessageAction (replace the clicked card); false => createMessageAction. */
  update: boolean;
}
function action(
  functionName: string,
  jobId: string,
  requiredWidgets: string[] = []
) {
  return {
    // Was hard-coded to a dev ngrok tunnel, which broke every button on any other
    // deployment. Now driven by TMV_CHAT_ACTION_URL (validated at startup).
    function: env.chatActionUrl,
    parameters: [
      {
        key: "actionName",
        value: functionName
      },
      {
        key: "jobId",
        value: jobId
      }
    ],
    requiredWidgets
  };
}

function button(text: string, functionName: string, jobId: string, type: "FILLED" | "OUTLINED" = "FILLED") {
  return {
    text,
    type,
    onClick: {
      action: action(functionName, jobId)
    }
  };
}

/**
 * A menu option. All six are always enabled (see mainMenuCard()) — tapping one before
 * a job is started silently starts it first (see chat.controller.ts's withActiveJob()),
 * so there's nothing left to gate here.
 */
function menuButton(text: string, functionName: string, jobId: string, enabled: boolean, type: "FILLED" | "OUTLINED" = "FILLED") {
  return { ...button(text, functionName, jobId, type), disabled: !enabled };
}

/**
 * Opens as a layered overlay window rather than a full new browser tab — the closest
 * thing Chat's platform has to "a pop-up in the same window", since cards themselves
 * cannot embed arbitrary content like a signature canvas or a photo picker. onClose:
 * RELOAD asks Chat to re-render the card that opened it once the overlay closes, so
 * the driver's "Back to menu" tap is a fallback, not the only way forward.
 */
function overlayLinkButton(text: string, url: string) {
  return {
    text,
    type: "FILLED",
    onClick: {
      openLink: { url, openAs: "OVERLAY", onClose: "RELOAD" }
    }
  };
}
function header(title: string, subtitle?: string) {
  return { title, subtitle: subtitle || undefined };
}

function card(cardId: string, title: string, subtitle: string, widgets: any[]): ChatResponse {
  return {
    cardsV2: [{
      cardId,
      card: {
        header: header(title, subtitle),
        sections: [{ widgets }]
      }
    }]
  };
}

/**
 * Marks a card as replacing the message that was clicked, rather than posting a new
 * one. The previous actionResponse: UPDATE_MESSAGE marker was silently dropped by
 * server.ts, so a driver accumulated one stacked card per workflow step.
 */
export function updateResponse(response: ChatResponse): ChatResult {
  return { message: response, update: true };
}

export function createResponse(response: ChatResponse): ChatResult {
  return { message: response, update: false };
}

export function textResponse(text: string): ChatResponse {
  return { text };
}

export function errorResponse(message: string, jobId = ""): ChatResponse {
  const widgets: any[] = [
    { textParagraph: { text: `<b>${escapeHtml(message)}</b>` } },
    { textParagraph: { text: "Type <b>Next Job</b> at any time to reload your active or next job." } }
  ];
  if (jobId) {
    widgets.push({
      buttonList: { buttons: [{ text: "RETRY", type: "FILLED", onClick: { action: action("RESUME_JOB", jobId) } }] }
    });
  }
  return card("tmv-error", "TMV — Action blocked", "Please correct the issue below", widgets);
}

export function helpCard(): ChatResponse {
  return card("tmv-help", "TMV Driver Bot", "Google Chat operations workflow", [
    { textParagraph: { text: "Type <b>Next Job</b> to receive your active or next unfinished job." } },
    { textParagraph: { text: "Once a job is started, use the menu buttons to check in, check out, or file a liability report — each opens a short form to fill in on your device." } }
  ]);
}

/**
 * Entry-point menu. Shown when the bot is added to a space, whenever a driver types
 * "jobs" / "next job" / "help" / "start", and after every menu action completes.
 *
 * All six buttons are always enabled — a driver can tap Check In, Finish Job, etc. at
 * any point, before or after Start Job, with no greyed-out state to fight with on Chat
 * clients that may render `disabled` inconsistently. Tapping one before a job is
 * started silently starts it first rather than blocking with a message (see
 * chat.controller.ts's withActiveJob()). Re-introduce per-button gating here if the
 * client asks for it later.
 */
export function mainMenuCard(job: Job | null): ChatResponse {
  const jobId = job?.jobId ?? "";
  return card("tmv-main-menu", "TMV Driver Bot", "What do you want to do?", [
    { buttonList: { buttons: [menuButton("Next Job", "RESUME_JOB", jobId, true)] } },
    { buttonList: { buttons: [menuButton("Check In", "MENU_CHECK_IN", jobId, true)] } },
    { buttonList: { buttons: [menuButton("Check Out", "MENU_CHECK_OUT", jobId, true)] } },
    { buttonList: { buttons: [menuButton("Parking Liability", "MENU_PARKING_LIABILITY", jobId, true)] } },
    { buttonList: { buttons: [menuButton("Liability Report", "MENU_LIABILITY_REPORT", jobId, true)] } },
    { buttonList: { buttons: [menuButton("Finish Job", "FINISH_JOB_CONFIRM", jobId, true, "OUTLINED")] } }
  ]);
}

/**
 * Shown after a menu scenario is confirmed available. One button opens the actual
 * form (see chat/scenario.routes.ts) as an overlay; the form itself handles
 * submission and tells the driver to come back here.
 */
export function openFormCard(jobId: string, title: string, description: string, url: string): ChatResponse {
  return card(`tmv-form-${jobId}-${title}`, title, "Tap to open", [
    { textParagraph: { text: escapeHtml(description) } },
    { buttonList: { buttons: [overlayLinkButton(`OPEN ${title.toUpperCase()}`, url)] } },
    { textParagraph: { text: "Once you've submitted it, tap below to go back to the menu." } },
    { buttonList: { buttons: [menuButton("Back to menu", "MAIN_MENU", jobId, true)] } }
  ]);
}

export function finishJobConfirmCard(jobId: string): ChatResponse {
  return card("tmv-finish-confirm", "Finish this job?", `Job ${jobId}`, [
    { textParagraph: { text: "This marks the job as completed. Make sure every form this job needed has been submitted first." } },
    { buttonList: { buttons: [button("YES, FINISH JOB", "FINISH_JOB", jobId)] } },
    { buttonList: { buttons: [menuButton("Cancel", "MAIN_MENU", jobId, true)] } }
  ]);
}

export function jobCompletedCard(job: Job): ChatResponse {
  return card(`completed-${job.jobId}`, "Job completed", `Job ${job.jobId}`, [
    { decoratedText: { topLabel: "Started", text: formatTime(job.actualStart) } },
    { decoratedText: { topLabel: "Finished", text: formatTime(job.actualFinish) } },
    { decoratedText: { topLabel: "Actual duration", text: `${job.actualMinutes} minutes` } },
    { textParagraph: { text: "Type <b>Next Job</b> to receive the next unfinished job." } }
  ]);
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  return DateTime.fromISO(iso).setZone(env.timezone).toFormat("dd LLL yyyy, HH:mm");
}

export function jobCard(job: Job): ChatResponse {
  const active = job.status === "IN_PROGRESS";
  const widgets: any[] = [
    { decoratedText: { topLabel: "Customer", text: escapeHtml(job.customerName || "Not supplied") } },
    { decoratedText: { topLabel: "Pickup", text: escapeHtml(job.pickup || "Not supplied") } },
    { decoratedText: { topLabel: "Drop-off", text: escapeHtml(job.dropoff || "Not supplied") } },
    { decoratedText: { topLabel: "Booked time", text: `${formatTime(job.bookedStart)} → ${formatTime(job.bookedFinish)}` } },
    { decoratedText: { topLabel: "Price", text: formatPounds(job.basePrice) } },
    { buttonList: { buttons: [button(active ? "RESUME JOB" : "START JOB", active ? "RESUME_JOB" : "START_JOB", job.jobId)] } }
  ];
  return card(`job-${job.jobId}`, `Job ${job.jobId}`, active ? "Active job" : "Next unfinished job", widgets);
}

export function noJobsCard(): ChatResponse {
  return card("tmv-no-jobs", "No unfinished jobs", "You're up to date", [
    { textParagraph: { text: "No eligible unfinished jobs were found for you today." } }
  ]);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}
