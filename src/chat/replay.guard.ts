import { commitWrites, findProcessedEvent, processedEventWrite } from "../google/sheets";
import { log } from "../utils/logger";
import { withLock } from "../utils/lock";

/**
 * Replay protection for Google Chat event redelivery.
 *
 * Chat redelivers a message event when the endpoint misses the response deadline. The
 * photo path was the slowest thing the bot did, so the realistic failure was:
 *
 *   1. arrival photo arrives, handler starts
 *   2. response is slow, Chat redelivers the identical event
 *   3. delivery 1 finishes, state -> WAITING_LOADED_PHOTO
 *   4. delivery 2 is now judged against WAITING_LOADED_PHOTO, passes the photo-state
 *      check, and files the *arrival* photo as van-loaded evidence
 *
 * That is silent evidence corruption, and it is exactly what an insurer or a court
 * would rely on. Two independent signals are used, because either can be absent:
 *
 *   - `message.name` (spaces/X/messages/Y), unique per Chat message
 *   - the attachment `resourceName`, identical across redeliveries of one upload
 */

export interface ReplayRecord {
  eventKey: string;
  jobId: string;
  outcomeState: string;
  processedAt: string;
}

/** In-process first-line defence for redeliveries arriving while the first is still running. */
const inFlight = new Map<string, Promise<void>>();

function normaliseKey(raw: string): string {
  return raw.replace(/[^A-Za-z0-9:_/-]/g, "-").slice(0, 300);
}

export function eventKeyFor(input: { messageName?: string; resourceNames?: string[] }): string | null {
  if (input.messageName) return normaliseKey(`msg:${input.messageName}`);
  if (input.resourceNames?.length) return normaliseKey(`media:${[...input.resourceNames].sort().join("|")}`);
  return null;
}

/** Returns the prior outcome when this exact event has already been handled. */
export async function findReplay(eventKey: string): Promise<ReplayRecord | null> {
  const row = await findProcessedEvent(eventKey);
  if (!row) return null;
  return {
    eventKey,
    jobId: row["Job ID"] ?? "",
    outcomeState: row["Outcome State"] ?? "",
    processedAt: ""
  };
}

/**
 * Runs `fn` at most once per event key.
 *
 * On replay the recorded outcome is returned via `onReplay` so the driver sees the
 * same card again rather than an out-of-order error. The marker is written inside the
 * same lock as the work, so a redelivery that arrives mid-flight waits and then sees
 * the marker rather than racing past it.
 */
export async function runOnce<T>(
  eventKey: string | null,
  context: { jobId?: string },
  fn: () => Promise<{ result: T; outcomeState: string; jobId: string }>,
  onReplay: (record: ReplayRecord) => Promise<T> | T
): Promise<T> {
  // No usable key (e.g. a text command): nothing to dedupe, and text commands are
  // read-only or idempotent by construction.
  if (!eventKey) return (await fn()).result;

  const pending = inFlight.get(eventKey);
  if (pending) {
    log.info("event redelivered while in flight; waiting for the original", { event_key: eventKey });
    await pending.catch(() => undefined);
  }

  return withLock(`event:${eventKey}`, async () => {
    const existing = await findReplay(eventKey);
    if (existing) {
      log.info("event replay suppressed", {
        event_key: eventKey,
        job_id: existing.jobId,
        outcome_state: existing.outcomeState
      });
      return onReplay(existing);
    }

    let settle!: () => void;
    inFlight.set(eventKey, new Promise<void>(resolve => (settle = resolve)));

    try {
      const { result, outcomeState, jobId } = await fn();
      // Recorded after the work succeeded: a failed attempt must remain retryable.
      await commitWrites([
        processedEventWrite({ eventKey, jobId: jobId || context.jobId || "", outcomeState })
      ]);
      return result;
    } finally {
      settle();
      inFlight.delete(eventKey);
    }
  });
}
