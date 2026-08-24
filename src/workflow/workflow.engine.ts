import { env } from "../config/env";
import {
  activityWrite, commitWrites, driverFlowWrite, evidenceWrite, getJob, getSetting, jobWrite, listEvidenceForJob,
  paymentWrite, readEvidenceSummary, signatureWrite, SheetWrite, workflowWrite
} from "../google/sheets";
import {
  ChatAttachment, EvidenceRecord, EvidenceStatus, EvidenceType, ExtraChargeType, Job
} from "../jobs/job.types";
import { buildReceivedEvidence, markRequeued } from "../jobs/evidence.service";
import { completeJob, getJobForDriver, getNextJobForDriver, saveJob, startJob } from "../jobs/jobs.service";
import { enqueueAll } from "../queue/queue.service";
import { ProcessJobImageTask } from "../queue/queue.types";
import { WorkflowState, nextAfterPhoto, PHOTO_STATES } from "./workflow.states";
import {
  assertState, validateClientDetails, validateCurrency,
  validateExtraCharges, validateMinutes, validatePaymentMethod, ValidationError
} from "./validation.engine";
import { log, setContext } from "../utils/logger";
import { equalPence, formatPounds, fromPounds } from "../utils/money";
import { sendJobStartedEmail, sendReviewRequestEmail } from "../google/gmail";
import { sendJobStartedSms } from "../integrations/firetext";
import { JOB_STARTED_MESSAGE_TEMPLATE, REVIEW_REQUEST_EMAIL_TEMPLATE } from "../notifications/message";

export const CUSTOMER_CONFIRMATION_TEXT =
  "By signing below, you confirm that you have inspected the van, that it is empty, that all items have been delivered, and that no items have been left behind. You also confirm that the removal service has been completed to your satisfaction.";

function extraChargeAmount(job: Job): number {
  let total = 0;
  if (job.extraCharges.includes(ExtraChargeType.CONGESTION)) total += env.congestionCharge;
  if (job.extraCharges.includes(ExtraChargeType.TUNNEL)) total += env.tunnelCharge;
  total += job.overtimeCharge;
  return total;
}

export function suggestedTotal(job: Job): number {
  return Math.round((job.basePrice + extraChargeAmount(job)) * 100) / 100;
}

export async function beginJob(jobId: string, identifier: string): Promise<Job> {
  return startJob(jobId, identifier);
}

const PHOTO_FOLDER: Record<string, EvidenceType> = {
  [WorkflowState.WAITING_ARRIVAL_PHOTO]: "Arrival",
  [WorkflowState.WAITING_LOADED_PHOTO]: "VanLoaded",
  [WorkflowState.WAITING_EMPTY_VAN_PHOTO]: "EmptyVan"
};

export interface PhotoAcceptance {
  job: Job;
  /** Evidence accepted onto the queue. Never "saved" — that is the worker's word. */
  accepted: EvidenceRecord[];
  /** True when at least one enqueue failed and the reaper is the recovery path. */
  degraded: boolean;
}

/**
 * Critical path for a photo upload.
 *
 * Everything here is validation plus one Sheets batch. No media download, no Drive call,
 * no Gmail. The photo is not in Drive when this returns, and the driver is told exactly
 * that.
 */
export async function handlePhotoStep(
  identifier: string,
  attachments: ChatAttachment[]
): Promise<PhotoAcceptance> {
  const { job, driver } = await getActiveJob(identifier);
  setContext({ jobId: job.jobId });

  const state = job.currentState as WorkflowState;
  if (!PHOTO_STATES.has(state)) {
    throw new ValidationError("A photo is not expected at the current workflow step.");
  }
  if (!attachments.length) throw new ValidationError("Please attach at least one image.");
  if (state === WorkflowState.WAITING_LOADED_PHOTO && attachments.length > 2) {
    throw new ValidationError("Proof Of Van Loaded accepts 1 or 2 photos at this step.");
  }

  const evidenceType = PHOTO_FOLDER[state];
  const actor = driver.email || driver.chatUserName;

  // Metadata-only validation. Throws before anything is persisted if the attachment can
  // never be processed, so the driver learns immediately instead of via a failure card.
  const { records, writes } = buildReceivedEvidence(job.jobId, actor, evidenceType, attachments);

  const from = job.currentState;
  job.currentState = nextAfterPhoto(state);

  // "Job start"/"job end" now track the actual physical move (arrival -> unloaded),
  // not the administrative button-tapping around it -- set once, on the photo that
  // marks each boundary, not overwritten on a later redo of the same step.
  const now = new Date().toISOString();
  if (evidenceType === "Arrival" && !job.actualStart) job.actualStart = now;
  if (evidenceType === "EmptyVan" && !job.actualFinish) job.actualFinish = now;

  const extras: SheetWrite[] = [
    ...writes,
    driverFlowWrite({
      jobId: job.jobId,
      driver: actor,
      field: `${evidenceType} Photo`,
      value: `${records.length} image(s) received; processing`,
      state: job.currentState
    })
  ];

  // Evidence rows, the driver-flow row, the booking row, the workflow row and the
  // activity row are one batchUpdate. After this returns, the photo is recoverable even
  // if the process dies on the next line.
  await saveJob(job, driver, `PHOTO_${evidenceType.toUpperCase()}_RECEIVED`, from, `${records.length} file(s)`, extras);

  const results = await enqueueAll(
    records.map(record => ({
      type: "PROCESS_JOB_IMAGE",
      evidenceId: record.evidenceId,
      jobId: job.jobId
    }) satisfies ProcessJobImageTask)
  );
  const degraded = results.some(result => !result.queued);
  if (degraded) {
    log.warn("evidence queued to reaper fallback", { job_id: job.jobId, evidence: records.length });
  }

  return { job, accepted: records, degraded };
}

/**
 * Driver-initiated retry of failed evidence. Resets the attempt budget and re-queues.
 * Used by the RETRY button on the failure card.
 */
export async function retryFailedEvidence(jobId: string, identifier: string): Promise<Job> {
  const { job, driver } = await getJobForDriver(jobId, identifier, { fresh: true });
  const failed = (await listEvidenceForJob(jobId)).filter(record => record.status === EvidenceStatus.FAILED);
  if (!failed.length) throw new ValidationError("There is no failed photo to retry on this job.");

  const requeued = failed.map(markRequeued);
  await commitWrites([
    ...requeued.map(evidenceWrite),
    activityWrite({
      jobId,
      driver: driver.email || driver.chatUserName,
      action: "EVIDENCE_RETRY_REQUESTED",
      fromState: job.currentState,
      toState: job.currentState,
      detail: failed.map(record => record.evidenceId).join(", ")
    })
  ]);

  await enqueueAll(
    requeued.map(record => ({
      type: "PROCESS_JOB_IMAGE",
      evidenceId: record.evidenceId,
      jobId
    }) satisfies ProcessJobImageTask),
    // Fresh dedupe id: the original task name is spent.
    {}
  ).catch(() => undefined);

  return job;
}

/**
 * Sends the driver back to a photo step so they can re-upload evidence that failed
 * permanently (expired Chat media, corrupt file). The failed records stay on the sheet
 * as an audit record of the attempt.
 */
export async function reopenPhotoStep(jobId: string, identifier: string, evidenceType: EvidenceType): Promise<Job> {
  const { job, driver } = await getJobForDriver(jobId, identifier, { fresh: true });
  const target = Object.entries(PHOTO_FOLDER).find(([, type]) => type === evidenceType)?.[0];
  if (!target) throw new ValidationError(`Unknown evidence type: ${evidenceType}`);

  const from = job.currentState;
  job.currentState = target;
  return saveJob(job, driver, "PHOTO_STEP_REOPENED", from, evidenceType);
}

export async function getActiveJob(identifier: string) {
  // No Calendar sync here: mid-workflow steps only ever read state that Sheets
  // already holds. fresh: true because a photo upload is a read-modify-write, exactly
  // like a card click — a cached snapshot could predate a step the driver just did
  // seconds earlier and silently overwrite it on save.
  const { job, driver } = await getNextJobForDriver(identifier, { fresh: true });
  if (!job || job.status !== "IN_PROGRESS") {
    throw new ValidationError("You do not have an active job. Type 'Next Job' to get your next job.");
  }
  return { job, driver };
}

export async function handleAction(
  action: string,
  jobId: string,
  identifier: string,
  input: Record<string, string[]>
): Promise<Job> {
  setContext({ jobId });
  if (action === "START_JOB") return beginJob(jobId, identifier);

  // fresh: true — every case below reads job, mutates a few fields, and writes the
  // whole row back. A cached read here can start from a snapshot taken before the
  // driver's previous step (seconds earlier, well inside the Sheets cache TTL)
  // finished writing, and silently clobber that step's change when this one saves.
  const { job, driver } = await getJobForDriver(jobId, identifier, { fresh: true });
  const actor = driver.email || driver.chatUserName;

  switch (action) {
    case "FINISH_MOVE": {
      assertState(job.currentState, WorkflowState.IN_PROGRESS);
      const from = job.currentState;
      job.currentState = WorkflowState.WAITING_EXTRA_CHARGES;
      return saveJob(job, driver, action, from);
    }

    case "SUBMIT_EXTRA_CHARGES": {
      assertState(job.currentState, WorkflowState.WAITING_EXTRA_CHARGES);
      const values = validateExtraCharges(input.extra_charges ?? []);
      job.extraCharges = values;
      const from = job.currentState;

      /*
       * §47: minimise typing. The overtime step used to run unconditionally, so a
       * driver who selected "No Extras Time" was still asked for overtime minutes and
       * had to type 0. Skip straight to totals unless extra time was actually claimed.
       */
      const claimsOvertime = values.includes(ExtraChargeType.EXTRA_TIME);
      if (!claimsOvertime) {
        job.overtimeMinutes = 0;
        job.overtimeCharge = 0;
      }
      job.currentState = claimsOvertime ? WorkflowState.WAITING_OVERTIME : WorkflowState.WAITING_TOTAL_CHARGES;

      return saveJob(job, driver, action, from, values.join(", "), [
        driverFlowWrite({
          jobId, driver: actor, field: "Any Extra charges", value: values.join(", "), state: job.currentState
        })
      ]);
    }

    case "SUBMIT_OVERTIME": {
      assertState(job.currentState, WorkflowState.WAITING_OVERTIME);
      const minutes = validateMinutes(input.overtime_minutes?.[0] ?? "");
      job.overtimeMinutes = minutes;
      const chargeableMinutes = Math.max(0, minutes - env.overtimeGraceMinutes);
      job.overtimeCharge =
        chargeableMinutes === 0 ? 0 : Math.ceil(chargeableMinutes / 30) * env.overtimeRatePer30Minutes;
      const from = job.currentState;
      job.currentState = WorkflowState.WAITING_TOTAL_CHARGES;
      return saveJob(job, driver, action, from, `${minutes} minutes`, [
        driverFlowWrite({
          jobId, driver: actor, field: "Over Time Charges",
          value: `${minutes} min / ${formatPounds(job.overtimeCharge)}`, state: job.currentState
        })
      ]);
    }

    case "SUBMIT_TOTAL_CHARGES": {
      assertState(job.currentState, WorkflowState.WAITING_TOTAL_CHARGES);
      const total = validateCurrency(input.total_charges?.[0] ?? "");
      job.totalCharges = total;
      const suggested = suggestedTotal(job);
      const from = job.currentState;
      job.currentState = WorkflowState.WAITING_PAYMENT;
      // Exact integer comparison in pence. `Math.abs(a - b) >= 0.01` was an epsilon
      // test standing in for equality, which is not a correctness argument for money.
      const mismatch = equalPence(fromPounds(total), fromPounds(suggested))
        ? formatPounds(total)
        : `Entered ${formatPounds(total)}; suggested ${formatPounds(suggested)}`;
      return saveJob(job, driver, action, from, mismatch, [
        driverFlowWrite({ jobId, driver: actor, field: "Total Charges", value: formatPounds(total), state: job.currentState })
      ]);
    }

    case "SUBMIT_PAYMENT": {
      assertState(job.currentState, WorkflowState.WAITING_PAYMENT);
      const method = validatePaymentMethod(input.payment_method?.[0] ?? "");
      job.paymentMethod = method;
      job.paymentStatus = method === "Invoice" ? "Outstanding" : "Recorded";
      const from = job.currentState;
      // The second issues checkpoint sits right BEFORE the Empty Van photo now, not
      // after it -- ISSUES_NONE (or an inline detour's resume) is what actually gets
      // the driver to WAITING_EMPTY_VAN_PHOTO from here.
      job.currentState = WorkflowState.WAITING_EMPTY_VAN_ISSUES_CHECK;
      return saveJob(job, driver, action, from, method, [
        paymentWrite({ jobId, driver: actor, method, amount: job.totalCharges, status: job.paymentStatus }),
        driverFlowWrite({ jobId, driver: actor, field: "Payment Method", value: method, state: job.currentState })
      ]);
    }

    case "SUBMIT_CLIENT_DETAILS": {
      assertState(job.currentState, WorkflowState.WAITING_CLIENT_DETAILS);
      const details = validateClientDetails(input.client_name_postcode?.[0] ?? "");
      job.clientNamePostcode = details;
      const from = job.currentState;
      job.currentState = WorkflowState.WAITING_CLIENT_CONFIRMATION;
      return saveJob(job, driver, action, from, details, [
        driverFlowWrite({
          jobId, driver: actor, field: "Client Name Vs Postcode", value: details, state: job.currentState
        })
      ]);
    }

    case "SEND_ON_MY_WAY_MESSAGE": {
      assertState(job.currentState, WorkflowState.WAITING_ON_MY_WAY_MESSAGE);
      const from = job.currentState;
      const template = await getSetting("JOB_STARTED_MESSAGE_TEXT", JOB_STARTED_MESSAGE_TEMPLATE);
      const extras: SheetWrite[] = [];

      // Each channel is attempted and recorded independently -- one failing must never
      // block the other or block the driver from moving on to the Arrival step. Only a
      // channel that actually had somewhere to go gets a row at all (mirrors the
      // no-target/not-configured no-ops already built into the send functions
      // themselves), so this never writes a false "Sent" the way the old always-write
      // background task once did.
      if (job.customerEmail) {
        try {
          await sendJobStartedEmail(job, template, driver);
          extras.push(activityWrite({
            jobId, driver: actor, action: "CLIENT_START_EMAIL_SENT", fromState: from, toState: from, detail: job.customerEmail
          }));
        } catch (error) {
          extras.push(activityWrite({
            jobId, driver: actor, action: "CLIENT_START_EMAIL_FAILED", fromState: from, toState: from,
            detail: error instanceof Error ? error.message : String(error)
          }));
        }
      }
      if (job.customerPhone && env.firetextApiKey && env.firetextSenderId) {
        try {
          await sendJobStartedSms(job, template, driver);
          extras.push(activityWrite({
            jobId, driver: actor, action: "CLIENT_START_SMS_SENT", fromState: from, toState: from, detail: job.customerPhone
          }));
        } catch (error) {
          extras.push(activityWrite({
            jobId, driver: actor, action: "CLIENT_START_SMS_FAILED", fromState: from, toState: from,
            detail: error instanceof Error ? error.message : String(error)
          }));
        }
      }

      job.currentState = WorkflowState.WAITING_ARRIVAL_PHOTO;
      return saveJob(job, driver, action, from, undefined, extras);
    }

    case "ISSUES_NONE":
    case "ISSUES_YES": {
      const from = job.currentState as WorkflowState;
      const noneTarget: Partial<Record<WorkflowState, WorkflowState>> = {
        [WorkflowState.WAITING_ARRIVAL_ISSUES_CHECK]: WorkflowState.WAITING_LOADED_PHOTO,
        [WorkflowState.WAITING_EMPTY_VAN_ISSUES_CHECK]: WorkflowState.WAITING_EMPTY_VAN_PHOTO
      };
      const yesTarget: Partial<Record<WorkflowState, WorkflowState>> = {
        [WorkflowState.WAITING_ARRIVAL_ISSUES_CHECK]: WorkflowState.WAITING_ARRIVAL_ISSUES_CHOICE,
        [WorkflowState.WAITING_EMPTY_VAN_ISSUES_CHECK]: WorkflowState.WAITING_EMPTY_VAN_ISSUES_CHOICE
      };
      const target = (action === "ISSUES_NONE" ? noneTarget : yesTarget)[from];
      if (!target) throw new ValidationError(`This action is not valid at the current step (${from}).`);
      job.currentState = target;
      return saveJob(job, driver, action, from);
    }

    case "REVIEW_NONE":
    case "REVIEW_YES": {
      assertState(job.currentState, WorkflowState.WAITING_REVIEW_CHECK);
      const from = job.currentState;
      job.currentState = action === "REVIEW_YES" ? WorkflowState.WAITING_REVIEW_SEND : WorkflowState.READY_TO_COMPLETE;
      return saveJob(job, driver, action, from);
    }

    case "SEND_REVIEW_EMAIL": {
      assertState(job.currentState, WorkflowState.WAITING_REVIEW_SEND);
      const from = job.currentState;
      const template = await getSetting("REVIEW_REQUEST_EMAIL_TEXT", REVIEW_REQUEST_EMAIL_TEMPLATE);
      const extras: SheetWrite[] = [];
      if (job.customerEmail) {
        try {
          await sendReviewRequestEmail(job, template);
          extras.push(activityWrite({
            jobId, driver: actor, action: "CLIENT_REVIEW_EMAIL_SENT", fromState: from, toState: from, detail: job.customerEmail
          }));
        } catch (error) {
          extras.push(activityWrite({
            jobId, driver: actor, action: "CLIENT_REVIEW_EMAIL_FAILED", fromState: from, toState: from,
            detail: error instanceof Error ? error.message : String(error)
          }));
        }
      }
      job.currentState = WorkflowState.READY_TO_COMPLETE;
      return saveJob(job, driver, action, from, undefined, extras);
    }

    case "GO_BACK": {
      const from = job.currentState;
      const target = BACK_TARGET[from as WorkflowState];
      if (!target) throw new ValidationError("There's no previous step to go back to here.");
      job.currentState = target;
      return saveJob(job, driver, action, from);
    }

    case "COMPLETE_JOB": {
      assertState(job.currentState, WorkflowState.READY_TO_COMPLETE);
      await assertCompletionGate(jobId, job);
      return completeJob(jobId, identifier);
    }

    default:
      throw new ValidationError(`Unknown action: ${action}`);
  }
}

/** BACK button targets for the data-entry steps -- lets a driver who mis-typed
 *  something return and redo it, rather than being stuck once a step is submitted.
 *  Total Charges' predecessor is ambiguous (Overtime only runs if extra time was
 *  claimed), so it always goes back to Extra Charges, the fixed branch point, rather
 *  than trying to reconstruct which path was actually taken. */
const BACK_TARGET: Partial<Record<WorkflowState, WorkflowState>> = {
  [WorkflowState.WAITING_EXTRA_CHARGES]: WorkflowState.IN_PROGRESS,
  [WorkflowState.WAITING_OVERTIME]: WorkflowState.WAITING_EXTRA_CHARGES,
  [WorkflowState.WAITING_TOTAL_CHARGES]: WorkflowState.WAITING_EXTRA_CHARGES,
  [WorkflowState.WAITING_PAYMENT]: WorkflowState.WAITING_TOTAL_CHARGES,
  [WorkflowState.WAITING_CLIENT_DETAILS]: WorkflowState.WAITING_EMPTY_VAN_PHOTO
};

export class SignatureAlreadyCapturedError extends Error {
  constructor() {
    super("This job's signature has already been captured.");
    this.name = "SignatureAlreadyCapturedError";
  }
}

/**
 * Records a customer's hand-drawn signature, submitted from their own device via the
 * signature-pad link (see chat/signature.routes.ts) rather than from the driver's Chat
 * session. There is no Chat identity here — the "driver" for the audit trail is whoever
 * the job is assigned to.
 */
export async function submitDrawnSignature(
  jobId: string,
  customerName: string,
  signature: { fileId: string; fileUrl: string }
): Promise<Job> {
  const job = await getJob(jobId, 0);
  if (!job) throw new ValidationError(`Job ${jobId} was not found.`);
  if (job.currentState !== WorkflowState.WAITING_CLIENT_CONFIRMATION) {
    // The customer's device double-submitted, or the link was reopened after the driver
    // already moved on. Treat as already-done rather than erroring.
    throw new SignatureAlreadyCapturedError();
  }

  const name = customerName.trim() || "Customer";
  const actor = job.driverInitials || "customer device";
  job.clientConfirmedBy = name;
  job.updatedAt = new Date().toISOString();
  const from = job.currentState;
  job.currentState = WorkflowState.WAITING_REVIEW_CHECK;

  await commitWrites([
    jobWrite(job),
    workflowWrite(job.jobId, actor, job.currentState),
    signatureWrite({
      jobId, driver: actor, customerName: name, confirmationText: signature.fileUrl,
      mode: "Drawn signature (customer device)"
    }),
    driverFlowWrite({
      jobId, driver: actor, field: "Client Signature", value: `${name} — signed`, state: job.currentState
    }),
    activityWrite({
      jobId, driver: actor, action: "SUBMIT_CLIENT_CONFIRMATION", fromState: from, toState: job.currentState, detail: name
    })
  ]);

  return job;
}

/**
 * Thrown when the only thing standing between the driver and completion is background
 * work that has not finished yet. Distinct from ValidationError so the UI can offer
 * "wait and retry" rather than "you did something wrong".
 */
export class EvidencePendingError extends Error {
  constructor(message: string, readonly pending: string[]) {
    super(message);
    this.name = "EvidencePendingError";
  }
}

export class EvidenceFailedError extends Error {
  constructor(message: string, readonly failedTypes: EvidenceType[]) {
    super(message);
    this.name = "EvidenceFailedError";
  }
}

const REQUIRED_EVIDENCE: Array<{ type: EvidenceType; label: string; minimum: number }> = [
  { type: "Arrival", label: "arrival photo", minimum: 1 },
  { type: "VanLoaded", label: "van-loaded photo", minimum: 1 },
  { type: "EmptyVan", label: "empty-van photo", minimum: 1 }
];

/**
 * The guarantee that makes the async architecture safe.
 *
 * Receiving an attachment never satisfies a requirement — only evidence that reached
 * COMPLETED does, which means the file is verifiably in Drive with a recorded URL. The
 * three failure modes are reported separately so the driver gets an actionable message:
 *
 *   never uploaded   -> ValidationError    "missing X"
 *   still processing -> EvidencePendingError "wait a moment"
 *   failed           -> EvidenceFailedError  "retry / re-upload"
 */
async function assertCompletionGate(jobId: string, job: Job): Promise<void> {
  const { completed, pending, failed, hasSignature } = await readEvidenceSummary(jobId);

  const missing: string[] = [];
  const stillProcessing: string[] = [];
  const permanentlyFailed: EvidenceType[] = [];

  if (!job.actualStart) missing.push("actual start timestamp");

  for (const requirement of REQUIRED_EVIDENCE) {
    const done = completed[requirement.type] ?? 0;
    if (done >= requirement.minimum) continue;

    const inFlight = pending[requirement.type] ?? 0;
    const broken = failed[requirement.type] ?? 0;

    if (inFlight > 0) stillProcessing.push(requirement.label);
    else if (broken > 0) permanentlyFailed.push(requirement.type);
    else missing.push(requirement.label);
  }

  if (!job.paymentMethod) missing.push("payment method");
  if (!job.clientNamePostcode) missing.push("client name/postcode");
  if (!hasSignature) missing.push("client confirmation");

  // Order matters: a hard-missing step is the driver's problem and outranks anything
  // the backend is still doing.
  if (missing.length) {
    throw new ValidationError(`Cannot complete job. Missing: ${missing.join(", ")}.`);
  }
  if (permanentlyFailed.length) {
    throw new EvidenceFailedError(
      `We couldn't save your ${permanentlyFailed.map(labelFor).join(" and ")}.`,
      permanentlyFailed
    );
  }
  if (stillProcessing.length) {
    throw new EvidencePendingError(
      `We're still processing ${stillProcessing.length} required photo${stillProcessing.length > 1 ? "s" : ""}. ` +
        "Please wait a moment before completing this job.",
      stillProcessing
    );
  }
}

function labelFor(type: EvidenceType): string {
  return REQUIRED_EVIDENCE.find(requirement => requirement.type === type)?.label ?? type;
}
