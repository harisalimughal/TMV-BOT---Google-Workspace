import { GoogleChatEvent } from "./chat.controller";
import { log } from "../utils/logger";

/**
 * Thrown when neither event format is recognised. Previously an unknown shape fell
 * through to `{ type: "MESSAGE", user: undefined }`, which turned every button click
 * into "Google Chat did not provide a driver identity" — the classic "bot not
 * responding" report. Failing loudly here makes the misconfiguration diagnosable.
 */
export class UnrecognisedChatEventError extends Error {
  constructor(public readonly topLevelKeys: string[]) {
    super(
      `Unrecognised Google Chat event shape. Top-level keys: [${topLevelKeys.join(", ")}]. ` +
        "Expected either the Workspace add-on format (body.chat.*) or the classic Chat API format (body.type)."
    );
    this.name = "UnrecognisedChatEventError";
  }
}

function attachmentsOf(message: any): any[] {
  const raw = message?.attachment ?? message?.attachments ?? [];
  return Array.isArray(raw) ? raw : [raw].filter(Boolean);
}

/**
 * Classic Chat API HTTP event: `type`, `message`, `user`, `action` at the top level.
 *
 * This is what an HTTP-endpoint Chat app receives unless it is explicitly configured
 * for the newer Workspace event format, so both must be supported — which one arrives
 * is a console setting that no code in this repo controls.
 */
function fromClassicEvent(body: any): GoogleChatEvent {
  const message = body.message;
  return {
    type: body.type,
    user: body.user,
    eventTime: body.eventTime,
    message: message
      ? {
          name: message.name,
          text: message.text,
          argumentText: message.argumentText ?? message.text,
          attachment: attachmentsOf(message)
        }
      : undefined,
    action: body.action
      ? {
          function: body.action.function ?? body.action.actionMethodName,
          actionMethodName: body.action.actionMethodName ?? body.action.function,
          parameters: body.action.parameters ?? []
        }
      : undefined,
    common: body.common,
    commonEventObject: body.commonEventObject
  };
}

/** Workspace add-on format: payloads nested under `body.chat`. */
function fromWorkspaceEvent(body: any, chat: any): GoogleChatEvent {
  if (chat.messagePayload) {
    const message = chat.messagePayload.message ?? {};
    return {
      type: "MESSAGE",
      user: chat.user,
      eventTime: body.eventTime,
      message: {
        name: message.name,
        text: message.text,
        argumentText: message.argumentText ?? message.text,
        attachment: attachmentsOf(message)
      },
      commonEventObject: body.commonEventObject
    };
  }

  if (chat.buttonClickedPayload) {
    const payload = chat.buttonClickedPayload;
    const params = body.commonEventObject?.parameters ?? payload?.parameters ?? {};
    const functionName =
      params.actionName ?? params.function ?? params.actionMethodName ??
      payload?.function ?? payload?.actionMethodName ?? "";

    // Forward every parameter, not just jobId. REOPEN_PHOTO_STEP needs evidenceType,
    // and dropping unknown keys silently breaks any future parameterised action.
    const parameters = Object.entries(params)
      .filter(([key]) => key !== "actionName" && key !== "function" && key !== "actionMethodName")
      .map(([key, value]) => ({ key, value: String(value ?? "") }));

    return {
      type: "CARD_CLICKED",
      user: chat.user,
      eventTime: body.eventTime,
      // The clicked message id, so a redelivered click is recognisable as a replay.
      message: payload?.message?.name ? { name: payload.message.name } : undefined,
      action: { function: functionName, actionMethodName: functionName, parameters },
      commonEventObject: { ...body.commonEventObject, parameters: { ...params, function: functionName } }
    };
  }

  if (chat.addedToSpacePayload) {
    return { type: "ADDED_TO_SPACE", user: chat.user, commonEventObject: body.commonEventObject };
  }
  if (chat.removedFromSpacePayload) {
    return { type: "REMOVED_FROM_SPACE", user: chat.user };
  }
  if (chat.appCommandPayload) {
    return {
      type: "APP_COMMAND",
      user: chat.user,
      eventTime: body.eventTime,
      appCommandMetadata: chat.appCommandPayload.appCommandMetadata,
      commonEventObject: body.commonEventObject
    };
  }

  throw new UnrecognisedChatEventError(Object.keys(chat));
}

export function normalizeWorkspaceEvent(body: any): GoogleChatEvent {
  if (!body || typeof body !== "object") throw new UnrecognisedChatEventError([]);

  const chat = body.chat;
  if (chat && typeof chat === "object") return fromWorkspaceEvent(body, chat);

  if (typeof body.type === "string") {
    log.debug("classic Chat API event format", { event_type: body.type });
    return fromClassicEvent(body);
  }

  throw new UnrecognisedChatEventError(Object.keys(body));
}

export function wrapCreateMessage(message: Record<string, unknown>) {
  return { hostAppDataAction: { chatDataAction: { createMessageAction: { message } } } };
}

export function wrapUpdateMessage(message: Record<string, unknown>) {
  return { hostAppDataAction: { chatDataAction: { updateMessageAction: { message } } } };
}
