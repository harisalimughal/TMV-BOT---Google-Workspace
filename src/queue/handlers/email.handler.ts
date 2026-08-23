import { sendJobStartedEmail } from "../../google/gmail";
import { JOB_STARTED_MESSAGE_TEMPLATE } from "../../notifications/message";
import { activityWrite, commitWrites, exceptionWrite, getJob, getSetting, listObjects, SHEETS } from "../../google/sheets";
import { log, setContext } from "../../utils/logger";
import { PermanentTaskError, SendJobStartedEmailTask } from "../queue.types";

/**
 * SEND_JOB_STARTED_EMAIL.
 *
 * Previously inline in startJob(), where it added up to 5s to the driver's first tap and
 * then spent two more Sheets round trips recording its own outcome.
 */
export async function handleSendJobStartedEmail(task: SendJobStartedEmailTask): Promise<void> {
  setContext({ jobId: task.jobId });

  const job = await getJob(task.jobId);
  if (!job) throw new PermanentTaskError(`Job ${task.jobId} was not found.`);
  if (!job.customerEmail) {
    log.info("no customer email on job; nothing to send", { job_id: task.jobId });
    return;
  }

  // Idempotency: Cloud Tasks dedupes on the task name, but a reaper re-drive or a
  // manual replay would not. The activity log is the durable record of "already sent".
  if (await alreadySent(task.jobId)) {
    log.info("start email already sent; task is a no-op", { job_id: task.jobId });
    return;
  }

  try {
    const template = await getSetting("JOB_STARTED_MESSAGE_TEXT", JOB_STARTED_MESSAGE_TEMPLATE);
    await sendJobStartedEmail(job, template);
    await commitWrites([
      activityWrite({
        jobId: job.jobId,
        driver: task.driverEmail,
        action: "CLIENT_START_EMAIL_SENT",
        fromState: job.currentState,
        toState: job.currentState,
        detail: job.customerEmail
      })
    ]);
  } catch (error) {
    // A bad address is permanent; a 5xx or timeout is not. Cloud Tasks retries the latter.
    const message = error instanceof Error ? error.message : String(error);
    const permanent = /invalid|not found|400|address/i.test(message);
    await commitWrites([
      activityWrite({
        jobId: job.jobId,
        driver: task.driverEmail,
        action: "CLIENT_START_EMAIL_FAILED",
        fromState: job.currentState,
        toState: job.currentState,
        detail: message
      }),
      ...(permanent ? [exceptionWrite({ jobId: job.jobId, type: "START_EMAIL_FAILED", detail: message })] : [])
    ]).catch(logError => log.error("failed to record email outcome", logError, { job_id: job.jobId }));

    if (permanent) throw new PermanentTaskError(message);
    throw error;
  }
}

async function alreadySent(jobId: string): Promise<boolean> {
  const rows = await listObjects(SHEETS.ACTIVITY, 0);
  return rows.some(row => row["Job ID"] === jobId && row["Action"] === "CLIENT_START_EMAIL_SENT");
}
