import { Router } from "express";
import { env } from "../../../src/config/env";
import { listObjects, SHEETS } from "../../../src/google/sheets";
import { log } from "../../../src/utils/logger";

const NOTIFY_ACTIONS = new Set([
  "CLIENT_START_EMAIL_SENT", "CLIENT_START_EMAIL_FAILED", "CLIENT_START_SMS_SENT", "CLIENT_START_SMS_FAILED"
]);

/**
 * Whether the "on my way" email/SMS actually reached the customer for a given job --
 * ported verbatim from src/admin/admin.routes.ts's notifyStatus/NOTIFY_ACTIONS. See
 * that file for the full reasoning; this is the same real ActivityLog-backed
 * classification, not the fabricated per-job hash the old NotificationsPage.tsx used.
 */
function notifyStatus(
  hasTarget: boolean, configured: boolean, sentRow: Record<string, string> | undefined, failedRow: Record<string, string> | undefined
): { state: "sent" | "failed" | "pending" | "skipped" | "disabled"; detail: string; at: string } {
  if (!hasTarget) return { state: "skipped", detail: "", at: "" };
  if (!configured && !sentRow) return { state: "disabled", detail: "", at: "" };
  if (sentRow) return { state: "sent", detail: sentRow["Detail"] || "", at: sentRow["Timestamp"] || "" };
  if (failedRow) return { state: "failed", detail: failedRow["Detail"] || "", at: failedRow["Timestamp"] || "" };
  return { state: "pending", detail: "", at: "" };
}

export function notificationsRoute(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const [bookings, activity] = await Promise.all([
        listObjects(SHEETS.BOOKINGS, 0),
        listObjects(SHEETS.ACTIVITY, 0)
      ]);

      const latestByJobAction = new Map<string, Record<string, string>>();
      for (const row of activity) {
        if (!NOTIFY_ACTIONS.has(row["Action"])) continue;
        latestByJobAction.set(`${row["Job ID"]}::${row["Action"]}`, row);
      }

      const smsConfigured = Boolean(env.firetextApiKey && env.firetextSenderId);

      const rows = bookings
        .filter(b => b["Actual Start"])
        .map(b => {
          const jobId = b["Job ID"];
          const email = notifyStatus(
            Boolean(b["Customer Email"]), true,
            latestByJobAction.get(`${jobId}::CLIENT_START_EMAIL_SENT`),
            latestByJobAction.get(`${jobId}::CLIENT_START_EMAIL_FAILED`)
          );
          const sms = notifyStatus(
            Boolean(b["Phone"]), smsConfigured,
            latestByJobAction.get(`${jobId}::CLIENT_START_SMS_SENT`),
            latestByJobAction.get(`${jobId}::CLIENT_START_SMS_FAILED`)
          );
          return {
            jobId,
            customerName: b["Customer"] || "",
            customerEmail: b["Customer Email"] || "",
            customerPhone: b["Phone"] || "",
            driverInitials: b["Driver Initials"] || "",
            actualStart: b["Actual Start"] || "",
            email,
            sms
          };
        })
        .sort((a, b) => (b.actualStart || "").localeCompare(a.actualStart || ""));

      res.status(200).json({ rows });
    } catch (error) {
      log.error("dashboard notifications load failed", error);
      res.status(500).json({ error: { code: "NOTIFICATIONS_FETCH_FAILED", message: "Failed to load notification status." } });
    }
  });

  return router;
}
