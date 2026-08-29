import { Router } from "express";
import { SCHEMA, SHEETS } from "../../../src/google/sheets";
import { readDataset } from "../read/sheet-reader";

const SCENARIO_SHEET_MAP: Record<string, string> = {
  checkin: "checkIn",
  checkout: "checkOut",
  parking: "parking",
  liability: "liability"
};

const SCENARIO_SCHEMA_SHEET: Record<string, string> = {
  checkin: SHEETS.STORAGE_CHECK_IN,
  checkout: SHEETS.STORAGE_CHECK_OUT,
  parking: SHEETS.PARKING_LIABILITY,
  liability: SHEETS.LIABILITY_REPORT
};

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

function extractDriveIds(pipeUrls?: string): string[] {
  if (!pipeUrls) return [];
  return pipeUrls
    .split("|")
    .map(u => u.trim().match(/\/d\/([A-Za-z0-9_-]+)/)?.[1])
    .filter((id): id is string => Boolean(id));
}

export function scenariosRoute(): Router {
  const router = Router();

  // Full-table export (every row, not just the current page) -- matches the classic
  // /admin panel's generic table export, which ScenariosPage.tsx's Export CSV button
  // otherwise has no real endpoint to call.
  router.get("/:kind/export.csv", async (req, res) => {
    try {
      const kind = String(req.params.kind || "").toLowerCase();
      const datasetKey = SCENARIO_SHEET_MAP[kind];
      const schemaSheet = SCENARIO_SCHEMA_SHEET[kind];
      if (!datasetKey) {
        return res.status(404).json({ error: { code: "SCENARIO_NOT_FOUND", message: `Unknown scenario kind: ${kind}` } });
      }

      const dataset = await readDataset();
      const rows = ((dataset as any)[datasetKey] as Record<string, string>[]) || [];
      const columns = SCHEMA[schemaSheet] ?? (rows[0] ? Object.keys(rows[0]) : []);

      const csvContent = "﻿" + [
        columns.map(escapeCsvField).join(","),
        ...rows.map(row => columns.map(c => escapeCsvField(row[c])).join(","))
      ].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="TMV-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csvContent);
    } catch (error) {
      return res.status(500).json({ error: { code: "CSV_EXPORT_FAILED", message: "Failed to generate CSV export." } });
    }
  });

  router.get("/:kind", async (req, res) => {
    try {
      const kind = String(req.params.kind || "").toLowerCase();
      const datasetKey = SCENARIO_SHEET_MAP[kind];
      if (!datasetKey) {
        return res.status(404).json({ error: { code: "SCENARIO_NOT_FOUND", message: `Unknown scenario kind: ${kind}` } });
      }

      const dataset = await readDataset();
      const rawRows = ((dataset as any)[datasetKey] as Record<string, string>[]) || [];

      // Calculate occurrence count per Job ID to distinguish multiple events
      const jobCounts = new Map<string, number>();
      for (const r of rawRows) {
        const jId = (r["Job ID"] || "").trim().toUpperCase();
        if (jId) jobCounts.set(jId, (jobCounts.get(jId) || 0) + 1);
      }

      // Track running event index per job ID
      const jobRunningIndex = new Map<string, number>();

      // Format rows with thumbnail proxies and event labeling
      const formattedRows = rawRows.map((r, index) => {
        const jobId = (r["Job ID"] || "").trim();
        const jIdKey = jobId.toUpperCase();
        const totalEventsForJob = jobCounts.get(jIdKey) || 1;
        const currentEventIdx = (jobRunningIndex.get(jIdKey) || 0) + 1;
        jobRunningIndex.set(jIdKey, currentEventIdx);

        const photoIds = extractDriveIds(r["Photo URLs"]);
        const sigId = extractDriveIds(r["Signature URL"])[0];

        return {
          id: `${kind}-${index}`,
          jobId: jobId || "UNASSIGNED",
          eventLabel: totalEventsForJob > 1 ? `Event ${currentEventIdx} of ${totalEventsForJob}` : undefined,
          totalEventsForJob,
          eventIndex: currentEventIdx,
          timestamp: r["Timestamp"] || r["Date"] || "",
          driver: r["Driver"] || "—",
          clientName: r["Client Name"] || r["Client Full Name"] || "—",
          clientPhone: r["Client Phone"] || "",
          clientEmail: r["Client Email"] || "",
          containerNumber: r["Container Number"] || "—",
          address: r["Address"] || "",
          damageCategories: r["Damage Categories"] || "",
          clientPresent: r["Client Present"] || r["Client Present At Dropoff"] || "—",
          rawRecord: r,
          photos: photoIds.map(fid => ({
            fileId: fid,
            thumbUrl: `/admin/api/jobs/${encodeURIComponent(jobId || "TEMP")}/photos/${encodeURIComponent(fid)}`
          })),
          signature: sigId ? {
            fileId: sigId,
            thumbUrl: `/admin/api/jobs/${encodeURIComponent(jobId || "TEMP")}/photos/${encodeURIComponent(sigId)}`
          } : null
        };
      }).reverse(); // Latest events first

      // Pagination
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
      const total = formattedRows.length;
      const totalPages = Math.ceil(total / pageSize);
      const items = formattedRows.slice((page - 1) * pageSize, page * pageSize);

      return res.status(200).json({
        kind,
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasMore: page < totalPages
        },
        meta: {
          fetchedAt: dataset.fetchedAt
        }
      });
    } catch (error) {
      return res.status(500).json({
        error: { code: "SCENARIOS_FETCH_FAILED", message: "Failed to fetch scenario data." }
      });
    }
  });

  return router;
}
