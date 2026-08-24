import { Router } from "express";
import { addPence, formatGBP, pence, toPounds } from "../../../src/utils/money";
import { normalizeDataset } from "../normalize/normalize";
import { readDataset } from "../read/sheet-reader";

export function driversRoute(): Router {
  const router = Router();

  router.get("/summary", async (req, res) => {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;

      const dataset = await readDataset();
      let jobs = normalizeDataset(dataset);

      if (from) jobs = jobs.filter(j => (j.actualStart || j.bookedStart) >= from);
      if (to) jobs = jobs.filter(j => (j.actualStart || j.bookedStart) <= to);

      const driverStats = new Map<string, {
        initials: string;
        fullName: string;
        email?: string;
        active: boolean;
        assignedCount: number;
        completedCount: number;
        cancelledCount: number;
        totalDurationMinutes: number;
        durationJobsCount: number;
        totalDelayMinutes: number;
        delayJobsCount: number;
        revenuePence: number;
        cashCollectedPence: number;
        missingEvidenceCount: number;
        overtimeCount: number;
      }>();

      // Seed from Drivers sheet
      for (const d of dataset.drivers) {
        const init = String(d["Initials"] || "").trim().toUpperCase();
        if (!init) continue;
        driverStats.set(init, {
          initials: init,
          fullName: d["Full Name"] || init,
          email: d["Email"] || undefined,
          active: d["Active"] === "TRUE" || d["Active"] === "true" || d["Active"] === "1",
          assignedCount: 0,
          completedCount: 0,
          cancelledCount: 0,
          totalDurationMinutes: 0,
          durationJobsCount: 0,
          totalDelayMinutes: 0,
          delayJobsCount: 0,
          revenuePence: 0,
          cashCollectedPence: 0,
          missingEvidenceCount: 0,
          overtimeCount: 0
        });
      }

      // Aggregate from Jobs
      for (const j of jobs) {
        const init = j.driverInitials || "UNASSIGNED";
        let stat = driverStats.get(init);
        if (!stat) {
          stat = {
            initials: init,
            fullName: j.driverName || init,
            email: j.driverEmail,
            active: true,
            assignedCount: 0,
            completedCount: 0,
            cancelledCount: 0,
            totalDurationMinutes: 0,
            durationJobsCount: 0,
            totalDelayMinutes: 0,
            delayJobsCount: 0,
            revenuePence: 0,
            cashCollectedPence: 0,
            missingEvidenceCount: 0,
            overtimeCount: 0
          };
          driverStats.set(init, stat);
        }

        stat.assignedCount++;
        if (j.status === "COMPLETED") {
          stat.completedCount++;
          stat.revenuePence += j.totalCharges;
          if (j.paymentMethod.toLowerCase().includes("cash")) {
            stat.cashCollectedPence += j.totalCharges;
          }
        } else if (j.status === "CANCELLED") {
          stat.cancelledCount++;
        }

        if (j.actualMinutes && j.actualMinutes > 0) {
          stat.totalDurationMinutes += j.actualMinutes;
          stat.durationJobsCount++;
        }
        if (j.delayMinutes !== undefined) {
          stat.totalDelayMinutes += j.delayMinutes;
          stat.delayJobsCount++;
        }

        if (j.overtimeMinutes > 0) {
          stat.overtimeCount++;
        }

        const comp = j.evidenceCompleteness;
        const missing = [comp.arrival, comp.vanLoaded, comp.emptyVan, comp.organized, comp.signature].filter(
          s => s === "MISSING" || s === "FAILED"
        ).length;
        stat.missingEvidenceCount += missing;
      }

      const items = [...driverStats.values()].map(s => {
        const effectiveAssigned = s.assignedCount - s.cancelledCount;
        const completionRate = effectiveAssigned > 0 ? Math.round((s.completedCount / effectiveAssigned) * 100) : 0;
        const avgDuration = s.durationJobsCount > 0 ? Math.round(s.totalDurationMinutes / s.durationJobsCount) : 0;
        const avgDelay = s.delayJobsCount > 0 ? Math.round(s.totalDelayMinutes / s.delayJobsCount) : 0;

        return {
          initials: s.initials,
          fullName: s.fullName,
          email: s.email,
          active: s.active,
          assigned: s.assignedCount,
          completed: s.completedCount,
          cancelled: s.cancelledCount,
          completionRate,
          avgDurationMinutes: avgDuration,
          avgDelayMinutes: avgDelay,
          revenuePounds: toPounds(pence(s.revenuePence)),
          revenueFormatted: formatGBP(pence(s.revenuePence)),
          cashCollectedPounds: toPounds(pence(s.cashCollectedPence)),
          missingEvidenceCount: s.missingEvidenceCount,
          overtimeCount: s.overtimeCount
        };
      }).sort((a, b) => b.completed - a.completed);

      return res.status(200).json({
        drivers: items,
        meta: {
          fetchedAt: dataset.fetchedAt
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: { code: "DRIVERS_FETCH_FAILED", message: "Failed to fetch driver performance summary." }
      });
    }
  });

  return router;
}
