import { DateTime } from "luxon";
import { env } from "../config/env";
import { formatPounds } from "../utils/money";
import { EvidenceRecord, EvidenceType, ExtraChargeType, Job, PaymentMethod } from "../jobs/job.types";
import { CUSTOMER_CONFIRMATION_TEXT, suggestedTotal } from "../workflow/workflow.engine";
import { WorkflowState } from "../workflow/workflow.states";
import { signatureLinkFor } from "./signature.link";

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

/** 0-1 floats, per Chat Cards v2's Color widget — not 0-255. */
interface ButtonColor { red: number; green: number; blue: number; }

function button(
  text: string, functionName: string, jobId: string, type: "FILLED" | "OUTLINED" = "FILLED", color?: ButtonColor
) {
  return {
    text,
    type,
    ...(color ? { color: { ...color, alpha: 1 } } : {}),
    onClick: {
      action: action(functionName, jobId)
    }
  };
}

/** A menu option. All are always enabled — see mainMenuCard(). */
function menuButton(
  text: string, functionName: string, jobId: string, enabled: boolean,
  type: "FILLED" | "OUTLINED" = "FILLED", color?: ButtonColor
) {
  return { ...button(text, functionName, jobId, type, color), disabled: !enabled };
}

/** One color per menu option so the driver's menu reads at a glance, not a wall of blue. */
const MENU_COLORS = {
  nextJob: { red: 0.102, green: 0.451, blue: 0.910 },       // blue
  checkIn: { red: 0.204, green: 0.659, blue: 0.325 },       // green
  checkOut: { red: 0.984, green: 0.549, blue: 0.0 },        // orange
  parkingLiability: { red: 0.851, green: 0.188, blue: 0.145 }, // red
  liabilityReport: { red: 0.576, green: 0.204, blue: 0.902 }  // purple
} as const;

/**
 * Opens as a layered overlay window rather than a full new browser tab — the closest
 * thing Chat's platform has to "a pop-up in the same window", since cards themselves
 * cannot embed arbitrary content like a signature canvas or a photo picker. onClose:
 * RELOAD is set (it doesn't hurt), but confirmed live that it doesn't reliably
 * auto-refresh the card that opened it — every caller still needs its own manual
 * "check again"/"back to menu" button as the real way forward.
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

/**
 * Acknowledges an accepted photo.
 *
 * Wording matters here: "received", never "saved". At this point the bytes are still in
 * Google Chat and the Drive upload has not started. Telling the driver otherwise would
 * be exactly the fake-success this architecture is meant to avoid.
 */
export function photoAckCard(job: Job, accepted: EvidenceRecord[], next: ChatResponse): ChatResponse {
  const count = accepted.length;
  const lines = [
    { textParagraph: { text: `<b>${count} photo${count > 1 ? "s" : ""} received ✓</b>` } }
  ];

  // The acknowledgement and the next step arrive as one card so the driver never waits
  // on a second round trip to know what to do next.
  const nextCard = (next as { cardsV2?: Array<{ card?: { header?: any; sections?: any[] } }> }).cardsV2?.[0]?.card;
  const widgets = [...lines, { divider: {} }, ...(nextCard?.sections?.[0]?.widgets ?? [])];

  return {
    cardsV2: [
      {
        cardId: `ack-${job.jobId}`,
        card: { header: nextCard?.header ?? header("Photo received", `Job ${job.jobId}`), sections: [{ widgets }] }
      }
    ]
  };
}

/** Shown when required evidence is still being uploaded at completion time. */
export function evidencePendingCard(jobId: string, pending: string[]): ChatResponse {
  return card("tmv-evidence-pending", "Still processing", `Job ${jobId}`, [
    {
      textParagraph: {
        text: `We're still processing <b>${pending.length}</b> required photo${pending.length > 1 ? "s" : ""}: ` +
          escapeHtml(pending.join(", ")) + "."
      }
    },
    { textParagraph: { text: "Please wait a moment, then tap below." } },
    { buttonList: { buttons: [button("CHECK AGAIN & FINISH", "COMPLETE_JOB", jobId)] } }
  ]);
}

/** Shown when evidence failed permanently and the driver must act. */
export function evidenceFailedCard(jobId: string, message: string, failedTypes: EvidenceType[]): ChatResponse {
  const buttons: unknown[] = [
    { text: "RETRY UPLOAD", type: "FILLED", onClick: { action: action("RETRY_EVIDENCE", jobId) } }
  ];
  if (failedTypes.length) {
    buttons.push({
      text: "TAKE NEW PHOTO",
      type: "OUTLINED",
      onClick: {
        action: {
          ...action("REOPEN_PHOTO_STEP", jobId),
          parameters: [
            { key: "actionName", value: "REOPEN_PHOTO_STEP" },
            { key: "jobId", value: jobId },
            { key: "evidenceType", value: failedTypes[0] }
          ]
        }
      }
    });
  }
  return card("tmv-evidence-failed", "Photo upload failed", `Job ${jobId}`, [
    { textParagraph: { text: `<b>${escapeHtml(message)}</b>` } },
    { textParagraph: { text: "Retry the upload, or take a new photo if the original is no longer available." } },
    { buttonList: { buttons } }
  ]);
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
    { textParagraph: { text: "Tapping Start Job on that job runs the full move workflow (photos, charges, payment, signature) step by step." } },
    { textParagraph: { text: "Check In, Check Out, Parking Liability and Liability Report are separate, independent forms — open the menu (type <b>jobs</b>) and pick one any time, whether or not Start Job has been run." } }
  ]);
}

/**
 * Entry-point menu. Shown when the bot is added to a space and on every other message
 * the driver sends (see chat.controller.ts's handleChatEvent()) — there's no keyword to
 * remember, any message shows it.
 *
 * Every option is independent and always enabled: Next Job drills into the classic
 * move workflow (see showCurrentOrNext() / workflowCard()), while Check In, Check Out,
 * Parking Liability and Liability Report each run their own standalone flow against
 * whatever job the driver currently has — none of them require Next Job's workflow to
 * have been started first (see chat.controller.ts's withActiveJob()). No standalone
 * Finish Job button: a job now only completes via the classic workflow's own final
 * step (COMPLETE_JOB) — see workflow.engine.ts's handleAction().
 */
export function mainMenuCard(job: Job | null): ChatResponse {
  const jobId = job?.jobId ?? "";
  return card("tmv-main-menu", "TMV Driver Bot", "What do you want to do?", [
    { buttonList: { buttons: [menuButton("Next Job", "RESUME_JOB", jobId, true, "FILLED", MENU_COLORS.nextJob)] } },
    { buttonList: { buttons: [menuButton("Check In", "MENU_CHECK_IN", jobId, true, "FILLED", MENU_COLORS.checkIn)] } },
    { buttonList: { buttons: [menuButton("Check Out", "MENU_CHECK_OUT", jobId, true, "FILLED", MENU_COLORS.checkOut)] } },
    { buttonList: { buttons: [menuButton("Parking Liability", "MENU_PARKING_LIABILITY", jobId, true, "FILLED", MENU_COLORS.parkingLiability)] } },
    { buttonList: { buttons: [menuButton("Liability Report", "MENU_LIABILITY_REPORT", jobId, true, "FILLED", MENU_COLORS.liabilityReport)] } }
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

/**
 * The classic move workflow, restored: arrival photo -> loaded photo -> charges ->
 * overtime -> total -> payment -> empty-van photo -> client details -> customer
 * signature -> organized photo -> complete. This is what "Start Job" on jobCard()
 * kicks off (see jobs.service.ts's startJob()) and what showCurrentOrNext() resumes
 * at whatever step the driver left off on. It is independent of the menu's Check In /
 * Check Out / Parking Liability / Liability Report flows, which never touch
 * job.currentState.
 */
export function workflowCard(job: Job, confirmationText: string = CUSTOMER_CONFIRMATION_TEXT): ChatResponse {
  const state = job.currentState as WorkflowState;
  const id = `workflow-${job.jobId}`;

  switch (state) {
    case WorkflowState.WAITING_ARRIVAL_PHOTO:
      return card(id, "1. Arrival and Start the job !", "Pictures taken as proof.", [
        { textParagraph: { text: "Upload at least <b>1 arrival/start photo</b> directly into this Google Chat conversation." } }
      ]);

    case WorkflowState.WAITING_LOADED_PHOTO:
      return card(id, "2. Proof Of Van Loaded", "Take a picture, 1 or 2", [
        { textParagraph: { text: "Upload <b>1 or 2 photos</b> showing the van loaded." } }
      ]);

    case WorkflowState.IN_PROGRESS:
      return card(id, "Move Execution", "Job is currently in progress", [
        { decoratedText: { topLabel: "Started", text: formatTime(job.actualStart) } },
        { textParagraph: { text: "Carry out the move. When the operational move is finished, continue to charges and completion." } },
        { buttonList: { buttons: [button("FINISH MOVE / CONTINUE", "FINISH_MOVE", job.jobId)] } }
      ]);

    case WorkflowState.WAITING_EXTRA_CHARGES:
      return card(id, "3. Any Extra charges", "What extra charges if any?", [
        {
          selectionInput: {
            name: "extra_charges",
            label: "Extra charges",
            type: "CHECK_BOX",
            items: [
              { text: `London Congestion charge ${formatPounds(env.congestionCharge)}`, value: ExtraChargeType.CONGESTION },
              { text: `Tunnel Charges ${formatPounds(env.tunnelCharge)}`, value: ExtraChargeType.TUNNEL },
              { text: "Extra time / Charges", value: ExtraChargeType.EXTRA_TIME },
              { text: "No Extras Time", value: ExtraChargeType.NONE }
            ]
          }
        },
        { buttonList: { buttons: [{ text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_EXTRA_CHARGES", job.jobId, ["extra_charges"]) } }] } }
      ]);

    case WorkflowState.WAITING_OVERTIME:
      return card(id, "4. Over Time Charges ?", "Extra time charges ?", [
        { textInput: { name: "overtime_minutes", label: "Overtime minutes", hintText: "Example: 30", type: "SINGLE_LINE" } },
        { textParagraph: { text: `Configured charging rule: ${formatPounds(env.overtimeRatePer30Minutes)} per 30 minutes, rounded up, after ${env.overtimeGraceMinutes} minute grace.` } },
        { buttonList: { buttons: [{ text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_OVERTIME", job.jobId, ["overtime_minutes"]) } }] } }
      ]);

    case WorkflowState.WAITING_TOTAL_CHARGES:
      return card(id, "5. Total Charges ?", "Total / Tunnel / CCL / Over time ?", [
        { decoratedText: { topLabel: "System suggested total", text: formatPounds(suggestedTotal(job)) } },
        { textInput: { name: "total_charges", label: "Final total (£)", value: suggestedTotal(job).toFixed(2), type: "SINGLE_LINE" } },
        { buttonList: { buttons: [{ text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_TOTAL_CHARGES", job.jobId, ["total_charges"]) } }] } }
      ]);

    case WorkflowState.WAITING_PAYMENT:
      return card(id, "6. Cash / Link / Inv / Bank", "Select payment method", [
        {
          selectionInput: {
            name: "payment_method",
            label: "Payment method",
            type: "RADIO_BUTTON",
            items: Object.values(PaymentMethod).map(value => ({ text: value, value }))
          }
        },
        { buttonList: { buttons: [{ text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_PAYMENT", job.jobId, ["payment_method"]) } }] } }
      ]);

    case WorkflowState.WAITING_EMPTY_VAN_PHOTO:
      return card(id, "7. Empty Van / Unloaded ?", "Van Empty - Photo Taken", [
        { textParagraph: { text: "Upload a photo showing the van is empty/unloaded." } }
      ]);

    case WorkflowState.WAITING_CLIENT_DETAILS:
      // Client name is already known from the booking (job.customerName, asked once at
      // booking time) — this step only confirms the postcode/address, so the driver
      // isn't asked for the name a second time.
      return card(id, "8. Client Postcode / Address", "Confirm the postcode or address", [
        { textInput: { name: "client_name_postcode", label: "Postcode or address", value: job.dropoff || "", type: "MULTIPLE_LINE" } },
        { buttonList: { buttons: [{ text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_CLIENT_DETAILS", job.jobId, ["client_name_postcode"]) } }] } }
      ]);

    case WorkflowState.WAITING_CLIENT_CONFIRMATION:
      // onClose: RELOAD on the overlay button was assumed to auto-refresh this card
      // once the customer finishes signing — confirmed live in Chat that it doesn't
      // reliably do that, so CHECK AGAIN is back as the actual way forward.
      return card(id, "9. Client Signature", "Customer completion confirmation", [
        { textParagraph: { text: escapeHtml(confirmationText) } },
        { textParagraph: { text: "Hand your device to the customer, have them open the link below, sign with a finger or the cursor, and submit." } },
        { buttonList: { buttons: [overlayLinkButton("OPEN SIGNATURE PAD", signatureLinkFor(job.jobId))] } },
        { textParagraph: { text: "Once they've signed, tap below to continue." } },
        { buttonList: { buttons: [button("CHECK AGAIN", "RESUME_JOB", job.jobId)] } }
      ]);

    case WorkflowState.WAITING_ORGANIZED_PHOTO:
      return card(id, "10. Is the van organized ?", "Final evidence photo", [
        { textParagraph: { text: "Upload a photo showing that the van is organised." } }
      ]);

    case WorkflowState.READY_TO_COMPLETE:
      return card(id, "Ready to finish", "All required workflow steps are recorded", [
        { decoratedText: { topLabel: "Total charges", text: formatPounds(job.totalCharges) } },
        { decoratedText: { topLabel: "Payment", text: escapeHtml(job.paymentMethod || "Not recorded") } },
        { textParagraph: { text: "Photos still uploading in the background are checked when you tap below." } },
        { buttonList: { buttons: [button("FINISH JOB", "COMPLETE_JOB", job.jobId)] } }
      ]);

    case WorkflowState.COMPLETED:
      return card(id, "Job completed", `Job ${job.jobId}`, [
        { decoratedText: { topLabel: "Started", text: formatTime(job.actualStart) } },
        { decoratedText: { topLabel: "Finished", text: formatTime(job.actualFinish) } },
        { decoratedText: { topLabel: "Actual duration", text: `${job.actualMinutes} minutes` } },
        { decoratedText: { topLabel: "Total", text: formatPounds(job.totalCharges) } },
        { textParagraph: { text: "Type <b>Next Job</b> to receive the next unfinished job." } }
      ]);

    default:
      return jobCard(job);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}
