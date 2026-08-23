import { sendJobStartedSms } from "../../integrations/firetext";
import { JOB_STARTED_MESSAGE_TEMPLATE } from "../../notifications/message";
import { activityWrite, commitWrites, exceptionWrite, getJob, getSetting, listObjects, SHEETS } from "../../google/sheets";
import { env } from "../../config/env";
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
  // sendJobStartedSms() itself also no-ops when Firetext isn't configured, but doing
  // that check ONLY there meant this handler couldn't tell "silently skipped" apart
  // from "actually sent" -- it happily wrote CLIENT_START_SMS_SENT either way, so the
  // admin Notifications tab showed "Sent" for texts that never left the building.
  // Checked here too, before anything is recorded, so an unconfigured deployment
  // writes nothing at all -- same as the no-phone-on-file case above.
  if (!env.firetextApiKey || !env.firetextSenderId) {
    log.info("Firetext is not configured; SMS sending is disabled", { job_id: task.jobId });
    return;
  }

  if (await alreadySent(task.jobId)) {
    log.info("start SMS already sent; task is a no-op", { job_id: task.jobId });
    return;
  }

  try {
    const template = await getSetting("JOB_STARTED_MESSAGE_TEXT", JOB_STARTED_MESSAGE_TEMPLATE);
    await sendJobStartedSms(job, template);
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
