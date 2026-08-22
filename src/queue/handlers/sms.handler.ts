import { sendJobStartedSms } from "../../integrations/firetext";
import { activityWrite, commitWrites, exceptionWrite, getJob, listObjects, SHEETS } from "../../google/sheets";
import { log, setContext } from "../../utils/logger";
import { PermanentTaskError, SendJobStartedSmsTask } from "../queue.types";

/**
 * SEND_JOB_STARTED_SMS. Mirrors email.handler.ts exactly -- off the driver's critical
 * path, its own idempotency check against the activity log, permanent vs. retryable
 * failure split.
 */
export async function handleSendJobStartedSms(task: SendJobStartedSmsTask): Promise<void> {
  setContext({ jobId: task.jobId });

  const job = await getJob(task.jobId);
  if (!job) throw new PermanentTaskError(`Job ${task.jobId} was not found.`);
  if (!job.customerPhone) {
    log.info("no customer phone on job; nothing to text", { job_id: task.jobId });
    return;
  }

  if (await alreadySent(task.jobId)) {
    log.info("start SMS already sent; task is a no-op", { job_id: task.jobId });
    return;
  }

  try {
    await sendJobStartedSms(job);
    await commitWrites([
      activityWrite({
        jobId: job.jobId,
        driver: task.driverEmail,
        action: "CLIENT_START_SMS_SENT",
        fromState: job.currentState,
        toState: job.currentState,
        detail: job.customerPhone
      })
    ]);
  } catch (error) {
    // A bad number or unauthorized key is permanent; a timeout or 5xx is not.
    const message = error instanceof Error ? error.message : String(error);
    const permanent = /destination number|auth|401|403/i.test(message);
    await commitWrites([
      activityWrite({
        jobId: job.jobId,
        driver: task.driverEmail,
        action: "CLIENT_START_SMS_FAILED",
        fromState: job.currentState,
        toState: job.currentState,
        detail: message
      }),
      ...(permanent ? [exceptionWrite({ jobId: job.jobId, type: "START_SMS_FAILED", detail: message })] : [])
    ]).catch(logError => log.error("failed to record SMS outcome", logError, { job_id: job.jobId }));

    if (permanent) throw new PermanentTaskError(message);
    throw error;
  }
}

async function alreadySent(jobId: string): Promise<boolean> {
  const rows = await listObjects(SHEETS.ACTIVITY, 0);
  return rows.some(row => row["Job ID"] === jobId && row["Action"] === "CLIENT_START_SMS_SENT");
}
