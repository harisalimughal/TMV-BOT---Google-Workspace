import { Router } from "express";
import { readDataset } from "../read/sheet-reader";
import { toUtcIso } from "../normalize/timezone";

export function activityRoute(): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;

      const dataset = await readDataset();
      let list = dataset.activity.map((a, i) => ({
        id: `act-${i}`,
        timestamp: toUtcIso(a["Timestamp"]),
        jobId: a["Job ID"] || "—",
        driver: a["Driver"] || "Not recorded",
        action: a["Action"] || "",
        fromState: a["From State"] || undefined,
        toState: a["To State"] || undefined,
        detail: a["Detail"] || undefined
      })).reverse(); // Latest first

      if (from) list = list.filter(a => a.timestamp >= from);
      if (to) list = list.filter(a => a.timestamp <= to);

      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
      const total = list.length;
      const totalPages = Math.ceil(total / pageSize);
      const items = list.slice((page - 1) * pageSize, page * pageSize);

      return res.status(200).json({
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
        error: { code: "ACTIVITY_FETCH_FAILED", message: "Failed to fetch activity log." }
      });
    }
  });

  return router;
}
