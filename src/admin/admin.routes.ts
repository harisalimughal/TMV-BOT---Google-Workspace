import { Router } from "express";
import { DateTime } from "luxon";
import { checkAdminPassword, clearSessionCookie, issueSessionCookie, requireAdminSession } from "./admin.auth";
import { dashboardShell, loginPage } from "./admin.page";
import { commitWrites, driverWrite, getDriverByInitials, getSetting, listObjects, SCHEMA, settingWrite, SHEETS } from "../google/sheets";
import { createCalendarEvent } from "../google/calendar";
import { parseCalendarEvent, syncBookingsForDate } from "../jobs/booking.service";
import { CUSTOMER_CONFIRMATION_TEXT } from "../workflow/workflow.engine";
import { env } from "../config/env";
import { log } from "../utils/logger";

/**
 * Allowlist of admin-editable operational text. Each entry maps a stable UI key to the
 * Settings-sheet row key it reads/writes and the built-in default shown until an admin
 * overrides it (see workflow.engine.ts's CUSTOMER_CONFIRMATION_TEXT, the Start Job
 * workflow's signature-step wording).
 */
const EDITABLE_SETTINGS: Record<string, { settingsKey: string; label: string; description: string; fallback: string }> = {
  confirmationText: {
    settingsKey: "CUSTOMER_CONFIRMATION_TEXT",
    label: "Customer Confirmation Text",
    description: "Shown on the Start Job workflow's signature step, and on the customer's signature-pad page.",
    fallback: CUSTOMER_CONFIRMATION_TEXT
  }
};

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

    if (!customerName || !pickup || !dropoff || !start || !finish) {
      return res.status(400).json({
        error: "Customer name, pickup, drop-off, start and finish time are all required."
      });
    }
    if (!Number.isInteger(crewSize) || crewSize <= 0) {
      return res.status(400).json({ error: "Crew size must be a whole number greater than 0." });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: "Price must be a number greater than 0." });
    }
    const startDt = DateTime.fromISO(start, { zone: env.timezone });
    const finishDt = DateTime.fromISO(finish, { zone: env.timezone });
    if (!startDt.isValid || !finishDt.isValid || finishDt <= startDt) {
      return res.status(400).json({ error: "Start/finish time is invalid." });
    }
    if (driverInitials && !/^[A-Z]{1,5}$/.test(driverInitials)) {
      return res.status(400).json({ error: "Driver initials must be 1-5 letters, e.g. JD." });
    }

    // Job<->driver matching is purely by initials string equality (see jobs.service.ts's
    // getNextJobForDriver) — a typo here wouldn't error anywhere downstream, it would just
    // make the job invisible to every driver. Catch that at creation time instead.
    if (driverInitials) {
      const driver = await getDriverByInitials(driverInitials);
      if (!driver) {
        return res.status(400).json({
          error: `No driver with initials "${driverInitials}" in the Drivers sheet. Add that driver first, or leave initials blank to leave the job unassigned.`
        });
      }
      if (!driver.active) {
        return res.status(400).json({ error: `Driver "${driverInitials}" exists but is marked inactive.` });
      }
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

    // Round-trip through the exact parser production uses (parseCalendarEvent), instead
    // of duplicating its regexes here — the two can never silently drift apart this way.
    // Anything the bot wouldn't read back correctly is rejected before it ever reaches
    // Calendar, rather than being discovered later as a job with a blank field or the
    // wrong crew size.
    const parsed = parseCalendarEvent({
      id: "admin-validation-check",
      status: "confirmed",
      summary: title,
      description,
      start: { dateTime: startDt.toISO()! },
      end: { dateTime: finishDt.toISO()! }
    });
    const mismatches: string[] = [];
    if (!parsed) mismatches.push("event");
    else {
      if (parsed.driverInitials !== driverInitials) mismatches.push("driver initials");
      if (parsed.crewSize !== crewSize) mismatches.push("crew size");
      if (parsed.price !== price) mismatches.push("price");
      if (parsed.paidOnline !== paidOnline) mismatches.push("paid online");
      if (parsed.customerName !== customerName) mismatches.push("customer name");
      if (parsed.customerEmail !== customerEmail) mismatches.push("customer email");
      if (parsed.customerPhone !== customerPhone) mismatches.push("customer phone");
      if (parsed.pickup !== pickup) mismatches.push("pickup address");
      if (parsed.dropoff !== dropoff) mismatches.push("drop-off address");
    }
    if (mismatches.length) {
      return res.status(400).json({
        error:
          `This job wouldn't be read back correctly by the bot (${mismatches.join(", ")}). ` +
          "Avoid colons, dashes, slashes or line breaks inside name/address fields — those characters " +
          "are part of the calendar format the bot parses."
      });
    }

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

  router.get("/api/settings", async (_req, res) => {
    try {
      const settings = await Promise.all(
        Object.entries(EDITABLE_SETTINGS).map(async ([key, meta]) => ({
          key, label: meta.label, description: meta.description,
          value: await getSetting(meta.settingsKey, meta.fallback, 0)
        }))
      );
      res.status(200).json({ settings });
    } catch (error) {
      log.error("admin settings load failed", error);
      res.status(500).json({ error: "Failed to load settings." });
    }
  });

  router.post("/api/settings", async (req, res) => {
    const key = String(req.body?.key ?? "");
    const value = String(req.body?.value ?? "").trim();
    const meta = EDITABLE_SETTINGS[key];
    if (!meta) return res.status(404).json({ error: "Unknown setting." });
    if (!value) return res.status(400).json({ error: "Value is required." });
    try {
      await commitWrites([settingWrite(meta.settingsKey, value, "Edited from /admin")]);
      return res.status(200).json({ ok: true });
    } catch (error) {
      log.error("admin setting save failed", error, { key });
      return res.status(500).json({ error: "Failed to save setting." });
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
