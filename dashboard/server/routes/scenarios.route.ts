import { Router } from "express";
import { readDataset } from "../read/sheet-reader";

const SCENARIO_SHEET_MAP: Record<string, string> = {
  checkin: "checkIn",
  checkout: "checkOut",
  parking: "parking",
  liability: "liability"
};

function extractDriveIds(pipeUrls?: string): string[] {
  if (!pipeUrls) return [];
  return pipeUrls
    .split("|")
    .map(u => u.trim().match(/\/d\/([A-Za-z0-9_-]+)/)?.[1])
    .filter((id): id is string => Boolean(id));
}

export function scenariosRoute(): Router {
  const router = Router();

  router.get("/:kind", async (req, res) => {
    try {
      const kind = String(req.params.kind || "").toLowerCase();
      const datasetKey = SCENARIO_SHEET_MAP[kind];
      if (!datasetKey) {
        return res.status(404).json({ error: { code: "SCENARIO_NOT_FOUND", message: `Unknown scenario kind: ${kind}` } });
      }

      const dataset = await readDataset();
      const rawRows = (dataset as any)[datasetKey] as Record<string, string>[] || [];

      // Format rows with thumbnail proxies
      const rows = rawRows.map((r, index) => {
        const jobId = r["Job ID"] || "";
        const photoIds = extractDriveIds(r["Photo URLs"]);
        const sigId = extractDriveIds(r["Signature URL"])[0];

        return {
          id: `${kind}-${index}`,
          ...r,
          photos: photoIds.map(fid => ({
            fileId: fid,
            thumbUrl: `/ops/api/jobs/${encodeURIComponent(jobId)}/photos/${encodeURIComponent(fid)}`
          })),
          signature: sigId ? {
            fileId: sigId,
            thumbUrl: `/ops/api/jobs/${encodeURIComponent(jobId)}/photos/${encodeURIComponent(sigId)}`
          } : null
        };
      }).reverse(); // Latest first

      // Pagination
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
      const total = rows.length;
      const totalPages = Math.ceil(total / pageSize);
      const items = rows.slice((page - 1) * pageSize, page * pageSize);

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
