import { listObjects, SHEETS } from "../../../src/google/sheets";
import { ExtraChargeType } from "../../../src/jobs/job.types";
import { env } from "../../../src/config/env";
import { EvidenceStatus, EvidenceType } from "../../../src/db/mongo";
import { fromPounds, Pence, pence } from "../../../src/utils/money";
import { MongoDataset } from "../read/mongo-reader";
import { reconcileFinancials } from "./finance";
import { calculateDelayMinutes, calculateMinutes, getDelayBand, isTimingTrustworthy, toUtcIso } from "./timezone";
import { ActivityEntry, EvidenceCategory, EvidenceState, JobException, NormalizedEvidenceItem, NormalizedJob } from "./types";

/**
 * Replaces normalize.ts as this dashboard's Job -> NormalizedJob builder, sourced from
 * Mongo (read/mongo-reader.ts) instead of Sheets. Produces the exact same NormalizedJob
 * shape normalize.ts did, so every route/page consuming it (jobs, finance, exceptions,
 * activity, summary) needed only a source swap, not a rewrite -- see jobs.route.ts etc.
 *
 * Much simpler than the Sheets version: Mongo's Job/EvidenceRecord/ActivityDoc are
 * already typed objects, not raw spreadsheet row strings, so there's no column-mapping
 * or defensive string-parsing to do. Driver profile (name/email) still comes from the
 * Sheets Drivers tab -- that roster stays admin-managed via Sheets by design (see
 * README-level notes on this decision); only job/evidence/activity data moved to Mongo.
 */
export async function normalizeMongoDataset(dataset: MongoDataset): Promise<NormalizedJob[]> {
  const driverRows = await listObjects(SHEETS.DRIVERS);
  const driversByInitials = new Map<string, Record<string, string>>();
  for (const d of driverRows) {
    const init = String(d["Initials"] || "").trim().toUpperCase();
    if (init) driversByInitials.set(init, d);
  }

  const evidenceByJob = new Map<string, typeof dataset.evidence>();
  for (const e of dataset.evidence) {
    const list = evidenceByJob.get(e.jobId) || [];
    list.push(e);
    evidenceByJob.set(e.jobId, list);
  }

  const scenariosByJob = new Map<string, typeof dataset.scenarioSubmissions>();
  for (const s of dataset.scenarioSubmissions) {
    const list = scenariosByJob.get(s.jobId) || [];
    list.push(s);
    scenariosByJob.set(s.jobId, list);
  }

  const activityByJob = new Map<string, ActivityEntry[]>();
  for (const a of dataset.activity) {
    const list = activityByJob.get(a.jobId) || [];
    list.push({
      timestamp: toUtcIso(a.timestamp),
      driver: a.driver || "Not recorded",
      action: a.action || "",
      fromState: a.fromState || undefined,
      toState: a.toState || undefined,
      detail: a.detail || undefined
    });
    activityByJob.set(a.jobId, list);
  }

  const exceptionsByJob = new Map<string, JobException[]>();
  for (const ex of dataset.exceptions) {
    const list = exceptionsByJob.get(ex.jobId) || [];
    list.push({ type: ex.type || "EXCEPTION", detail: ex.detail || "", timestamp: toUtcIso(ex.timestamp) });
    exceptionsByJob.set(ex.jobId, list);
  }

  const normalizedJobs: NormalizedJob[] = [];
  const seenJobIds = new Set<string>();

  for (const job of dataset.jobs) {
    const jobId = job.jobId;
    if (!jobId) continue;

    const isDuplicate = seenJobIds.has(jobId);
    seenJobIds.add(jobId);

    const driverInitials = (job.driverInitials || "").trim().toUpperCase();
    const driverDoc = driverInitials ? driversByInitials.get(driverInitials) : undefined;
    const driverName = driverDoc ? driverDoc["Full Name"] : (driverInitials || "Unassigned");
    const driverEmail = driverDoc ? driverDoc["Email"] : undefined;

    const bookedStart = toUtcIso(job.bookedStart);
    const bookedFinish = toUtcIso(job.bookedFinish);
    const actualStart = job.actualStart ? toUtcIso(job.actualStart) : undefined;
    const actualFinish = job.actualFinish ? toUtcIso(job.actualFinish) : undefined;

    const bookedMinutes = job.bookedMinutes || calculateMinutes(bookedStart, bookedFinish);
    const actualMinutes = job.actualMinutes || (actualStart && actualFinish ? calculateMinutes(actualStart, actualFinish) : undefined);

    const delayMinutes = calculateDelayMinutes(bookedStart, actualStart);
    const delayBand = getDelayBand(delayMinutes);
    const timingTrustworthy = isTimingTrustworthy(job.bookedStart) && isTimingTrustworthy(job.actualStart);

    const basePrice = safePence(job.basePrice);
    // Congestion/tunnel only -- overtimeCharge is tracked as its own NormalizedJob
    // field, matching workflow.engine.ts's split between extraChargeAmount()'s
    // congestion+tunnel component and the separately-stored overtime charge.
    let extraChargesPounds = 0;
    if (job.extraCharges?.includes(ExtraChargeType.CONGESTION)) extraChargesPounds += env.congestionCharge;
    if (job.extraCharges?.includes(ExtraChargeType.TUNNEL)) extraChargesPounds += env.tunnelCharge;
    const extraCharges = extraChargesPounds > 0 ? fromPounds(extraChargesPounds) : pence(0);
    const overtimeMinutes = job.overtimeMinutes || 0;
    const overtimeCharge = safePence(job.overtimeCharge);
    const totalCharges = safePence(job.totalCharges);
    const reconciled = reconcileFinancials(basePrice, extraCharges, overtimeCharge, totalCharges);

    const status = job.status;
    const currentState = job.currentState || status;

    const jobEvidence = evidenceByJob.get(jobId) || [];
    const jobScenarios = scenariosByJob.get(jobId) || [];
    const { completeness, items } = classifyEvidence(jobId, jobEvidence, job.signatureUrl, jobScenarios);

    const activity = activityByJob.get(jobId) || [];
    const exceptions = exceptionsByJob.get(jobId) || [];

    if (isDuplicate) {
      exceptions.push({ type: "DUPLICATE_JOB_ID", detail: `Job ID "${jobId}" appears more than once.`, timestamp: new Date().toISOString() });
    }
    if (!timingTrustworthy) {
      exceptions.push({
        type: "TIMING_UNTRUSTWORTHY",
        detail: "Recorded start timestamp has non-London timezone offset (+05:00); timing figures are unreliable",
        timestamp: new Date().toISOString()
      });
    }
    if (!reconciled && status === "COMPLETED") {
      exceptions.push({
        type: "FINANCE_UNRECONCILED",
        detail: "Sum of Base Price, Extra Charges and Overtime does not equal Total Charges",
        timestamp: new Date().toISOString()
      });
    }

    const workflowCompletionPct = calculateWorkflowCompletionPct(status, completeness, Boolean(job.signatureUrl));

    normalizedJobs.push({
      jobId,
      calendarEventId: job.calendarEventId || "",
      bookedStart, bookedFinish, actualStart, actualFinish,
      bookedMinutes, actualMinutes, delayMinutes, delayBand, timingTrustworthy,
      customerName: job.customerName || "Not recorded",
      customerEmail: job.customerEmail || undefined,
      customerPhone: job.customerPhone || undefined,
      pickup: job.pickup || "Not recorded",
      dropoff: job.dropoff || "Not recorded",
      crewSize: job.crewSize || 1,
      driverInitials, driverName, driverEmail,
      status, currentState, workflowCompletionPct,
      basePrice, extraCharges, overtimeMinutes, overtimeCharge, totalCharges, reconciled,
      paymentMethod: job.paymentMethod || "Not recorded",
      paymentStatus: job.paymentStatus || "Not recorded",
      paidOnline: Boolean(job.paidOnline),
      evidenceCompleteness: completeness,
      evidenceItems: items,
      clientConfirmedName: job.clientConfirmedBy || undefined,
      // Cloudinary URLs are plain public image URLs -- no authenticated proxy needed,
      // unlike the old Drive-backed thumbProxyUrl.
      signatureUrl: job.signatureUrl || undefined,
      driveFolderId: undefined,
      driveFolderUrl: undefined,
      activity: activity.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      exceptions,
      created: toUtcIso(job.createdAt),
      updated: toUtcIso(job.updatedAt)
    });
  }

  return normalizedJobs;
}

function safePence(value: unknown): Pence {
  if (value === undefined || value === null || value === "") return pence(0);
  try {
    return fromPounds(value as number | string);
  } catch {
    return pence(0);
  }
}

const MANDATORY_PHOTO_TYPES: Array<{ type: EvidenceType; category: EvidenceCategory }> = [
  { type: "Arrival", category: "Arrival" },
  { type: "VanLoaded", category: "VanLoaded" },
  { type: "EmptyVan", category: "EmptyVan" }
];

const SCENARIO_LABEL: Record<string, string> = {
  checkin: "Check In", checkout: "Check Out", parking: "Parking Liability", liability: "Liability Report"
};

function classifyEvidence(
  jobId: string,
  evidenceRows: MongoDataset["evidence"],
  signatureUrl: string | undefined,
  scenarios: MongoDataset["scenarioSubmissions"]
): { completeness: NormalizedJob["evidenceCompleteness"]; items: NormalizedEvidenceItem[] } {
  const items: NormalizedEvidenceItem[] = [];

  const checkCategory = (type: EvidenceType, category: EvidenceCategory): EvidenceState => {
    const matching = evidenceRows.filter(e => e.evidenceType === type);
    if (!matching.length) return "MISSING";
    const latest = matching[matching.length - 1];

    if (latest.status === EvidenceStatus.COMPLETED && latest.cloudinaryUrl) {
      items.push({
        id: latest.evidenceId || `ev-${category}-${jobId}`,
        category, state: "COMPLETED",
        fileId: latest.cloudinaryPublicId,
        driveUrl: latest.cloudinaryUrl,
        thumbProxyUrl: latest.cloudinaryUrl,
        fileName: latest.fileName,
        contentType: latest.contentType,
        receivedAt: toUtcIso(latest.receivedAt),
        completedAt: toUtcIso(latest.processingCompletedAt),
        provenance: "recorded"
      });
      return "COMPLETED";
    }
    if (latest.status === EvidenceStatus.FAILED) {
      items.push({
        id: latest.evidenceId || `ev-${category}-${jobId}`,
        category, state: "FAILED",
        error: latest.lastError || "Photograph upload failed",
        receivedAt: toUtcIso(latest.receivedAt),
        provenance: "recorded"
      });
      return "FAILED";
    }
    items.push({
      id: latest.evidenceId || `ev-${category}-${jobId}`,
      category, state: "PROCESSING",
      receivedAt: toUtcIso(latest.receivedAt),
      provenance: "recorded"
    });
    return "PROCESSING";
  };

  const arrival = checkCategory("Arrival", "Arrival");
  const vanLoaded = checkCategory("VanLoaded", "VanLoaded");
  const emptyVan = checkCategory("EmptyVan", "EmptyVan");
  // "Organized" is a retired photo step (see workflow.states.ts) -- no job collects it
  // anymore, kept here only because NormalizedJob's shape still has the field.
  const organized: EvidenceState = "MISSING";

  let signature: EvidenceState = "MISSING";
  if (signatureUrl) {
    signature = "COMPLETED";
    items.push({
      id: `sig-${jobId}`,
      category: "Signature", state: "COMPLETED",
      driveUrl: signatureUrl,
      thumbProxyUrl: signatureUrl,
      provenance: "recorded"
    });
  }

  // Check In/Check Out/Parking Liability/Liability Report photos -- these never go
  // through the evidence collection (see tmv-pwa's scenario.service.ts), they're
  // uploaded straight to Cloudinary with their URLs stored on the submission doc. Adds
  // them as "Documents" category items so they're visible here too, not just their own
  // dedicated admin page (dashboard/server/routes/scenarios.route.ts).
  for (const submission of scenarios) {
    const label = SCENARIO_LABEL[submission.scenario] || submission.scenario;
    submission.photoUrls.forEach((url, index) => {
      items.push({
        id: `${submission.scenario}-photo-${index}-${jobId}`,
        category: "Documents", state: "COMPLETED",
        driveUrl: url, thumbProxyUrl: url,
        fileName: `${label} photo ${index + 1}`,
        receivedAt: toUtcIso(submission.submittedAt),
        completedAt: toUtcIso(submission.submittedAt),
        provenance: "recorded"
      });
    });
    if (submission.signatureUrl) {
      items.push({
        id: `${submission.scenario}-signature-${jobId}`,
        category: "Documents", state: "COMPLETED",
        driveUrl: submission.signatureUrl, thumbProxyUrl: submission.signatureUrl,
        fileName: `${label} signature`,
        receivedAt: toUtcIso(submission.submittedAt),
        completedAt: toUtcIso(submission.submittedAt),
        provenance: "recorded"
      });
    }
  }

  return { completeness: { arrival, vanLoaded, emptyVan, organized, signature }, items };
}

function calculateWorkflowCompletionPct(
  status: string,
  completeness: NormalizedJob["evidenceCompleteness"],
  hasSignature: boolean
): number {
  if (status === "COMPLETED") return 100;
  if (status === "CANCELLED") return 0;

  let score = 10;
  if (completeness.arrival === "COMPLETED") score += 22;
  if (completeness.vanLoaded === "COMPLETED") score += 23;
  if (completeness.emptyVan === "COMPLETED") score += 22;
  if (completeness.signature === "COMPLETED" || hasSignature) score += 23;

  return Math.min(score, 100);
}
