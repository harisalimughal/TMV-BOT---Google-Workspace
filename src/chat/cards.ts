import { DateTime } from "luxon";
import { env } from "../config/env";
import { formatPounds } from "../utils/money";
import { EvidenceRecord, EvidenceType, ExtraChargeType, Job, PaymentMethod } from "../jobs/job.types";
import { CUSTOMER_CONFIRMATION_TEXT, suggestedTotal } from "../workflow/workflow.engine";
import { WorkflowState } from "../workflow/workflow.states";
import { signatureLinkFor } from "./signature.link";
import { ScenarioFieldSpec, ScenarioKey, ScenarioSpec } from "./scenario.spec";
import { scenarioLinkFor } from "./scenario.link";
import type { ScenarioStepView } from "./scenario.engine";

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

/** Like action(), plus a "scenario" parameter and arbitrary extras (e.g. fieldIndex) —
 *  every Chat-card-driven scenario step click needs to say which scenario it's for. */
function scenarioAction(
  functionName: string, jobId: string, scenario: string, extra: Record<string, string> = {},
  requiredWidgets: string[] = []
) {
  return {
    function: env.chatActionUrl,
    parameters: [
      { key: "actionName", value: functionName },
      { key: "jobId", value: jobId },
      { key: "scenario", value: scenario },
      ...Object.entries(extra).map(([key, value]) => ({ key, value }))
    ],
    requiredWidgets
  };
}

function scenarioButton(
  text: string, functionName: string, jobId: string, scenario: string,
  extra: Record<string, string> = {}, requiredWidgets: string[] = [], type: "FILLED" | "OUTLINED" = "FILLED"
) {
  return { text, type, onClick: { action: scenarioAction(functionName, jobId, scenario, extra, requiredWidgets) } };
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
  liabilityReport: { red: 0.576, green: 0.204, blue: 0.902 }, // purple
  tomorrowJobs: { red: 0.0, green: 0.478, blue: 0.478 }      // teal
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
    { textParagraph: { text: "Tap below for the menu, or send any message." } },
    { textParagraph: { text: "Next Job takes you to your active or next job; Start Job on that runs the full move workflow (photos, charges, payment, signature) step by step." } },
    { textParagraph: { text: "Check In and Check Out are separate, independent forms — pick one any time, whether or not Start Job has been run." } },
    { textParagraph: { text: "Parking Liability and Liability Report come up automatically inside Next Job's workflow if you report an issue after arrival or before the empty-van photo." } },
    { textParagraph: { text: "Tomorrow's Jobs shows what's booked for you the next day, oldest first, so you can plan ahead." } },
    { buttonList: { buttons: [menuButton("Main Menu", "MAIN_MENU", "", true)] } }
  ]);
}

/**
 * Entry-point menu. Shown when the bot is added to a space and on every other message
 * the driver sends (see chat.controller.ts's handleChatEvent()) — there's no keyword to
 * remember, any message shows it.
 *
 * Every option is independent and always enabled: Next Job drills into the classic
 * move workflow (see showCurrentOrNext() / workflowCard()), while Check In and Check
 * Out each run their own standalone flow against whatever job the driver currently
 * has — neither requires Next Job's workflow to have been started first (see
 * chat.controller.ts's withActiveJob()). Parking Liability and Liability Report are
 * deliberately NOT here: they're only reachable from inside the classic flow's own
 * "any issues?" checkpoints now (see issuesChoiceCard() below) — the action names
 * (MENU_PARKING_LIABILITY/MENU_LIABILITY_REPORT) and their handlers are unchanged and
 * still used by that inline card, just no longer exposed as a standalone top-level
 * entry point. No standalone Finish Job button: a job now only completes via the
 * classic workflow's own final step (COMPLETE_JOB) — see workflow.engine.ts's
 * handleAction(). Tomorrow's Jobs is read-only and always available too -- a driver
 * checking their schedule ahead (to plan, arrange helpers, review details) isn't
 * gated on finishing today's jobs first, it's simply the point in the day they're
 * most likely to tap it.
 */
export function mainMenuCard(job: Job | null): ChatResponse {
  const jobId = job?.jobId ?? "";
  return card("tmv-main-menu", "TMV Driver Bot", "What do you want to do?", [
    { buttonList: { buttons: [menuButton("Next Job", "RESUME_JOB", jobId, true, "FILLED", MENU_COLORS.nextJob)] } },
    { buttonList: { buttons: [menuButton("Check In", "MENU_CHECK_IN", jobId, true, "FILLED", MENU_COLORS.checkIn)] } },
    { buttonList: { buttons: [menuButton("Check Out", "MENU_CHECK_OUT", jobId, true, "FILLED", MENU_COLORS.checkOut)] } },
    { buttonList: { buttons: [menuButton("Tomorrow's Jobs", "MENU_TOMORROW_JOBS", jobId, true, "FILLED", MENU_COLORS.tomorrowJobs)] } }
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
    { textParagraph: { text: "No eligible unfinished jobs were found for you today." } },
    { buttonList: { buttons: [menuButton("Main Menu", "MAIN_MENU", "", true)] } }
  ]);
}

/**
 * Read-only preview of the driver's jobs booked for the following calendar day, oldest
 * first -- lets a driver plan ahead, organise their schedule, arrange helpers, and
 * review job details in advance, typically once today's work is wrapped up (see
 * jobs.service.ts's getTomorrowJobsForDriver() for the underlying date/assignment
 * filter). Deliberately separate from jobCard()/workflowCard(): nothing here is
 * actionable (no Start Job button) since these jobs aren't due yet.
 */
export function tomorrowJobsCard(jobs: Job[], unassignedCount = 0): ChatResponse {
  const tomorrowLabel = DateTime.now().setZone(env.timezone).plus({ days: 1 }).toFormat("cccc dd LLL");

  if (!jobs.length) {
    const text = unassignedCount > 0
      ? "You don't currently have a job assigned for tomorrow. Your schedule may be updated by the admin."
      : "No jobs are scheduled for you tomorrow yet.";
    return card("tmv-tomorrow-jobs", "Tomorrow's Jobs", tomorrowLabel, [
      { textParagraph: { text } },
      { buttonList: { buttons: [menuButton("Main Menu", "MAIN_MENU", "", true)] } }
    ]);
  }

  const widgets: any[] = [];
  jobs.forEach((job, index) => {
    if (index > 0) widgets.push({ divider: {} });
    widgets.push(
      { decoratedText: { topLabel: "Time", text: `${formatTime(job.bookedStart)} → ${formatTime(job.bookedFinish)}` } },
      { decoratedText: { topLabel: "Customer", text: escapeHtml(job.customerName || "Not supplied") } },
      { decoratedText: { topLabel: "Pickup", text: escapeHtml(job.pickup || "Not supplied"), wrapText: true } },
      { decoratedText: { topLabel: "Drop-off", text: escapeHtml(job.dropoff || "Not supplied"), wrapText: true } }
    );
  });
  widgets.push({ buttonList: { buttons: [menuButton("Main Menu", "MAIN_MENU", "", true)] } });

  return card(
    "tmv-tomorrow-jobs", "Tomorrow's Jobs", `${jobs.length} job${jobs.length > 1 ? "s" : ""} — ${tomorrowLabel}`, widgets
  );
}

export interface WorkflowCardExtras {
  /** Rendered "I am your driver..." preview text shown on WAITING_ON_MY_WAY_MESSAGE. */
  onMyWayPreview?: string;
  /** Rendered review-request email preview text shown on WAITING_REVIEW_SEND. */
  reviewEmailPreview?: string;
  /** Set only right after SEND_ON_MY_WAY_MESSAGE runs, so the Arrival card shows a
   *  one-time confirmation instead of on every ordinary re-view of that step. */
  justSentOnMyWayMessage?: boolean;
}

function backButton(jobId: string): unknown {
  return { text: "BACK", type: "OUTLINED", onClick: { action: action("GO_BACK", jobId) } };
}

/**
 * The classic move workflow: an "on my way" message preview -> arrival photo -> "any
 * issues?" checkpoint -> loaded photo -> charges -> overtime -> total -> payment ->
 * second "any issues?" checkpoint -> empty-van photo -> client details -> customer
 * signature -> review request -> complete. This is what "Start Job" on jobCard() kicks
 * off (see jobs.service.ts's startJob()) and what showCurrentOrNext() resumes at
 * whatever step the driver left off on. It is independent of the menu's Check In /
 * Check Out / Parking Liability / Liability Report flows, which never touch
 * job.currentState -- except that the two "any issues?" checkpoints can launch one of
 * those scenarios inline and pause here until it finishes (see chat.controller.ts's
 * resolveWorkflowCard() and scenario.engine.ts's finalizeScenario()).
 */
export function workflowCard(
  job: Job, confirmationText: string = CUSTOMER_CONFIRMATION_TEXT, extras: WorkflowCardExtras = {}
): ChatResponse {
  const state = job.currentState as WorkflowState;
  const id = `workflow-${job.jobId}`;

  switch (state) {
    case WorkflowState.WAITING_ON_MY_WAY_MESSAGE:
      return card(id, "On my way", "Preview the message to the customer", [
        { textParagraph: { text: escapeHtml(extras.onMyWayPreview ?? "") } },
        { buttonList: { buttons: [button("SEND MESSAGE", "SEND_ON_MY_WAY_MESSAGE", job.jobId)] } }
      ]);

    case WorkflowState.WAITING_ARRIVAL_PHOTO: {
      const widgets: any[] = [];
      if (extras.justSentOnMyWayMessage) {
        widgets.push({ textParagraph: { text: "✓ Message sent to the customer." } });
      }
      widgets.push({ textParagraph: { text: "Upload at least <b>1 arrival/start photo</b> directly into this Google Chat conversation." } });
      return card(id, "1. Arrival", "Pictures taken as proof.", widgets);
    }

    case WorkflowState.WAITING_ARRIVAL_ISSUES_CHECK:
      return issuesCheckCard(id, job.jobId, "Any issues on arrival?");

    case WorkflowState.WAITING_ARRIVAL_ISSUES_CHOICE:
      return issuesChoiceCard(id, job.jobId);

    case WorkflowState.WAITING_LOADED_PHOTO:
      return card(id, "2. Proof Of Van Loaded", "Take a picture, 1 or 2", [
        { textParagraph: { text: "Upload <b>1 or 2 photos</b> showing the van loaded." } }
      ]);

    case WorkflowState.IN_PROGRESS:
      return card(id, "Move Execution", "Job is currently in progress", [
        { decoratedText: { topLabel: "Started", text: formatTime(job.actualStart) } },
        { textParagraph: { text: "Carry out the move. When the operational move is finished, continue to charges and completion." } },
        { buttonList: { buttons: [button("START DRIVING", "FINISH_MOVE", job.jobId)] } }
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
        { buttonList: { buttons: [
          { text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_EXTRA_CHARGES", job.jobId, ["extra_charges"]) } },
          backButton(job.jobId)
        ] } }
      ]);

    case WorkflowState.WAITING_OVERTIME:
      return card(id, "4. Over Time Charges ?", "Extra time charges ?", [
        { textInput: { name: "overtime_minutes", label: "Overtime minutes", hintText: "Example: 30", type: "SINGLE_LINE" } },
        { textParagraph: { text: `Configured charging rule: ${formatPounds(env.overtimeRatePer30Minutes)} per 30 minutes, rounded up, after ${env.overtimeGraceMinutes} minute grace.` } },
        { buttonList: { buttons: [
          { text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_OVERTIME", job.jobId, ["overtime_minutes"]) } },
          backButton(job.jobId)
        ] } }
      ]);

    case WorkflowState.WAITING_TOTAL_CHARGES:
      return card(id, "5. Total Charges ?", "Total / Tunnel / CCL / Over time ?", [
        { decoratedText: { topLabel: "System suggested total", text: formatPounds(suggestedTotal(job)) } },
        { textInput: { name: "total_charges", label: "Final total (£)", value: suggestedTotal(job).toFixed(2), type: "SINGLE_LINE" } },
        { buttonList: { buttons: [
          { text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_TOTAL_CHARGES", job.jobId, ["total_charges"]) } },
          backButton(job.jobId)
        ] } }
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
        { buttonList: { buttons: [
          { text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_PAYMENT", job.jobId, ["payment_method"]) } },
          backButton(job.jobId)
        ] } }
      ]);

    case WorkflowState.WAITING_EMPTY_VAN_ISSUES_CHECK:
      return issuesCheckCard(id, job.jobId, "Any issues before we finish unloading?");

    case WorkflowState.WAITING_EMPTY_VAN_ISSUES_CHOICE:
      return issuesChoiceCard(id, job.jobId);

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
        { buttonList: { buttons: [
          { text: "CONTINUE", type: "FILLED", onClick: { action: action("SUBMIT_CLIENT_DETAILS", job.jobId, ["client_name_postcode"]) } },
          backButton(job.jobId)
        ] } }
      ]);

    case WorkflowState.WAITING_CLIENT_CONFIRMATION:
      // No manual button here by design: the server proactively pushes the next card
      // the moment the customer signs (see google/chat.ts's updateChatCard(), wired
      // from signature.routes.ts). If that push itself fails, signature.routes.ts
      // falls back to pushing a small recovery card with its own CHECK AGAIN button
      // instead — the button only ever appears when it's actually needed, not as a
      // permanent fixture on every ordinary view of this card.
      return card(id, "9. Client Signature", "Customer completion confirmation", [
        { textParagraph: { text: escapeHtml(confirmationText) } },
        { textParagraph: { text: "Hand your device to the customer, have them open the link below, sign with a finger or the cursor, and submit." } },
        { buttonList: { buttons: [overlayLinkButton("OPEN SIGNATURE PAD", signatureLinkFor(job.jobId))] } }
      ]);

    case WorkflowState.WAITING_REVIEW_CHECK:
      return card(id, "Customer review", "Do you want to take a review from the client?", [
        { buttonList: { buttons: [
          { text: "YES", type: "FILLED", onClick: { action: action("REVIEW_YES", job.jobId) } },
          { text: "NO", type: "OUTLINED", onClick: { action: action("REVIEW_NONE", job.jobId) } }
        ] } }
      ]);

    case WorkflowState.WAITING_REVIEW_SEND:
      return card(id, "Review request email", "Preview the email to the customer", [
        { textParagraph: { text: escapeHtml(extras.reviewEmailPreview ?? "") } },
        { buttonList: { buttons: [button("SEND EMAIL", "SEND_REVIEW_EMAIL", job.jobId)] } }
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
        { buttonList: { buttons: [menuButton("Main Menu", "MAIN_MENU", "", true)] } }
      ]);

    default:
      return jobCard(job);
  }
}

/** Shared by both "any issues?" checkpoints (after Arrival, before Empty Van). One tap
 *  either way -- no selection widget -- since Yes/No is the entire decision here. */
function issuesCheckCard(id: string, jobId: string, prompt: string): ChatResponse {
  return card(id, "Any issues?", prompt, [
    { buttonList: { buttons: [
      { text: "YES", type: "FILLED", onClick: { action: action("ISSUES_YES", jobId) } },
      { text: "NO", type: "OUTLINED", onClick: { action: action("ISSUES_NONE", jobId) } }
    ] } }
  ]);
}

/** Shared "which one?" card for both checkpoints. Reuses the exact same
 *  MENU_PARKING_LIABILITY / MENU_LIABILITY_REPORT action wiring the main menu uses to
 *  launch these scenarios (see workflow.engine.ts's getActiveJob / scenario.routes.ts)
 *  -- the scenario stepper needs no changes at all to run inline like this. */
function issuesChoiceCard(id: string, jobId: string): ChatResponse {
  return card(id, "Which one?", "Choose the type of issue to report", [
    { buttonList: { buttons: [
      menuButton("Parking Liability", "MENU_PARKING_LIABILITY", jobId, true, "FILLED", MENU_COLORS.parkingLiability)
    ] } },
    { buttonList: { buttons: [
      menuButton("Liability Report", "MENU_LIABILITY_REPORT", jobId, true, "FILLED", MENU_COLORS.liabilityReport)
    ] } }
  ]);
}

/**
 * Fallback pushed in place of the real next-step card only when that push itself
 * fails (see signature.routes.ts's POST handler) — the customer's signature was
 * already recorded successfully either way; this is purely "we couldn't show you
 * what's next automatically". CHECK AGAIN (RESUME_JOB, same action "Next Job" uses)
 * re-reads the job fresh and re-renders its real current state.
 */
export function signatureRecoveryCard(jobId: string): ChatResponse {
  return card("tmv-signature-recovery", "Signed ✓", "Couldn't refresh this card automatically", [
    { textParagraph: { text: "The customer's signature was recorded. Tap below to see what's next." } },
    { buttonList: { buttons: [button("CHECK AGAIN", "RESUME_JOB", jobId)] } }
  ]);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Chat-card-driven scenario steppers (Check In / Check Out / Parking Liability /
// Liability Report) — the bot asks one field at a time, like the classic workflow,
// instead of opening a bundled web form. Only the final signature still opens
// externally (Chat has no drawing/canvas widget) — see chat/scenario.engine.ts for
// the state machine these cards render.
// ---------------------------------------------------------------------------

function scenarioFieldWidget(field: ScenarioFieldSpec): any {
  if (field.type === "yesno") {
    return {
      selectionInput: {
        name: field.name, label: field.label, type: "RADIO_BUTTON",
        items: [{ text: "Yes", value: "Yes" }, { text: "No", value: "No" }]
      }
    };
  }
  if (field.type === "select" || field.type === "multiselect") {
    // DROPDOWN for single-select: the damage-category list alone runs to several dozen
    // options (see scenario.text.ts), which would render as an unusably long scrolling
    // radio-button stack on mobile — a real dropdown matches the "Tap to select" mockup
    // and stays usable at any list length.
    // Chat's own dropdown/checkbox widget has no hover-tooltip or wrapping affordance
    // for a long item -- it just gets cut off mid-word (e.g. "Glassware (e.g., glasses,
    // plates..."). Nothing in the card JSON controls that rendering, so instead the
    // "(e.g., ...)" examples are dropped from what's DISPLAYED only; `value` (what's
    // actually submitted and stored) stays the full original text either way.
    return {
      selectionInput: {
        name: field.name, label: field.label, type: field.type === "select" ? "DROPDOWN" : "CHECK_BOX",
        items: (field.options ?? []).map(opt => ({ text: opt.split(" (e.g.,")[0], value: opt }))
      }
    };
  }
  if (field.type === "date") {
    // A real calendar picker instead of a plain text box the driver had to type a date
    // into by hand — Chat submits this back as a UTC-midnight epoch, not text (see
    // chat.controller.ts's formInputs(), which converts it to dd/MM/yyyy).
    return { dateTimePicker: { name: field.name, label: field.label, type: "DATE_ONLY" } };
  }
  return { textInput: { name: field.name, label: field.label, hintText: field.placeholder ?? "Type here", type: "SINGLE_LINE" } };
}

/** A rejected submit (e.g. a required field left blank) never advances anything, so the
 *  driver needs to see the SAME step again to fix it — not a generic dead-end error
 *  card. Every scenario card that can be the target of a validation error accepts this
 *  and renders it as a leading warning line, right above the same interactive widget. */
function scenarioErrorWidget(errorText?: string): any[] {
  return errorText ? [{ textParagraph: { text: `<b><font color="#b3261e">${escapeHtml(errorText)}</font></b>` } }] : [];
}

export function scenarioFieldCard(
  spec: ScenarioSpec, scenario: ScenarioKey, jobId: string, fieldIndex: number, errorText?: string
): ChatResponse {
  const field = spec.fields[fieldIndex];
  const widgets: any[] = [...scenarioErrorWidget(errorText)];
  if (fieldIndex === 0 && spec.noticeHtml) {
    widgets.push({ textParagraph: { text: `<b>${escapeHtml(spec.noticeTitle ?? spec.title)}</b>` } });
    widgets.push({ textParagraph: { text: escapeHtml(spec.noticeHtml) } });
  }
  widgets.push(scenarioFieldWidget(field));
  widgets.push({
    buttonList: {
      buttons: [scenarioButton("CONTINUE", "SCENARIO_FIELD_SUBMIT", jobId, scenario, { fieldIndex: String(fieldIndex) }, [field.name])]
    }
  });
  return card(`scenario-${jobId}-${scenario}-${fieldIndex}`, spec.title, `Step ${fieldIndex + 1} of ${spec.fields.length}`, widgets);
}

export function scenarioNoticeCard(spec: ScenarioSpec, scenario: ScenarioKey, jobId: string, errorText?: string): ChatResponse {
  const notice = spec.conditionalNotice!;
  return card(`scenario-${jobId}-${scenario}-notice`, notice.title, spec.title, [
    ...scenarioErrorWidget(errorText),
    { textParagraph: { text: escapeHtml(notice.text) } },
    { buttonList: { buttons: [scenarioButton("CONTINUE", "SCENARIO_NOTICE_ACK", jobId, scenario)] } }
  ]);
}

export function scenarioPhotoCard(
  spec: ScenarioSpec, scenario: ScenarioKey, jobId: string, received: number, errorText?: string
): ChatResponse {
  const remaining = Math.max(0, spec.photoMin - received);
  const widgets: any[] = [
    ...scenarioErrorWidget(errorText),
    { textParagraph: { text: escapeHtml(spec.photoLabel) } },
    {
      textParagraph: {
        text: received > 0
          ? `<b>${received}</b> of up to ${spec.photoMax} photo(s) received.`
          : "Send the photo(s) directly into this chat conversation."
      }
    }
  ];
  if (remaining > 0) {
    widgets.push({ textParagraph: { text: `At least ${remaining} more needed.` } });
  } else {
    widgets.push({
      textParagraph: { text: received < spec.photoMax ? "Send another, or tap CONTINUE." : "" }
    });
    widgets.push({ buttonList: { buttons: [scenarioButton("CONTINUE", "SCENARIO_PHOTOS_CONTINUE", jobId, scenario)] } });
  }
  return card(`scenario-${jobId}-${scenario}-photos`, spec.title, "Photo evidence", widgets);
}

export function scenarioSignatureCard(spec: ScenarioSpec, scenario: ScenarioKey, jobId: string, url: string): ChatResponse {
  const widgets: any[] = [];
  if (spec.signatureText) widgets.push({ textParagraph: { text: escapeHtml(spec.signatureText) } });
  widgets.push({ textParagraph: { text: "Hand your device to the customer, have them open the link below, sign with a finger or the cursor, and submit." } });
  widgets.push({ buttonList: { buttons: [overlayLinkButton("OPEN SIGNATURE PAD", url)] } });
  // No manual button here by design: the server proactively pushes the submitted card
  // the moment the customer signs (see scenario.engine.ts's finalizeScenario /
  // scenario.routes.ts). If that push itself fails, scenario.routes.ts falls back to
  // pushing a small recovery card with its own CHECK AGAIN (SCENARIO_CHECK_AGAIN)
  // button instead -- it only ever appears when it's actually needed.
  return card(`scenario-${jobId}-${scenario}-signature`, spec.title, "Waiting on signature", widgets);
}

export function scenarioSubmittedCard(spec: ScenarioSpec, jobId: string): ChatResponse {
  return card(`scenario-${jobId}-${spec.key}-done`, `${spec.title} submitted`, `Job ${jobId}`, [
    { textParagraph: { text: `${spec.title} has been recorded.` } },
    { buttonList: { buttons: [menuButton("Main Menu", "MAIN_MENU", jobId, true)] } }
  ]);
}

/**
 * Fallback pushed in place of the real next-step card only when that push itself
 * fails (see scenario.routes.ts's POST handler) — the signature was already recorded
 * successfully either way; this is purely "we couldn't show you what's next
 * automatically". CHECK AGAIN re-reads the real current step, same as the ordinary
 * SCENARIO_CHECK_AGAIN path.
 */
export function scenarioRecoveryCard(spec: ScenarioSpec, scenario: ScenarioKey, jobId: string): ChatResponse {
  return card(`scenario-${jobId}-${scenario}-recovery`, `${spec.title} signed ✓`, "Couldn't refresh this card automatically", [
    { textParagraph: { text: "Your signature was recorded. Tap below to see what's next." } },
    { buttonList: { buttons: [scenarioButton("CHECK AGAIN", "SCENARIO_CHECK_AGAIN", jobId, scenario)] } }
  ]);
}

/** Dispatches to the right card for wherever a scenario's state machine currently is.
 *  `errorText`, when given, is shown as a leading warning line on the field/notice/
 *  photos cards — used to re-render the exact step a validation error was raised on,
 *  instead of losing scenario context on a generic error card. */
export function renderScenarioStep(
  spec: ScenarioSpec, scenario: ScenarioKey, jobId: string, step: ScenarioStepView, errorText?: string
): ChatResponse {
  switch (step.kind) {
    case "field":
      return scenarioFieldCard(spec, scenario, jobId, step.fieldIndex, errorText);
    case "notice":
      return scenarioNoticeCard(spec, scenario, jobId, errorText);
    case "photos":
      return scenarioPhotoCard(spec, scenario, jobId, step.received, errorText);
    case "signature":
      return scenarioSignatureCard(spec, scenario, jobId, scenarioLinkFor(scenario, jobId));
    case "done":
      return scenarioSubmittedCard(spec, jobId);
  }
}
