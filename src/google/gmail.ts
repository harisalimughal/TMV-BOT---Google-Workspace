import { google, gmail_v1 } from "googleapis";
import { createGoogleAuth, env, SCOPES } from "../config/env";
import { Job } from "../jobs/job.types";
import { renderJobStartedMessage } from "../notifications/message";
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

export async function sendJobStartedEmail(job: Job, template: string): Promise<void> {
  if (!job.customerEmail) return;
  const gmail = await client();
  // Subject is email-only (SMS has no equivalent concept), so it stays fixed rather
  // than living in the shared admin-editable template. The body is exactly the same
  // rendered text sent as the SMS -- one wording, both channels, no drift.
  const subject = `Your ${env.notificationFromName} team has started your job`;
  const body = renderJobStartedMessage(template, job);

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
