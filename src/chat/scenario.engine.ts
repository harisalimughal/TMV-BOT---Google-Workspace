import {
  activityWrite, commitWrites, driverFlowWrite, getJob, getScenarioProgress, liabilityReportWrite,
  listEvidenceForJob, parkingLiabilityWrite, ScenarioProgressRecord, scenarioProgressWrite, SheetWrite,
  storageCheckInWrite, storageCheckOutWrite
} from "../google/sheets";
import { uploadEvidenceImage } from "../google/drive";
import { buildReceivedEvidence } from "../jobs/evidence.service";
import { ChatAttachment, EvidenceStatus, Job } from "../jobs/job.types";
import { enqueueAll } from "../queue/queue.service";
import { ProcessJobImageTask } from "../queue/queue.types";
import { ValidationError } from "../workflow/validation.engine";
import { ScenarioFieldSpec, ScenarioKey, ScenarioSpec, SCENARIOS } from "./scenario.spec";

// ---------------------------------------------------------------------------
// Step model
//
// A scenario walks: field 0, field 1, ..., field N-1 [-> a conditional notice if the
// field that was just submitted triggers one] -> photos -> signature -> done. Persisted
// as a single string on ScenarioProgressRecord.step: a plain field index ("0", "1", ...),
// "notice:<fieldIndex>" (the field just submitted, resumed from after acknowledging),
// "photos" or "photos:<resumeFieldIndex>" (see below), "signature", or "done".
//
// spec.photoAfterField (Check In / Check Out) moves the photo step to right after a
// specific field instead of the end, matching the client's form order — the remaining
// fields still need to run afterwards, so that case encodes the field index to resume
// at as "photos:<index>". A bare "photos" (every other scenario) means the photo step
// is the last thing before signature, nothing to resume.
// ---------------------------------------------------------------------------

export type ScenarioStepView =
  | { kind: "field"; field: ScenarioFieldSpec; fieldIndex: number }
  | { kind: "notice" }
  | { kind: "photos"; received: number }
  | { kind: "signature" }
  | { kind: "done" };

export function isPhotosStep(step: string): boolean {
  return step === "photos" || step.startsWith("photos:");
}

function nextFieldStep(spec: ScenarioSpec, fromFieldIndex: number): string {
  const submittedField = spec.fields[fromFieldIndex];
  const next = fromFieldIndex + 1;
  if (spec.photoAfterField && submittedField?.name === spec.photoAfterField) {
    return `photos:${next}`;
  }
  if (next < spec.fields.length) return String(next);
  // Reached the last field. If this scenario has a photoAfterField, its one photo step
  // already happened earlier (the branch above) — go straight to signature rather than
  // asking for photos a second time. Only a scenario with no photoAfterField collects
  // its photos here, at the end.
  return spec.photoAfterField ? (spec.hasSignature ? "signature" : "done") : "photos";
}

/** Step to move to once the photo step's CONTINUE is tapped: the field it was parked
 *  in front of (photoAfterField case), or signature/done if it was the final step. */
function afterPhotosStep(spec: ScenarioSpec, step: string): string {
  const resumeAt = step.startsWith("photos:") ? Number(step.slice("photos:".length)) : null;
  if (resumeAt !== null && resumeAt < spec.fields.length) return String(resumeAt);
  return spec.hasSignature ? "signature" : "done";
}

export async function countScenarioPhotos(jobId: string, folderKey: string): Promise<number> {
  const evidence = await listEvidenceForJob(jobId, 0);
  return evidence.filter(e => e.evidenceType === folderKey).length;
}

/** What card to show for a job's current position in a scenario. */
export async function describeStep(spec: ScenarioSpec, progress: ScenarioProgressRecord): Promise<ScenarioStepView> {
  const step = progress.step;
  if (isPhotosStep(step)) return { kind: "photos", received: await countScenarioPhotos(progress.jobId, spec.folderKey) };
  if (step === "signature") return { kind: "signature" };
  if (step === "done") return { kind: "done" };
  if (step.startsWith("notice:")) return { kind: "notice" };

  const fieldIndex = Math.min(Math.max(Number(step) || 0, 0), spec.fields.length - 1);
  return { kind: "field", field: spec.fields[fieldIndex], fieldIndex };
}

/** Starts (or restarts) a scenario from field 0. Safe to call again — a driver redoing
 *  a scenario just overwrites whatever progress was there before. */
export async function initScenario(
  scenario: ScenarioKey, jobId: string, driver: string, messageName: string
): Promise<ScenarioProgressRecord> {
  const spec = SCENARIOS[scenario];
  const record = { jobId, scenario, step: "0", fields: {}, messageName };
  await commitWrites([
    scenarioProgressWrite(record),
    activityWrite({ jobId, driver, action: `${scenario.toUpperCase()}_STARTED`, detail: spec.title })
  ]);
  return { ...record, updatedAt: new Date().toISOString() };
}

/**
 * Menu tap (or the signature card's implicit "come back to this") for a scenario:
 * resumes wherever the driver left off if it's still in progress, otherwise starts
 * fresh. A driver redoing an already-submitted scenario (step "done", or no row at
 * all) always gets a clean start rather than stale leftover field values.
 */
export async function resolveOrStartScenario(
  scenario: ScenarioKey, jobId: string, driver: string, messageName: string
): Promise<ScenarioProgressRecord> {
  const existing = await getScenarioProgress(jobId, scenario, 0);
  if (existing && existing.step !== "done") {
    const record = { jobId, scenario, step: existing.step, fields: existing.fields, messageName };
    await commitWrites([scenarioProgressWrite(record)]);
    return { ...record, updatedAt: new Date().toISOString() };
  }
  return initScenario(scenario, jobId, driver, messageName);
}

export async function submitScenarioField(
  scenario: ScenarioKey, jobId: string, fieldIndex: number, rawValues: string[], messageName: string
): Promise<ScenarioProgressRecord> {
  const spec = SCENARIOS[scenario];
  const field = spec.fields[fieldIndex];
  if (!field) throw new ValidationError("This step is no longer valid — tap Main Menu and try again.");

  const value = field.type === "multiselect"
    ? rawValues.map(v => v.trim()).filter(Boolean).join(" | ")
    : (rawValues[0] ?? "").trim();
  if (field.required && !value) throw new ValidationError(`${field.label} is required.`);

  const progress = await getScenarioProgress(jobId, scenario, 0);
  const fields = { ...(progress?.fields ?? {}), [field.name]: value };

  // A conditional notice (Liability Report's Overloading Liability Waiver) is shown
  // once, right after the field that triggers it, before moving on to the next field.
  const triggersNotice = spec.conditionalNotice?.field === field.name && spec.conditionalNotice.whenValue === value;
  const step = triggersNotice ? `notice:${fieldIndex}` : nextFieldStep(spec, fieldIndex);

  const record = { jobId, scenario, step, fields, messageName };
  await commitWrites([scenarioProgressWrite(record)]);
  return { ...record, updatedAt: new Date().toISOString() };
}

export async function acknowledgeScenarioNotice(
  scenario: ScenarioKey, jobId: string, messageName: string
): Promise<ScenarioProgressRecord> {
  const spec = SCENARIOS[scenario];
  const progress = await getScenarioProgress(jobId, scenario, 0);
  if (!progress || !progress.step.startsWith("notice:")) {
    throw new ValidationError("This step is no longer valid — tap Main Menu and try again.");
  }
  const fieldIndex = Number(progress.step.slice("notice:".length));
  const record = { jobId, scenario, step: nextFieldStep(spec, fieldIndex), fields: progress.fields, messageName };
  await commitWrites([scenarioProgressWrite(record)]);
  return { ...record, updatedAt: new Date().toISOString() };
}

/**
 * Accepts Chat-attached photos for whichever scenario a job is currently waiting on
 * one for. Mirrors workflow.engine.ts's handlePhotoStep: synchronous and
 * network-free — the RECEIVED evidence record and the background upload task are all
 * that happen here, the actual Drive upload is the queue's job.
 */
export async function receiveScenarioPhoto(
  scenario: ScenarioKey, job: Job, driverEmail: string, attachments: ChatAttachment[]
): Promise<{ received: number }> {
  const spec = SCENARIOS[scenario];
  const progress = await getScenarioProgress(job.jobId, scenario, 0);
  if (!progress || !isPhotosStep(progress.step)) {
    throw new ValidationError("This scenario isn't waiting on a photo right now. Tap Main Menu to check its current step.");
  }

  const existing = await countScenarioPhotos(job.jobId, spec.folderKey);
  const room = spec.photoMax - existing;
  if (room <= 0) {
    throw new ValidationError(`You've already sent the maximum of ${spec.photoMax} photo(s) — tap CONTINUE on the card above.`);
  }

  const { records, writes } = buildReceivedEvidence(job.jobId, driverEmail, spec.folderKey, attachments.slice(0, room));
  await commitWrites([
    ...writes,
    driverFlowWrite({
      jobId: job.jobId, driver: driverEmail, field: `${spec.title} photo`,
      value: `${records.length} image(s) received; processing`, state: progress.step
    })
  ]);
  await enqueueAll(
    records.map(r => ({ type: "PROCESS_JOB_IMAGE", evidenceId: r.evidenceId, jobId: job.jobId }) satisfies ProcessJobImageTask)
  );

  return { received: existing + records.length };
}

export async function continueFromScenarioPhotos(
  scenario: ScenarioKey, jobId: string, messageName: string
): Promise<ScenarioProgressRecord> {
  const spec = SCENARIOS[scenario];
  const progress = await getScenarioProgress(jobId, scenario, 0);
  if (!progress || !isPhotosStep(progress.step)) {
    throw new ValidationError("This step is no longer valid — tap Main Menu and try again.");
  }
  const received = await countScenarioPhotos(jobId, spec.folderKey);
  if (received < spec.photoMin) throw new ValidationError(`Attach at least ${spec.photoMin} photo(s) before continuing.`);

  const step = afterPhotosStep(spec, progress.step);
  const record = { jobId, scenario, step, fields: progress.fields, messageName };
  await commitWrites([scenarioProgressWrite(record)]);
  return { ...record, updatedAt: new Date().toISOString() };
}

function writeScenarioRow(
  spec: ScenarioSpec, jobId: string, driver: string, fields: Record<string, string>,
  photoUrls: string[], signatureUrl: string
): SheetWrite {
  switch (spec.key) {
    case "checkin":
      return storageCheckInWrite({
        jobId, driver, containerNumber: fields.container_number ?? "", clientName: fields.client_name ?? "",
        clientPhone: fields.client_phone ?? "", clientEmail: fields.client_email ?? "",
        clientPresent: fields.client_present ?? "", date: fields.date ?? "", photoUrls, signatureUrl
      });
    case "checkout":
      return storageCheckOutWrite({
        jobId, driver, containerNumber: fields.container_number ?? "", clientName: fields.client_name ?? "",
        clientEmail: fields.client_email ?? "", clientPresentAtDropoff: fields.client_present ?? "",
        date: fields.date ?? "", photoUrls, signatureUrl
      });
    case "parking":
      return parkingLiabilityWrite({
        jobId, driver, address: fields.address ?? "", clientFullName: fields.client_name ?? "", photoUrls, signatureUrl
      });
    case "liability":
      return liabilityReportWrite({
        jobId, driver, damageCategories: (fields.damage_categories ?? "").split(" | ").filter(Boolean), photoUrls, signatureUrl
      });
  }
}

/**
 * Finalizes a scenario once the customer/driver has signed — called from the sign-only
 * web route, not from Chat. Requires every photo sent for this scenario to have
 * finished its background Drive upload; if any are still in flight this throws rather
 * than writing an incomplete row, so the signer sees "wait a moment" instead of a
 * submission with missing photos.
 */
export async function finalizeScenario(
  scenario: ScenarioKey, jobId: string, signatureBuffer: Buffer
): Promise<{ photoUrls: string[]; messageName: string }> {
  const spec = SCENARIOS[scenario];
  const progress = await getScenarioProgress(jobId, scenario, 0);
  if (!progress || progress.step !== "signature") {
    throw new ValidationError("This scenario isn't ready to be signed off yet.");
  }

  const job = await getJob(jobId, 0);
  if (!job) throw new ValidationError(`Job ${jobId} was not found.`);

  const evidence = (await listEvidenceForJob(jobId, 0)).filter(e => e.evidenceType === spec.folderKey);
  const stillProcessing = evidence.filter(e => e.status === EvidenceStatus.RECEIVED || e.status === EvidenceStatus.PROCESSING);
  if (stillProcessing.length) {
    throw new ValidationError(`Still uploading ${stillProcessing.length} photo(s) — wait a few seconds and try again.`);
  }
  const failed = evidence.filter(e => e.status === EvidenceStatus.FAILED);
  if (failed.length) {
    throw new ValidationError(`${failed.length} photo(s) failed to upload. Go back to Chat, tap Main Menu, and redo this scenario.`);
  }
  const photoUrls = evidence.filter(e => e.status === EvidenceStatus.COMPLETED).map(e => e.driveUrl);
  if (photoUrls.length < spec.photoMin) {
    throw new ValidationError("No completed photos were found for this scenario.");
  }

  const driver = job.driverInitials || "driver device";
  const sigFile = await uploadEvidenceImage(job, spec.folderKey, "sig", "signature.png", signatureBuffer, "image/png");

  await commitWrites([
    writeScenarioRow(spec, jobId, driver, progress.fields, photoUrls, sigFile.fileUrl),
    scenarioProgressWrite({ jobId, scenario, step: "done", fields: {}, messageName: "" }),
    driverFlowWrite({ jobId, driver, field: spec.title, value: "Submitted", state: job.currentState }),
    activityWrite({
      jobId, driver, action: `${spec.title.toUpperCase().replace(/\s+/g, "_")}_SUBMITTED`,
      fromState: job.currentState, toState: job.currentState, detail: `${photoUrls.length} photo(s)`
    })
  ]);

  return { photoUrls, messageName: progress.messageName };
}
