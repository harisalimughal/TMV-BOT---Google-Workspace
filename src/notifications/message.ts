import { env } from "../config/env";
import { Job } from "../jobs/job.types";

/**
 * The customer "job started" message, shared verbatim between the email body
 * (google/gmail.ts) and the SMS body (integrations/firetext.ts) -- one admin-editable
 * block of text (see /admin's Settings tab), not two templates that can drift apart.
 * This is only the fallback shown until an admin overrides it.
 */
export const JOB_STARTED_MESSAGE_TEMPLATE =
  "Hi {customerName}, your {companyName} team has started your move. Pickup: {pickup}.";

/** Flat placeholder substitution -- a plain block of text an admin edits as a whole,
 *  not a templating engine with conditionals. */
export function renderJobStartedMessage(template: string, job: Job): string {
  return template
    .replace(/\{customerName\}/g, job.customerName || "there")
    .replace(/\{companyName\}/g, env.notificationFromName)
    .replace(/\{pickup\}/g, job.pickup || "")
    .replace(/\{dropoff\}/g, job.dropoff || "");
}
