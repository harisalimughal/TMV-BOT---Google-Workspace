import { google, chat_v1 } from "googleapis";
import { createGoogleAuth, SCOPES } from "../config/env";
import { withRetry } from "../utils/retry";

let clientPromise: Promise<chat_v1.Chat> | null = null;

async function client(): Promise<chat_v1.Chat> {
  if (!clientPromise) {
    clientPromise = createGoogleAuth(SCOPES.CHAT_BOT)
      .then(auth => google.chat({ version: "v1", auth }))
      .catch(error => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

/**
 * Proactively updates a card the bot already sent, outside the normal Chat
 * request/response cycle. Used when a driver-facing step finishes on some other
 * device — the customer's signature pad — and the conversation needs to move on
 * without the driver tapping anything to trigger a fresh response.
 *
 * `messageName` is the "spaces/.../messages/..." identity Chat gives every message;
 * the bot can only patch messages it authored itself (see chat/signature.routes.ts).
 */
export async function updateChatCard(messageName: string, message: Record<string, unknown>): Promise<void> {
  const chat = await client();
  await withRetry("chat.spaces.messages.patch", () =>
    chat.spaces.messages.patch({
      name: messageName,
      updateMask: "cardsV2",
      requestBody: message
    })
  );
}

/**
 * Proactively creates a new message in a Chat space (e.g. to push a job assignment
 * notification to a driver). Requires the CHAT_BOT scope and that the bot has
 * already been added to the space.
 *
 * `spaceName` is the "spaces/XXXXXXXX" identifier stored in the DriverSpaces sheet
 * when the driver first adds the bot (ADDED_TO_SPACE event).
 */
export async function createChatMessage(
  spaceName: string,
  message: Record<string, unknown>
): Promise<void> {
  const chat = await client();
  await withRetry("chat.spaces.messages.create", () =>
    chat.spaces.messages.create({
      parent: spaceName,
      requestBody: message
    })
  );
}
