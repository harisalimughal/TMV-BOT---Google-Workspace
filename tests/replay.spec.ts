import { describe, expect, it } from "vitest";
import { eventKeyFor } from "../src/chat/replay.guard";

/**
 * Chat redelivers a message event when the endpoint misses the response deadline.
 * The key must be identical across redeliveries of one upload and distinct across
 * genuinely different uploads.
 */
describe("event key derivation", () => {
  it("prefers the message id", () => {
    expect(eventKeyFor({ messageName: "spaces/A/messages/B" })).toBe("msg:spaces/A/messages/B");
  });

  it("is stable across redeliveries of the same message", () => {
    const a = eventKeyFor({ messageName: "spaces/A/messages/B", resourceNames: ["media/1"] });
    const b = eventKeyFor({ messageName: "spaces/A/messages/B", resourceNames: ["media/1"] });
    expect(a).toBe(b);
  });

  it("falls back to attachment resource names when there is no message id", () => {
    expect(eventKeyFor({ resourceNames: ["media/1"] })).toBe("media:media/1");
  });

  it("is order-insensitive across multiple attachments", () => {
    expect(eventKeyFor({ resourceNames: ["media/2", "media/1"] })).toBe(
      eventKeyFor({ resourceNames: ["media/1", "media/2"] })
    );
  });

  it("distinguishes genuinely different uploads", () => {
    expect(eventKeyFor({ resourceNames: ["media/1"] })).not.toBe(eventKeyFor({ resourceNames: ["media/2"] }));
  });

  it("returns null when there is nothing to dedupe on", () => {
    expect(eventKeyFor({})).toBeNull();
    expect(eventKeyFor({ resourceNames: [] })).toBeNull();
  });

  it("strips characters that are unsafe in a task or sheet key", () => {
    const key = eventKeyFor({ messageName: "spaces/A/messages/B?x=1&y=2" });
    expect(key).not.toMatch(/[?&=]/);
  });
});
