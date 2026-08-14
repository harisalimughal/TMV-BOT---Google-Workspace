import { describe, expect, it } from "vitest";
import { normalizeWorkspaceEvent, UnrecognisedChatEventError } from "../src/chat/workspace-adapter";

/**
 * The bug this file exists to prevent: an unrecognised shape used to fall through to
 * `{ type: "MESSAGE", user: undefined }`, so every button click became a driver-identity
 * error. Which format Google sends is a console setting, so both must work.
 */

const USER = { name: "users/123", email: "driver@tmv.test", displayName: "Test Driver" };

describe("classic Chat API format", () => {
  it("preserves the event type instead of collapsing everything to MESSAGE", () => {
    const event = normalizeWorkspaceEvent({
      type: "CARD_CLICKED",
      user: USER,
      action: { actionMethodName: "START_JOB", parameters: [{ key: "jobId", value: "TMV-1" }] }
    });
    expect(event.type).toBe("CARD_CLICKED");
    expect(event.action?.function).toBe("START_JOB");
    expect(event.action?.parameters?.[0]).toEqual({ key: "jobId", value: "TMV-1" });
  });

  it("carries the driver identity through", () => {
    const event = normalizeWorkspaceEvent({ type: "MESSAGE", user: USER, message: { text: "jobs" } });
    expect(event.user?.email).toBe("driver@tmv.test");
  });

  it("normalises a singular attachment into an array", () => {
    const event = normalizeWorkspaceEvent({
      type: "MESSAGE",
      user: USER,
      message: {
        name: "spaces/A/messages/B",
        attachment: { contentType: "image/jpeg", attachmentDataRef: { resourceName: "media/x" } }
      }
    });
    expect(event.message?.attachment).toHaveLength(1);
    expect(event.message?.name).toBe("spaces/A/messages/B");
  });

  it("falls back to text when argumentText is absent", () => {
    const event = normalizeWorkspaceEvent({ type: "MESSAGE", user: USER, message: { text: "help" } });
    expect(event.message?.argumentText).toBe("help");
  });

  it.each(["ADDED_TO_SPACE", "REMOVED_FROM_SPACE", "APP_COMMAND"])("passes %s through", type => {
    expect(normalizeWorkspaceEvent({ type, user: USER }).type).toBe(type);
  });
});

describe("Workspace add-on format", () => {
  it("maps a message payload", () => {
    const event = normalizeWorkspaceEvent({
      chat: { user: USER, messagePayload: { message: { name: "spaces/A/messages/B", text: "jobs" } } }
    });
    expect(event.type).toBe("MESSAGE");
    expect(event.user?.email).toBe("driver@tmv.test");
    expect(event.message?.name).toBe("spaces/A/messages/B");
  });

  it("maps a button click and keeps every action parameter", () => {
    const event = normalizeWorkspaceEvent({
      chat: { user: USER, buttonClickedPayload: { message: { name: "spaces/A/messages/C" } } },
      commonEventObject: {
        parameters: { actionName: "REOPEN_PHOTO_STEP", jobId: "TMV-2", evidenceType: "VanLoaded" }
      }
    });
    expect(event.type).toBe("CARD_CLICKED");
    expect(event.action?.function).toBe("REOPEN_PHOTO_STEP");
    const params = Object.fromEntries((event.action?.parameters ?? []).map(p => [p.key, p.value]));
    // evidenceType used to be dropped, silently breaking the reopen action.
    expect(params).toMatchObject({ jobId: "TMV-2", evidenceType: "VanLoaded" });
  });

  it("exposes the clicked message id so a redelivered click can be deduped", () => {
    const event = normalizeWorkspaceEvent({
      chat: { user: USER, buttonClickedPayload: { message: { name: "spaces/A/messages/D" } } },
      commonEventObject: { parameters: { actionName: "START_JOB", jobId: "TMV-3" } }
    });
    expect(event.message?.name).toBe("spaces/A/messages/D");
  });

  it.each([
    ["addedToSpacePayload", "ADDED_TO_SPACE"],
    ["removedFromSpacePayload", "REMOVED_FROM_SPACE"],
    ["appCommandPayload", "APP_COMMAND"]
  ])("maps %s to %s", (payloadKey, expected) => {
    const event = normalizeWorkspaceEvent({ chat: { user: USER, [payloadKey]: {} } });
    expect(event.type).toBe(expected);
  });
});

describe("unrecognised shapes", () => {
  it("throws rather than silently producing an identity-less MESSAGE", () => {
    expect(() => normalizeWorkspaceEvent({ somethingElse: true })).toThrow(UnrecognisedChatEventError);
  });

  it("throws on an unknown chat payload", () => {
    expect(() => normalizeWorkspaceEvent({ chat: { user: USER, futurePayload: {} } })).toThrow(
      UnrecognisedChatEventError
    );
  });

  it("names the offending keys so the misconfiguration is diagnosable", () => {
    try {
      normalizeWorkspaceEvent({ alpha: 1, beta: 2 });
      expect.unreachable();
    } catch (error) {
      expect((error as UnrecognisedChatEventError).topLevelKeys).toEqual(["alpha", "beta"]);
      expect((error as Error).message).toContain("alpha");
    }
  });

  it("rejects a null body", () => {
    expect(() => normalizeWorkspaceEvent(null)).toThrow(UnrecognisedChatEventError);
  });
});
