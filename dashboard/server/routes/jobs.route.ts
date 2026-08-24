import { Router } from "express";
import { DateTime } from "luxon";
import { env } from "../../../src/config/env";
import { getDriverByInitials } from "../../../src/google/sheets";
import { createCalendarEvent } from "../../../src/google/calendar";
import { parseCalendarEvent, syncBookingsForDate } from "../../../src/jobs/booking.service";
import { log } from "../../../src/utils/logger";
import { formatGBP, toPounds } from "../../../src/utils/money";
import { normalizeDataset } from "../normalize/normalize";
import { formatLondonDate } from "../normalize/timezone";
import { NormalizedJob } from "../normalize/types";
import { generateJobPdf } from "../pdf/pdf-generator";
import { sheetCache } from "../read/cache";
import { readDataset } from "../read/sheet-reader";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  // Formula injection defense: escape leading =, +, -, @
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function jobsRoute(): Router {
  const router = Router();

  // Jobs are a live mirror of Calendar, not standalone data (see booking.service.ts's
  // reconcileDisappeared) -- a row written straight into Bookings would be
  // auto-cancelled by the next sync. So this creates a real Calendar event, formatted
  // exactly the way parseCalendarEvent() expects, and lets the normal sync path pick
  // it up. Ported verbatim from src/admin/admin.routes.ts's POST /api/jobs.
  router.post("/", async (req, res) => {
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
        error: { code: "VALIDATION_FAILED", message: "Customer name, pickup, drop-off, start and finish time are all required." }
      });
    }
    if (!Number.isInteger(crewSize) || crewSize <= 0) {
      return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Crew size must be a whole number greater than 0." } });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Price must be a number greater than 0." } });
    }
    const startDt = DateTime.fromISO(start, { zone: env.timezone });
    const finishDt = DateTime.fromISO(finish, { zone: env.timezone });
    if (!startDt.isValid || !finishDt.isValid || finishDt <= startDt) {
      return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Start/finish time is invalid." } });
    }
    if (driverInitials && !/^[A-Z]{1,5}$/.test(driverInitials)) {
      return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: "Driver initials must be 1-5 letters, e.g. JD." } });
    }

    // Job<->driver matching is purely by initials string equality (see
    // jobs.service.ts's getNextJobForDriver) -- a typo here wouldn't error anywhere
    // downstream, it would just make the job invisible to every driver. Catch that at
    // creation time instead.
    if (driverInitials) {
      const driver = await getDriverByInitials(driverInitials);
      if (!driver) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_FAILED",
            message: `No driver with initials "${driverInitials}" in the Drivers sheet. Add that driver first, or leave initials blank to leave the job unassigned.`
          }
        });
      }
      if (!driver.active) {
        return res.status(400).json({ error: { code: "VALIDATION_FAILED", message: `Driver "${driverInitials}" exists but is marked inactive.` } });
      }
    }

    // Reproduces the exact title shape parseTitle() parses: "<name> - <n> Men -
    // £<price> / Y-<initials>" (or "/ N" with no dash+initials, which parseTitle
    // reads as unassigned -- open to any driver, same as a calendar booking nobody
    // typed initials onto).
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

    // Round-trip through the exact parser production uses (parseCalendarEvent),
    // instead of duplicating its regexes here -- the two can never silently drift
    // apart this way. Anything the bot wouldn't read back correctly is rejected
    // before it ever reaches Calendar, rather than being discovered later as a job
    // with a blank field or the wrong crew size.
    const parsed = parseCalendarEvent({
      id: "dashboard-validation-check",
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
        error: {
          code: "VALIDATION_FAILED",
          message:
            `This job wouldn't be read back correctly by the bot (${mismatches.join(", ")}). ` +
            "Avoid colons, dashes, slashes or line breaks inside name/address fields — those characters " +
            "are part of the calendar format the bot parses."
        }
      });
    }

    try {
      await createCalendarEvent({
        summary: title,
        description,
        start: { dateTime: startDt.toISO()! },
        end: { dateTime: finishDt.toISO()! }
      });
      // Sync immediately so the new job shows up in the dashboard without waiting on
      // the throttled background sync, and invalidate this dashboard's own separate
      // SWR cache so the next read doesn't serve a pre-sync snapshot for up to 30s.
      await syncBookingsForDate(startDt);
      sheetCache.invalidate();
      return res.status(200).json({ ok: true });
    } catch (error) {
      log.error("dashboard add job failed", error);
      return res.status(500).json({ error: { code: "JOB_CREATE_FAILED", message: "Failed to create job." } });
    }
  });

  // Export CSV of filtered jobs
  router.get("/export.csv", async (req, res) => {
    try {
      const dataset = await readDataset();
      let jobs = normalizeDataset(dataset);
      jobs = applyFilters(jobs, req.query);

      const headers = [
        "Job ID",
        "Calendar Event ID",
        "Driver",
        "Customer",
        "Phone",
        "Pickup",
        "Dropoff",
        "Booked Start (London)",
        "Actual Start (London)",
        "Actual Finish (London)",
        "Scheduled Minutes",
        "Actual Minutes",
        "Delay (Minutes)",
        "Delay Band",
        "Status",
        "Base Price (£)",
        "Extra Charges (£)",
        "Overtime (£)",
        "Total (£)",
        "Payment Method",
        "Payment Status",
        "Evidence Status",
        "Drive Folder"
      ];

      const rows = jobs.map(j => [
        escapeCsvField(j.jobId),
        escapeCsvField(j.calendarEventId),
        escapeCsvField(j.driverName),
        escapeCsvField(j.customerName),
        escapeCsvField(j.customerPhone || ""),
        escapeCsvField(j.pickup),
        escapeCsvField(j.dropoff),
        escapeCsvField(formatLondonDate(j.bookedStart)),
        escapeCsvField(formatLondonDate(j.actualStart)),
        escapeCsvField(formatLondonDate(j.actualFinish)),
        escapeCsvField(j.bookedMinutes),
        escapeCsvField(j.actualMinutes || ""),
        escapeCsvField(j.delayMinutes),
        escapeCsvField(j.delayBand),
        escapeCsvField(j.status),
        escapeCsvField(toPounds(j.basePrice).toFixed(2)),
        escapeCsvField(toPounds(j.extraCharges).toFixed(2)),
        escapeCsvField(toPounds(j.overtimeCharge).toFixed(2)),
        escapeCsvField(toPounds(j.totalCharges).toFixed(2)),
        escapeCsvField(j.paymentMethod),
        escapeCsvField(j.paymentStatus),
        escapeCsvField(
          `Arr:${j.evidenceCompleteness.arrival} | Loaded:${j.evidenceCompleteness.vanLoaded} | Empty:${j.evidenceCompleteness.emptyVan} | Org:${j.evidenceCompleteness.organized} | Sig:${j.evidenceCompleteness.signature}`
        ),
        escapeCsvField(j.driveFolderUrl || "")
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="TMV-Jobs-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      return res.status(500).json({ error: { code: "CSV_EXPORT_FAILED", message: "Failed to generate CSV export." } });
    }
  });

  // Single Job Detail
  router.get("/:jobId", async (req, res) => {
    try {
      const jobId = String(req.params.jobId || "").trim();
      const dataset = await readDataset();
      const jobs = normalizeDataset(dataset);
      const job = jobs.find(j => j.jobId.toUpperCase() === jobId.toUpperCase());

      if (!job) {
        return res.status(404).json({
          error: { code: "JOB_NOT_FOUND", message: `Job ${jobId} not found.` }
        });
      }

      return res.status(200).json({
        job,
        meta: {
          fetchedAt: dataset.fetchedAt
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: { code: "JOB_FETCH_FAILED", message: "Failed to load job details." }
      });
    }
  });

  // Server-Side PDF Report Generation
  router.get("/:jobId/report.pdf", async (req, res) => {
    try {
      const jobId = String(req.params.jobId || "").trim();
      const dataset = await readDataset();
      const jobs = normalizeDataset(dataset);
      const job = jobs.find(j => j.jobId.toUpperCase() === jobId.toUpperCase());

      if (!job) {
        return res.status(404).json({
          error: { code: "JOB_NOT_FOUND", message: `Job ${jobId} not found.` }
        });
      }

      const pdfBuffer = generateJobPdf(job);

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="TMV-Job-${job.jobId}-${dateStr}.pdf"`);
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      return res.status(500).json({
        error: { code: "PDF_GENERATION_FAILED", message: "Failed to generate PDF report." }
      });
    }
  });

  // Paginated & Filtered Jobs List
  router.get("/", async (req, res) => {
    try {
      const dataset = await readDataset();
      let jobs = normalizeDataset(dataset);

      // Filters
      jobs = applyFilters(jobs, req.query);

      // Sorting
      const sort = typeof req.query.sort === "string" ? req.query.sort : "bookedStart";
      const dir = req.query.dir === "asc" ? "asc" : "desc";

      jobs.sort((a, b) => {
        let valA: any = (a as any)[sort];
        let valB: any = (b as any)[sort];

        if (valA === undefined || valA === null) valA = "";
        if (valB === undefined || valB === null) valB = "";

        if (typeof valA === "string") {
          return dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return dir === "asc" ? valA - valB : valB - valA;
      });

      // Pagination
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
      const total = jobs.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const paginatedItems = jobs.slice(startIndex, startIndex + pageSize);

      return res.status(200).json({
        items: paginatedItems,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasMore: page < totalPages
        },
        meta: {
          fetchedAt: dataset.fetchedAt,
          durationMs: dataset.durationMs
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: { code: "JOBS_FETCH_FAILED", message: "Failed to fetch jobs list." }
      });
    }
  });

  return router;
}

function applyFilters(jobs: NormalizedJob[], query: Record<string, any>): NormalizedJob[] {
  let list = jobs;

  const { from, to, q, status, driver, payMethod, payStatus, evidence } = query;

  if (typeof from === "string" && from) {
    list = list.filter(j => (j.actualStart || j.bookedStart) >= from);
  }
  if (typeof to === "string" && to) {
    list = list.filter(j => (j.actualStart || j.bookedStart) <= to);
  }
  if (typeof status === "string" && status && status !== "ALL") {
    list = list.filter(j => j.status === status);
  }
  if (typeof driver === "string" && driver && driver !== "ALL") {
    const dLower = driver.toLowerCase();
    list = list.filter(j => j.driverInitials.toLowerCase() === dLower || j.driverName.toLowerCase().includes(dLower));
  }
  if (typeof payMethod === "string" && payMethod && payMethod !== "ALL") {
    list = list.filter(j => j.paymentMethod.toLowerCase().includes(payMethod.toLowerCase()));
  }
  if (typeof payStatus === "string" && payStatus && payStatus !== "ALL") {
    list = list.filter(j => j.paymentStatus.toLowerCase() === payStatus.toLowerCase());
  }
  if (typeof evidence === "string" && evidence && evidence !== "ALL") {
    const eLower = evidence.toLowerCase();
    if (eLower === "complete") {
      list = list.filter(j =>
        j.evidenceCompleteness.arrival === "COMPLETED" &&
        j.evidenceCompleteness.vanLoaded === "COMPLETED" &&
        j.evidenceCompleteness.emptyVan === "COMPLETED" &&
        j.evidenceCompleteness.organized === "COMPLETED" &&
        j.evidenceCompleteness.signature === "COMPLETED"
      );
    } else if (eLower === "missing") {
      list = list.filter(j =>
        j.evidenceCompleteness.arrival === "MISSING" ||
        j.evidenceCompleteness.vanLoaded === "MISSING" ||
        j.evidenceCompleteness.emptyVan === "MISSING" ||
        j.evidenceCompleteness.organized === "MISSING" ||
        j.evidenceCompleteness.signature === "MISSING"
      );
    } else if (eLower === "processing") {
      list = list.filter(j =>
        j.evidenceCompleteness.arrival === "PROCESSING" ||
        j.evidenceCompleteness.vanLoaded === "PROCESSING" ||
        j.evidenceCompleteness.emptyVan === "PROCESSING" ||
        j.evidenceCompleteness.organized === "PROCESSING"
      );
    } else if (eLower === "failed") {
      list = list.filter(j =>
        j.evidenceCompleteness.arrival === "FAILED" ||
        j.evidenceCompleteness.vanLoaded === "FAILED" ||
        j.evidenceCompleteness.emptyVan === "FAILED" ||
        j.evidenceCompleteness.organized === "FAILED"
      );
    }
  }
  if (typeof q === "string" && q.trim()) {
    const term = q.trim().toLowerCase();
    list = list.filter(j =>
      j.jobId.toLowerCase().includes(term) ||
      j.customerName.toLowerCase().includes(term) ||
      (j.customerPhone && j.customerPhone.toLowerCase().includes(term)) ||
      (j.customerEmail && j.customerEmail.toLowerCase().includes(term)) ||
      j.pickup.toLowerCase().includes(term) ||
      j.dropoff.toLowerCase().includes(term) ||
      j.driverName.toLowerCase().includes(term) ||
      j.driverInitials.toLowerCase().includes(term)
    );
  }

  return list;
}
