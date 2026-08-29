import { Router } from "express";
import { commitWrites, getSetting, settingWrite } from "../../../src/google/sheets";
import { CUSTOMER_CONFIRMATION_TEXT } from "../../../src/workflow/workflow.engine";
import { JOB_STARTED_MESSAGE_TEMPLATE, JOB_COMPLETION_EMAIL_TEMPLATE, REVIEW_REQUEST_EMAIL_TEMPLATE } from "../../../src/notifications/message";
import { log } from "../../../src/utils/logger";

/**
 * The same three admin-editable text templates the classic /admin panel exposes --
 * ported verbatim (same Settings-sheet keys, same fallbacks) so this is genuinely the
 * same data, not a second copy that can drift. See src/admin/admin.routes.ts's
 * EDITABLE_SETTINGS for the original.
 */
const EDITABLE_SETTINGS: Record<string, { settingsKey: string; label: string; description: string; fallback: string }> = {
  confirmationText: {
    settingsKey: "CUSTOMER_CONFIRMATION_TEXT",
    label: "Customer Confirmation Text",
    description: "Shown on the Start Job workflow's signature step, and on the customer's signature-pad page.",
    fallback: CUSTOMER_CONFIRMATION_TEXT
  },
  jobStartedMessage: {
    settingsKey: "JOB_STARTED_MESSAGE_TEXT",
    label: "Customer Message — On My Way (Email & SMS)",
    description: "Previewed on the driver's \"On my way\" card and sent by both email and SMS once they tap Send Message. Placeholders: {customerName}, {companyName}, {pickup}, {dropoff}, {driverPhone}, {vanRegistration}.",
    fallback: JOB_STARTED_MESSAGE_TEMPLATE
  },
  reviewRequestEmail: {
    settingsKey: "REVIEW_REQUEST_EMAIL_TEXT",
    label: "Customer Review Request Email",
    description: "Previewed and sent by email only, if the driver opts in on the \"Do you want to take a review from the client?\" step near the end of the job. Placeholders: {customerName}, {companyName}, {pickup}, {dropoff}.",
    fallback: REVIEW_REQUEST_EMAIL_TEMPLATE
  },
  jobCompletionEmail: {
    settingsKey: "JOB_COMPLETION_EMAIL_TEXT",
    label: "Job Completion Email",
    description: "Sent automatically when the driver marks a job complete. Placeholders: {customerName}, {companyName}, {pickup}, {dropoff}, {job_time}, {job_date}, {driver_name}.",
    fallback: JOB_COMPLETION_EMAIL_TEMPLATE
  },
  clientNotificationOffsetMinutes: {
    settingsKey: "CLIENT_NOTIFICATION_OFFSET_MINUTES",
    label: "Client Notification — Minutes Before Job",
    description: "How many minutes before the job start time to send the automatic client reminder. Set to 0 to disable. Default: 60.",
    fallback: "60"
  }
};

export function settingsRoute(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const settings = await Promise.all(
        Object.entries(EDITABLE_SETTINGS).map(async ([key, meta]) => ({
          key, label: meta.label, description: meta.description,
          value: await getSetting(meta.settingsKey, meta.fallback, 0),
          // Lets the UI offer "reset to default" without a round trip, and show
          // whether a setting has actually been customized.
          fallback: meta.fallback
        }))
      );
      res.status(200).json({ settings });
    } catch (error) {
      log.error("dashboard settings load failed", error);
      res.status(500).json({ error: { code: "SETTINGS_FETCH_FAILED", message: "Failed to load settings." } });
    }
  });

  router.post("/", async (req, res) => {
    const key = String(req.body?.key ?? "");
    const value = String(req.body?.value ?? "").trim();
    const meta = EDITABLE_SETTINGS[key];
    if (!meta) return res.status(404).json({ error: { code: "UNKNOWN_SETTING", message: "Unknown setting." } });
    if (!value) return res.status(400).json({ error: { code: "VALUE_REQUIRED", message: "Value is required." } });
    try {
      await commitWrites([settingWrite(meta.settingsKey, value, "Edited from /admin")]);
      return res.status(200).json({ ok: true });
    } catch (error) {
      log.error("dashboard setting save failed", error, { key });
      return res.status(500).json({ error: { code: "SETTING_SAVE_FAILED", message: "Failed to save setting." } });
    }
  });

  return router;
}
