import { Router } from "express";
import { DateTime } from "luxon";
import { checkAdminPassword, clearSessionCookie, issueSessionCookie, requireAdminSession } from "./admin.auth";
import { dashboardShell, loginPage } from "./admin.page";
import { commitWrites, driverWrite, listObjects, SCHEMA, SHEETS } from "../google/sheets";
import { createCalendarEvent } from "../google/calendar";
import { syncBookingsForDate } from "../jobs/booking.service";
import { env } from "../config/env";
import { log } from "../utils/logger";

/** Allowlist: the URL only ever selects a sheet name from this map, never passes one through. */
const TAB_SHEETS: Record<string, string> = {
  jobs: SHEETS.BOOKINGS,
  checkin: SHEETS.STORAGE_CHECK_IN,
  checkout: SHEETS.STORAGE_CHECK_OUT,
  parking: SHEETS.PARKING_LIABILITY,
  liability: SHEETS.LIABILITY_REPORT,
  drivers: SHEETS.DRIVERS
};

export function adminRouter(): Router {
  const router = Router();

  router.get("/login", (_req, res) => {
    res.status(200).send(loginPage());
  });

  router.post("/login", (req, res) => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!checkAdminPassword(password)) {
      return res.status(401).send(loginPage("Incorrect password."));
    }
    issueSessionCookie(res);
    return res.redirect(302, "/admin");
  });

  router.post("/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  });

  router.use(requireAdminSession);

  router.get("/", (_req, res) => {
    res.status(200).send(dashboardShell());
  });

  router.get("/api/dashboard", async (_req, res) => {
    try {
      const [bookings, checkins, checkouts, parking, liability] = await Promise.all([
        listObjects(SHEETS.BOOKINGS, 0),
        listObjects(SHEETS.STORAGE_CHECK_IN, 0),
        listObjects(SHEETS.STORAGE_CHECK_OUT, 0),
        listObjects(SHEETS.PARKING_LIABILITY, 0),
        listObjects(SHEETS.LIABILITY_REPORT, 0)
      ]);
      const inProgress = bookings.filter(b => b.Status === "IN_PROGRESS").length;
      const completed = bookings.filter(b => b.Status === "COMPLETED").length;
      res.status(200).json({
        kpis: [
          { label: "Total jobs", value: bookings.length },
          { label: "In progress", value: inProgress },
          { label: "Completed", value: completed },
          { label: "Check-ins", value: checkins.length },
          { label: "Check-outs", value: checkouts.length },
          { label: "Parking liability reports", value: parking.length },
          { label: "Liability reports", value: liability.length }
        ]
      });
    } catch (error) {
      log.error("admin dashboard load failed", error);
      res.status(500).json({ error: "Failed to load dashboard." });
    }
  });

  router.post("/api/drivers", async (req, res) => {
    const body = req.body ?? {};
    const initials = String(body.initials ?? "").trim().toUpperCase();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const chatUserName = String(body.chatUserName ?? "").trim();
    const role = String(body.role ?? "").trim();
    const active = body.active !== false;

    if (!initials || !fullName || !email) {
      return res.status(400).json({ error: "Initials, full name and email are required." });
    }
    try {
      await commitWrites([driverWrite({ initials, fullName, email, chatUserName, active, role })]);
      return res.status(200).json({ ok: true });
    } catch (error) {
      log.error("admin add driver failed", error);
      return res.status(500).json({ error: "Failed to save driver." });
    }
  });

  // Jobs are a live mirror of Calendar, not standalone data (see booking.service.ts's
  // reconcileDisappeared) — a row written straight into Bookings would be auto-cancelled
  // by the next sync. So this creates a real Calendar event, formatted exactly the way
  // parseCalendarEvent() expects, and lets the normal sync path pick it up.
  router.post("/api/jobs", async (req, res) => {
    const body = req.body ?? {};
    const customerName = String(body.customerName ?? "").trim();
    const customerEmail = String(body.customerEmail ?? "").trim();
    const customerPhone = String(body.customerPhone ?? "").trim();
    const pickup = String(body.pickup ?? "").trim();
    const dropoff = String(body.dropoff ?? "").trim();
    const crewSize = Number(body.crewSize ?? 0);
    const price = Number(body.price ?? 0);
    const paidOnline = Boolean(body.paidOnline);
    const driverInitials = String(body.driverInitials ?? "").trim().toUpperCase();
    const start = String(body.start ?? "");
    const finish = String(body.finish ?? "");

    if (!customerName || !pickup || !dropoff || !start || !finish || !crewSize || !price) {
      return res.status(400).json({
        error: "Customer name, pickup, drop-off, crew size, price, start and finish time are all required."
      });
    }
    const startDt = DateTime.fromISO(start, { zone: env.timezone });
    const finishDt = DateTime.fromISO(finish, { zone: env.timezone });
    if (!startDt.isValid || !finishDt.isValid || finishDt <= startDt) {
      return res.status(400).json({ error: "Start/finish time is invalid." });
    }

    // Reproduces the exact title shape parseTitle() parses: "<name> - <n> Men - £<price>
    // / Y-<initials>" (or "/ N" with no dash+initials, which parseTitle reads as unassigned
    // — open to any driver, same as a calendar booking nobody typed initials onto).
    const title =
      `${customerName} - ${crewSize} Men - £${price} / ${paidOnline ? "Y" : "N"}` +
      (driverInitials ? `-${driverInitials}` : "");
    const description = [
      `Client name: ${customerName}`,
      `Email: ${customerEmail}`,
      `Phone: ${customerPhone}`,
      `Pickup: ${pickup}`,
      `Drop-off: ${dropoff}`
    ].join("\n");

    try {
      await createCalendarEvent({
        summary: title,
        description,
        start: { dateTime: startDt.toISO()! },
        end: { dateTime: finishDt.toISO()! }
      });
      // Sync immediately so the new job shows up in the admin table (and to the driver)
      // without waiting on the throttled background sync.
      await syncBookingsForDate(startDt);
      return res.status(200).json({ ok: true });
    } catch (error) {
      log.error("admin add job failed", error);
      return res.status(500).json({ error: "Failed to create job." });
    }
  });

  router.get("/api/table/:tab", async (req, res) => {
    const sheetName = TAB_SHEETS[req.params.tab];
    if (!sheetName) return res.status(404).json({ error: "Unknown tab." });
    try {
      const rows = await listObjects(sheetName, 0);
      res.status(200).json({ columns: SCHEMA[sheetName] ?? [], rows: rows.reverse() });
    } catch (error) {
      log.error("admin table load failed", error, { tab: req.params.tab });
      res.status(500).json({ error: "Failed to load data." });
    }
  });

  return router;
}
