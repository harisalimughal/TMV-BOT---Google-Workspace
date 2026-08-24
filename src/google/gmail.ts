import { google, gmail_v1 } from "googleapis";
import { createGoogleAuth, env, SCOPES } from "../config/env";
import { Job } from "../jobs/job.types";
import { withRetry, withTimeout } from "../utils/retry";

let clientPromise: Promise<gmail_v1.Gmail> | null = null;

async function client(): Promise<gmail_v1.Gmail> {
  if (!clientPromise) {
    // Gmail is the only service that legitimately impersonates a Workspace mailbox.
    clientPromise = createGoogleAuth(SCOPES.GMAIL, { impersonate: true })
      .then(auth => google.gmail({ version: "v1", auth }))
      .catch(error => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

function encodeMessage(lines: string[]): string {
  return Buffer.from(lines.join("\r\n"), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendJobStartedEmail(job: Job): Promise<void> {
  if (!job.customerEmail) return;
  const gmail = await client();
  const subject = `Your ${env.notificationFromName} team has started your job`;
  const body = [
    `Hello ${job.customerName || "there"},`,
    "",
    `Your ${env.notificationFromName} team has started your move.`,
    job.pickup ? `Pickup: ${job.pickup}` : "",
    job.dropoff ? `Drop-off: ${job.dropoff}` : "",
    job.actualStart ? `Started: ${new Date(job.actualStart).toLocaleString("en-GB", { timeZone: env.timezone })}` : "",
    "",
    "Thank you."
  ]
    .filter(Boolean)
    .join("\r\n");

  const raw = encodeMessage([
    `To: ${job.customerEmail}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body
  ]);

  // Hard timeout: a slow Gmail call must never hold the driver on a spinner.
  // Tier 2 moves this off the request path entirely via Cloud Tasks.
  await withTimeout(
    "Gmail send",
    withRetry("gmail.messages.send", () => gmail.users.messages.send({ userId: "me", requestBody: { raw } }), "rate-limit-only"),
    env.emailTimeoutMs
  );
}
