import { Router } from "express";
import { normalizeDataset } from "../normalize/normalize";
import { readDataset } from "../read/sheet-reader";

export function exceptionsRoute(): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const typeFilter = typeof req.query.type === "string" ? req.query.type : undefined;
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;

      const dataset = await readDataset();
      const jobs = normalizeDataset(dataset);

      const items: Array<{
        id: string;
        jobId: string;
        type: string;
        severity: "CRITICAL" | "WARNING" | "INFO";
        detail: string;
        timestamp: string;
        customerName: string;
        driverName: string;
        linkUrl: string;
      }> = [];

      // 1. Unhandled errors from ExceptionReport sheet
      for (let i = 0; i < dataset.exceptions.length; i++) {
        const ex = dataset.exceptions[i];
        const jobId = ex["Job ID"] || "UNKNOWN";
        const matchingJob = jobs.find(j => j.jobId === jobId);
        items.push({
          id: `sheet-ex-${i}`,
          jobId,
          type: ex["Type"] || "SYSTEM_EXCEPTION",
          severity: "CRITICAL",
          detail: ex["Detail"] || "Recorded system exception",
          timestamp: ex["Timestamp"] || dataset.fetchedAt,
          customerName: matchingJob?.customerName || "—",
          driverName: matchingJob?.driverName || "—",
          linkUrl: jobId !== "UNKNOWN" ? `/ops?job=${encodeURIComponent(jobId)}` : "/ops"
        });
      }

      // 2. Derived exceptions from jobs
      for (const j of jobs) {
        // Late finish or extreme delay (>30 min)
        if (j.delayMinutes > 30) {
          items.push({
            id: `delay-over30-${j.jobId}`,
            jobId: j.jobId,
            type: "EXTREME_DELAY",
            severity: "CRITICAL",
            detail: `Job started ${j.delayMinutes} minutes late (scheduled ${j.bookedStart})`,
            timestamp: j.actualStart || j.bookedStart,
            customerName: j.customerName,
            driverName: j.driverName,
            linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
          });
        } else if (j.delayMinutes > 15) {
          items.push({
            id: `delay-15-${j.jobId}`,
            jobId: j.jobId,
            type: "LATE_START",
            severity: "WARNING",
            detail: `Job started ${j.delayMinutes} minutes late`,
            timestamp: j.actualStart || j.bookedStart,
            customerName: j.customerName,
            driverName: j.driverName,
            linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
          });
        }

        // Missing Evidence on completed jobs
        if (j.status === "COMPLETED") {
          const comp = j.evidenceCompleteness;
          if (comp.arrival === "MISSING") {
            items.push({
              id: `missing-arr-${j.jobId}`,
              jobId: j.jobId,
              type: "MISSING_ARRIVAL_PHOTO",
              severity: "WARNING",
              detail: "Completed job lacks mandatory Arrival photograph",
              timestamp: j.updated || j.created,
              customerName: j.customerName,
              driverName: j.driverName,
              linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
            });
          }
          if (comp.vanLoaded === "MISSING") {
            items.push({
              id: `missing-loaded-${j.jobId}`,
              jobId: j.jobId,
              type: "MISSING_LOADED_PHOTO",
              severity: "WARNING",
              detail: "Completed job lacks mandatory Van-Loaded photograph",
              timestamp: j.updated || j.created,
              customerName: j.customerName,
              driverName: j.driverName,
              linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
            });
          }
          if (comp.emptyVan === "MISSING") {
            items.push({
              id: `missing-empty-${j.jobId}`,
              jobId: j.jobId,
              type: "MISSING_EMPTY_VAN_PHOTO",
              severity: "WARNING",
              detail: "Completed job lacks mandatory Empty-Van photograph",
              timestamp: j.updated || j.created,
              customerName: j.customerName,
              driverName: j.driverName,
              linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
            });
          }
          if (comp.signature === "MISSING") {
            items.push({
              id: `missing-sig-${j.jobId}`,
              jobId: j.jobId,
              type: "MISSING_SIGNATURE",
              severity: "CRITICAL",
              detail: "Completed job lacks customer confirmation signature",
              timestamp: j.updated || j.created,
              customerName: j.customerName,
              driverName: j.driverName,
              linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
            });
          }
        }

        // Upload Failures
        for (const ev of j.evidenceItems) {
          if (ev.state === "FAILED") {
            items.push({
              id: `failed-upload-${ev.id}`,
              jobId: j.jobId,
              type: "EVIDENCE_UPLOAD_FAILED",
              severity: "CRITICAL",
              detail: `Evidence upload failed for ${ev.category}: ${ev.error || "Upload error"}`,
              timestamp: ev.receivedAt || j.updated,
              customerName: j.customerName,
              driverName: j.driverName,
              linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
            });
          }
        }

        // Unreconciled financials
        if (!j.reconciled && j.status === "COMPLETED") {
          items.push({
            id: `unreconciled-${j.jobId}`,
            jobId: j.jobId,
            type: "FINANCE_UNRECONCILED",
            severity: "WARNING",
            detail: "Sum of Base Price, Extras and Overtime does not reconcile against Total Charges",
            timestamp: j.updated,
            customerName: j.customerName,
            driverName: j.driverName,
            linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
          });
        }

        // Non-London timezone offsets
        if (!j.timingTrustworthy) {
          items.push({
            id: `tz-corrupt-${j.jobId}`,
            jobId: j.jobId,
            type: "TIMING_UNTRUSTWORTHY",
            severity: "INFO",
            detail: "Recorded timestamp carries a non-London offset (+05:00)",
            timestamp: j.bookedStart,
            customerName: j.customerName,
            driverName: j.driverName,
            linkUrl: `/ops?job=${encodeURIComponent(j.jobId)}`
          });
        }
      }

      const isBadge = req.query.badge === "true";
      const isRecentOnly = req.query.recent === "true" || isBadge;

      let filtered = items;
      if (isRecentOnly && !from) {
        // Default to active moves + moves in the past 14 days for the active badge
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        filtered = filtered.filter(it => it.timestamp >= fourteenDaysAgo);
      }

      if (typeFilter && typeFilter !== "ALL") {
        filtered = filtered.filter(it => it.type === typeFilter);
      }
      if (from) {
        filtered = filtered.filter(it => it.timestamp >= from);
      }
      if (to) {
        filtered = filtered.filter(it => it.timestamp <= to);
      }

      // Group counts by type
      const countByType = new Map<string, number>();
      for (const it of items) {
        countByType.set(it.type, (countByType.get(it.type) || 0) + 1);
      }

      return res.status(200).json({
        total: filtered.length,
        unfilteredTotal: items.length,
        activeBadgeCount: isRecentOnly ? filtered.length : items.length,
        items: filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
        types: [...countByType.entries()].map(([type, count]) => ({ type, count })),
        meta: {
          fetchedAt: dataset.fetchedAt
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: { code: "EXCEPTIONS_FETCH_FAILED", message: "Failed to fetch exceptions." }
      });
    }
  });

  return router;
}
