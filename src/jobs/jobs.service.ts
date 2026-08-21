import { DateTime } from "luxon";
import { env } from "../config/env";
import {
  activityWrite, commitWrites, getDriver, getJob, jobWrite, listJobs, SheetWrite, workflowWrite
} from "../google/sheets";
import { enqueue } from "../queue/queue.service";
import { SendJobStartedEmailTask } from "../queue/queue.types";
import { WorkflowState } from "../workflow/workflow.states";
import { DriverProfile, Job, JobStatus } from "./job.types";
import { syncTodayBookings } from "./booking.service";
import { log } from "../utils/logger";
import { withJobLock } from "../utils/lock";
import { ValidationError } from "../workflow/validation.engine";

export function driverIdentifier(email?: string, chatUserName?: string): string {
  return email?.trim() || chatUserName?.trim() || "";
}

export async function resolveDriver(identifier: string): Promise<DriverProfile> {
  if (!identifier) throw new Error("Google Chat did not provide a driver identity.");
  const profile = await getDriver(identifier);
  if (!profile) throw new Error(`Driver is not registered in the Drivers sheet: ${identifier}`);
  if (!profile.active) throw new Error("This driver account is inactive.");
  return profile;
}

function isToday(iso: string): boolean {
  if (!iso) return false;
  const dt = DateTime.fromISO(iso).setZone(env.timezone);
  return dt.hasSame(DateTime.now().setZone(env.timezone), "day");
}

// ---------------------------------------------------------------------------
// Calendar sync throttle
// ---------------------------------------------------------------------------

let lastSyncAt = 0;
let inFlightSync: Promise<unknown> | null = null;

/**
 * Calendar sync used to run on every single interaction, including photo uploads
 * and button clicks, which is the slowest thing the bot does and is never needed
 * mid-workflow. It is now throttled and single-flighted; Cloud Scheduler hitting
 * /internal/sync remains the primary path.
 */
async function syncIfStale(): Promise<void> {
  if (Date.now() - lastSyncAt < env.calendarSyncTtlMs) return;
  if (inFlightSync) {
    await inFlightSync.catch(() => undefined);
    return;
  }
  inFlightSync = syncTodayBookings()
    .then(jobs => {
      lastSyncAt = Date.now();
      log.debug("calendar sync completed", { synced: jobs.length });
    })
    .catch(error => {
      // A sync failure must not block a driver who already has jobs in Sheets.
      log.warn("calendar sync failed; serving from Sheets", { error: String(error) });
    })
    .finally(() => {
      inFlightSync = null;
    });
  await inFlightSync;
}

export function markSynced(): void {
  lastSyncAt = Date.now();
}

export interface NextJobOptions {
  /** Only the explicit "jobs" entry point needs fresh Calendar data. */
  sync?: boolean;
  /**
   * Bypasses the Bookings read cache. Every mid-workflow read-modify-write (a card
   * click, a photo upload) must set this — otherwise it can start from a snapshot
   * cached before an action just seconds earlier finished writing, and silently
   * clobber that write when it saves. Only a plain "jobs"/"resume" listing, which
   * never mutates anything, can afford the cached read.
   */
  fresh?: boolean;
}

export async function getNextJobForDriver(
  identifier: string,
  options: NextJobOptions = {}
): Promise<{ job: Job | null; driver: DriverProfile }> {
  if (options.sync) await syncIfStale();

  const [driver, jobs] = await Promise.all([resolveDriver(identifier), listJobs(options.fresh ? 0 : undefined)]);

  const active = jobs
    .filter(j => j.status === JobStatus.IN_PROGRESS && j.driverInitials === driver.initials)
    .sort((a, b) => a.bookedStart.localeCompare(b.bookedStart))[0];
  if (active) return { job: active, driver };

  const next =
    jobs
      .filter(j => isToday(j.bookedStart))
      .filter(j => j.status !== JobStatus.COMPLETED && j.status !== JobStatus.CANCELLED)
      .filter(j => !j.driverInitials || j.driverInitials === driver.initials)
      .sort((a, b) => a.bookedStart.localeCompare(b.bookedStart))[0] ?? null;

  return { job: next, driver };
}

/**
 * Fresh read of the driver's current/next job, used by the menu and by the standalone
 * Check In / Check Out / Parking Liability / Liability Report / Finish Job actions.
 * Always bypasses the cache: a mutation (Start Job, a scenario submit, Finish Job) may
 * have landed moments earlier, well inside the Sheets cache TTL — a stale read here
 * would resolve the wrong job or miss a status change that just happened.
 */
export async function getActiveJobForDriver(identifier: string): Promise<{ job: Job | null; driver: DriverProfile }> {
  return getNextJobForDriver(identifier, { fresh: true });
}

export interface JobLookupOptions {
  /** Bypasses the read cache. Required inside a lock, where a stale read defeats the guard. */
  fresh?: boolean;
}

export async function getJobForDriver(
  jobId: string,
  identifier: string,
  options: JobLookupOptions = {}
): Promise<{ job: Job; driver: DriverProfile }> {
  const [job, driver] = await Promise.all([getJob(jobId, options.fresh ? 0 : undefined), resolveDriver(identifier)]);
  if (!job) throw new Error(`Job ${jobId} was not found.`);
  if (job.driverInitials && job.driverInitials !== driver.initials && driver.role.toLowerCase() !== "manager") {
    throw new Error("This job is assigned to another driver.");
  }
  return { job, driver };
}

/**
 * Persists a workflow transition. The booking row, the workflow row, the activity
 * log entry and any step-specific rows all go out in one batched Sheets call
 * instead of the six round trips this used to take.
 */
export async function saveJob(
  job: Job,
  driver: DriverProfile,
  action: string,
  fromState: string,
  detail = "",
  extraWrites: SheetWrite[] = []
): Promise<Job> {
  job.updatedAt = new Date().toISOString();
  const actor = driver.email || driver.chatUserName;
  await commitWrites([
    jobWrite(job),
    workflowWrite(job.jobId, actor, job.currentState),
    ...extraWrites,
    activityWrite({ jobId: job.jobId, driver: actor, action, fromState, toState: job.currentState, detail })
  ]);
  return job;
}

export async function startJob(jobId: string, identifier: string): Promise<Job> {
  /*
   * The whole read/decide/write sequence runs under the job lock.
   *
   * The `actualStart` check alone was not sufficient: the Sheets mutex orders writes,
   * not reads, so two clicks milliseconds apart both read actualStart === "" and both
   * proceeded — two START_JOB rows with different timestamps (so "when did this job
   * start?" had two answers) and two customer emails. Mobile cards are very easy to
   * double-tap and there is no client-side debounce.
   */
  return withJobLock(jobId, async () => {
    // fresh: true bypasses the read cache so the guard sees the other click's write.
    const { job, driver } = await getJobForDriver(jobId, identifier, { fresh: true });

    if (job.status === JobStatus.COMPLETED) throw new ValidationError("This job is already completed.");

    if (job.actualStart) {
      log.info("start job ignored; already started", { job_id: job.jobId, started_at: job.actualStart });
      return job;
    }

    // §32: an unassigned booking must not be a free-for-all. First claim wins, and it
    // happens inside the lock so two drivers cannot both claim it.
    if (!job.driverInitials) {
      if (!driver.initials) {
        throw new ValidationError("Your driver record has no initials, so this job cannot be assigned to you.");
      }
      log.info("unassigned job claimed", { job_id: job.jobId, driver: driver.initials });
    }

    const from = job.currentState;
    const now = new Date().toISOString();

    job.actualStart = now;
    job.status = JobStatus.IN_PROGRESS;
    job.currentState = WorkflowState.WAITING_ARRIVAL_PHOTO;
    if (!job.driverInitials) job.driverInitials = driver.initials;

    // §P3-3: the Drive folder is created lazily by the image worker on the first
    // photo. START JOB used to walk Jobs/YYYY/MM/DD/Job_X — up to ten sequential
    // Drive calls — while the driver stood at the customer's door.
    await saveJob(job, driver, "START_JOB", from, `Server start timestamp ${now}`);

    // Was: await sendJobStartedEmail(job) plus two more commitWrites to record the
    // outcome, all on the driver's very first tap. Now queued.
    await enqueue({
      type: "SEND_JOB_STARTED_EMAIL",
      jobId: job.jobId,
      driverEmail: driver.email || driver.chatUserName
    } satisfies SendJobStartedEmailTask);

    return job;
  });
}

function delayStatus(bookedFinish: string, actualFinish: string): string {
  const booked = DateTime.fromISO(bookedFinish);
  const actual = DateTime.fromISO(actualFinish);
  const diff = Math.round(actual.diff(booked, "minutes").minutes);
  if (diff <= 0) return diff < 0 ? "Early" : "On Time";
  if (diff <= 15) return "Slight Delay";
  if (diff <= 30) return "Late";
  return "Very Late";
}

export async function completeJob(jobId: string, identifier: string): Promise<Job> {
  const { job, driver } = await getJobForDriver(jobId, identifier, { fresh: true });
  if (job.status === JobStatus.COMPLETED) return job;

  const from = job.currentState;
  const now = new Date().toISOString();
  job.actualFinish = now;
  // Finish Job (the standalone menu button) can complete a job that never ran Start
  // Job's workflow at all — e.g. one that only did Check In/Check Out — so actualStart
  // may still be blank here. Backfill it rather than feeding an invalid ISO string into
  // the diff below, which would silently write NaN into Actual Minutes.
  if (!job.actualStart) job.actualStart = now;
  job.actualMinutes = Math.max(
    0,
    Math.round(DateTime.fromISO(now).diff(DateTime.fromISO(job.actualStart), "minutes").minutes)
  );
  job.differenceMinutes = job.actualMinutes - job.bookedMinutes;
  job.delayStatus = delayStatus(job.bookedFinish, now);
  job.status = JobStatus.COMPLETED;
  job.currentState = WorkflowState.COMPLETED;
  return saveJob(job, driver, "COMPLETE_JOB", from, `Server finish timestamp ${now}`);
}
