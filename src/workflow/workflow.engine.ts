import { Job } from "../jobs/job.types";
import { completeJob, startJob } from "../jobs/jobs.service";

export async function beginJob(jobId: string, identifier: string): Promise<Job> {
  return startJob(jobId, identifier);
}

/**
 * Explicit "I'm done with this job" action from the menu's Finish Job button.
 * Deliberately no completion gate: different jobs need different combinations of the
 * scenario forms (Check In / Check Out / Parking Liability / Liability Report), so
 * "every scenario has run" is not a signal the bot can validate — it's a business
 * decision the driver makes by tapping Finish Job.
 */
export async function finishJob(jobId: string, identifier: string): Promise<Job> {
  return completeJob(jobId, identifier);
}
