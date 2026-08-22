import { QueueTask } from "./queue.types";
import { handleProcessJobImage } from "./handlers/image.handler";
import { handleSendJobStartedEmail } from "./handlers/email.handler";
import { handleSendJobStartedSms } from "./handlers/sms.handler";
import { handleSweepStaleEvidence } from "./handlers/reaper.handler";

/**
 * Single place that maps a task to its handler.
 *
 * Shared by the HTTP worker routes (Cloud Tasks) and the inline development driver, so
 * the two paths cannot drift apart.
 */
export async function dispatchTask(task: QueueTask): Promise<unknown> {
  switch (task.type) {
    case "PROCESS_JOB_IMAGE":
      return handleProcessJobImage(task);
    case "SEND_JOB_STARTED_EMAIL":
      return handleSendJobStartedEmail(task);
    case "SEND_JOB_STARTED_SMS":
      return handleSendJobStartedSms(task);
    case "SWEEP_STALE_EVIDENCE":
      return handleSweepStaleEvidence();
    default: {
      const exhaustive: never = task;
      throw new Error(`Unknown task type: ${JSON.stringify(exhaustive)}`);
    }
  }
}
