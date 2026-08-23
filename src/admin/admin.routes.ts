import { Router } from "express";
import { DateTime } from "luxon";
import { checkAdminPassword, clearSessionCookie, issueSessionCookie, requireAdminSession } from "./admin.auth";
import { dashboardShell, loginPage } from "./admin.page";
import { commitWrites, driverWrite, getDriverByInitials, getSetting, listObjects, SCHEMA, settingWrite, SHEETS } from "../google/sheets";
import { createCalendarEvent } from "../google/calendar";
import { getDriveFileMedia } from "../google/drive";
import { parseCalendarEvent, syncBookingsForDate } from "../jobs/booking.service";
import { CUSTOMER_CONFIRMATION_TEXT } from "../workflow/workflow.engine";
import { SMS_JOB_STARTED_TEMPLATE } from "../integrations/firetext";
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
  },
  smsJobStartedText: {
    settingsKey: "SMS_JOB_STARTED_TEXT",
    label: "Customer SMS — Job Started",
    description:
      "Sent via Firetext when a driver taps Start Job (only if FIRETEXT_API_KEY/FIRETEXT_SENDER_ID are set — " +
      "otherwise SMS sending is skipped entirely). Placeholders: {customerName}, {companyName}, {pickup}, {dropoff}.",
    fallback: SMS_JOB_STARTED_TEMPLATE
  }
};

/** Allowlist: the URL only ever selects a sheet name from this map, never passes one through. */
const TAB_SHEETS: Record<string, string> = {
  jobs: SHEETS.BOOKINGS,
  checkin: SHEETS.STORAGE_CHECK_IN,
  checkout: SHEETS.STORAGE_CHECK_OUT,
  parking: SHEETS.PARKING_LIABILITY,
  liability: SHEETS.LIABILITY_REPORT,
  drivers: SHEETS.DRIVERS,
  // Every state transition (Start Job, each classic-flow step, Check In/Out, etc.) is
  // already written here with a timestamp — this just exposes the existing audit trail
  // rather than adding a new one.
  activity: SHEETS.ACTIVITY
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
      const countBy = (status: string) => bookings.filter(b => b.Status === status).length;
      const ready = countBy("READY");
      const inProgress = countBy("IN_PROGRESS");
      const completed = countBy("COMPLETED");
      const cancelled = countBy("CANCELLED");

      // Monthly revenue: Total Charges is only ever set by the classic Start Job
      // workflow's pricing steps, so a job that only ran Check In/Check Out (or
      // hasn't finished the classic flow yet) has none. Base Price -- set at booking
      // time for every job, regardless of how it's handled -- is the best available
      // stand-in so those jobs aren't invisible on the earnings graph.
      const money = (raw: unknown) => Number(String(raw ?? "").replace(/[£,\s]/g, "")) || 0;
      const monthly = new Map<string, number>();
      for (const b of bookings) {
        const start = b["Booked Start"];
        if (!start || b.Status === "CANCELLED") continue;
        const month = start.slice(0, 7);
        const revenue = money(b["Total Charges"]) || money(b["Base Price"]);
        monthly.set(month, (monthly.get(month) ?? 0) + revenue);
      }
      const monthlyEarnings = [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));

      res.status(200).json({
        kpis: [
          { label: "Total jobs", value: bookings.length, icon: "📦" },
          { label: "In progress", value: inProgress, icon: "🚚" },
          { label: "Completed", value: completed, icon: "✅" },
          { label: "Check-ins", value: checkins.length, icon: "📥" },
          { label: "Check-outs", value: checkouts.length, icon: "📤" },
          { label: "Parking liability reports", value: parking.length, icon: "🅿️" },
          { label: "Liability reports", value: liability.length, icon: "⚠️" }
        ],
        statusBreakdown: [
          { label: "Ready", value: ready, color: "#94a3b8" },
          { label: "In progress", value: inProgress, color: "#f59e0b" },
          { label: "Completed", value: completed, color: "#22c55e" },
          { label: "Cancelled", value: cancelled, color: "#ef4444" }
        ],
        monthlyEarnings
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

  // Streams a Drive file's actual bytes so the admin panel can show real photo
  // thumbnails. Evidence photos/signatures are never made publicly shared, so a plain
  // <img src="drive.google.com/..."> would 404/redirect to a Google login in the
  // admin's browser -- this fetches with the bot's own credentials and re-serves it.
  router.get("/api/drive-file/:fileId", async (req, res) => {
    const fileId = String(req.params.fileId || "");
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) {
      return res.status(400).json({ error: "Invalid file id." });
    }
    try {
      const { buffer, contentType } = await getDriveFileMedia(fileId);
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "private, max-age=3600");
      return res.status(200).send(buffer);
    } catch (error) {
      log.error("admin drive file proxy failed", error, { file_id: fileId });
      return res.status(404).json({ error: "File not found." });
    }
  });

  // Classic-flow photo steps, in the order they're taken during a job, with the label
  // shown in the UI for each.
  const CLASSIC_PHOTO_STEPS: { type: string; label: string }[] = [
    { type: "Arrival", label: "Arrival" },
    { type: "VanLoaded", label: "Loaded" },
    { type: "EmptyVan", label: "Empty Van" },
    { type: "Organized", label: "Organized" }
  ];

  /** The classic flow's customer signature is uploaded to Drive, but only its
   *  webViewLink is kept (in the Signatures sheet's Confirmation Text column, see
   *  workflow.engine.ts's submitDrawnSignature) -- no dedicated file-id column exists,
   *  so the id is pulled back out of Drive's stable ".../file/d/<id>/..." URL shape. */
  function extractDriveFileId(url: string): string {
    return url.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
  }

  router.get("/api/finished-jobs", async (_req, res) => {
    try {
      const [bookings, drivers, evidence, signatures] = await Promise.all([
        listObjects(SHEETS.BOOKINGS, 0),
        listObjects(SHEETS.DRIVERS, 0),
        listObjects(SHEETS.EVIDENCE, 0),
        listObjects(SHEETS.SIGNATURES, 0)
      ]);

      const driverNameByInitials = new Map(
        drivers.map(d => [String(d["Initials"] || "").toUpperCase(), d["Full Name"] || ""])
      );

      const evidenceByJob = new Map<string, Record<string, string>[]>();
      for (const row of evidence) {
        if (row["Status"] !== "COMPLETED") continue;
        if (!CLASSIC_PHOTO_STEPS.some(s => s.type === row["Evidence Type"])) continue;
        const jobId = row["Job ID"];
        const list = evidenceByJob.get(jobId) ?? [];
        list.push(row);
        evidenceByJob.set(jobId, list);
      }

      // A job can be redone (a re-signed signature), so keep only the most recent
      // Signatures row per job -- listObjects returns sheet order, oldest first.
      const signatureByJob = new Map<string, Record<string, string>>();
      for (const row of signatures) signatureByJob.set(row["Job ID"], row);

      const jobs = bookings
        .filter(b => b["Status"] === "COMPLETED")
        .map(b => {
          const jobId = b["Job ID"];
          const initials = String(b["Driver Initials"] || "").toUpperCase();
          const byType = new Map(evidenceByJob.get(jobId)?.map(e => [e["Evidence Type"], e]) ?? []);
          const photos = CLASSIC_PHOTO_STEPS
            .map(step => ({ step, row: byType.get(step.type) }))
            .filter((p): p is { step: typeof CLASSIC_PHOTO_STEPS[number]; row: Record<string, string> } => Boolean(p.row?.["Drive File ID"]))
            .map(p => ({ label: p.step.label, thumbUrl: `/admin/api/drive-file/${p.row["Drive File ID"]}` }));

          const signatureRow = signatureByJob.get(jobId);
          const signatureFileId = signatureRow ? extractDriveFileId(signatureRow["Confirmation Text"] || "") : "";

          return {
            jobId,
            driverInitials: b["Driver Initials"] || "",
            driverName: driverNameByInitials.get(initials) || b["Driver Initials"] || "Unassigned",
            customerName: b["Customer"] || "",
            pickup: b["Pickup"] || "",
            dropoff: b["Dropoff"] || "",
            actualStart: b["Actual Start"] || "",
            actualFinish: b["Actual Finish"] || "",
            totalCharges: b["Total Charges"] || "",
            paymentMethod: b["Payment Method"] || "",
            driveFolderUrl: b["Drive Folder URL"] || "",
            photos,
            signature: signatureFileId
              ? { customerName: (signatureRow && signatureRow["Customer Name"]) || "", thumbUrl: `/admin/api/drive-file/${signatureFileId}` }
              : null
          };
        })
        .sort((a, b) => (b.actualFinish || "").localeCompare(a.actualFinish || ""));

      res.status(200).json({ jobs });
    } catch (error) {
      log.error("admin finished jobs load failed", error);
      res.status(500).json({ error: "Failed to load finished jobs." });
    }
  });

  return router;
}
