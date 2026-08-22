import { Router } from "express";
import { formatGBP, toPounds } from "../../../src/utils/money";
import { normalizeDataset } from "../normalize/normalize";
import { formatLondonDate } from "../normalize/timezone";
import { NormalizedJob } from "../normalize/types";
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

      const { generateJobPdf } = await import("../pdf/pdf-generator");
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
