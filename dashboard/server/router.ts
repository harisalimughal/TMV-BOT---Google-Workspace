import express, { Request, Response, Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { dashboardRateLimit, requireDashboardAuth } from "./auth";
import { sheetCache } from "./read/cache";
import { readDataset } from "./read/sheet-reader";
import { activityRoute } from "./routes/activity.route";
import { driversRoute } from "./routes/drivers.route";
import { exceptionsRoute } from "./routes/exceptions.route";
import { financeRoute } from "./routes/finance.route";
import { jobsRoute } from "./routes/jobs.route";
import { photosRoute } from "./routes/photos.route";
import { scenariosRoute } from "./routes/scenarios.route";
import { summaryRoute } from "./routes/summary.route";

export function dashboardRouter(): Router {
  const router = Router();

  // Authentication & Rate Limiting guard for all /ops routes
  router.use(requireDashboardAuth);
  router.use(dashboardRateLimit);

  // Mount API endpoints under /api
  const api = Router();

  api.use("/summary", summaryRoute());
  api.use("/jobs", jobsRoute());
  api.use("/jobs", photosRoute());
  api.use("/drivers", driversRoute());
  api.use("/finance", financeRoute());
  api.use("/exceptions", exceptionsRoute());
  api.use("/scenarios", scenariosRoute());
  api.use("/activity", activityRoute());

  // Force cache refresh endpoint
  api.post("/refresh", async (_req: Request, res: Response) => {
    try {
      sheetCache.invalidate();
      const dataset = await readDataset({ forceRefresh: true });
      res.status(200).json({
        ok: true,
        meta: {
          fetchedAt: dataset.fetchedAt,
          durationMs: dataset.durationMs
        }
      });
    } catch (error) {
      res.status(500).json({
        error: { code: "REFRESH_FAILED", message: "Failed to force refresh dataset." }
      });
    }
  });

  router.use("/api", api);

  // Serve static assets from dashboard/web/dist if built
  const distPath = path.resolve(__dirname, "../../dashboard/web/dist");
  const fallbackDistPath = path.resolve(process.cwd(), "dashboard/web/dist");
  const finalDistPath = fs.existsSync(distPath) ? distPath : fallbackDistPath;

  if (fs.existsSync(finalDistPath)) {
    router.use(express.static(finalDistPath));
    router.get("*", (_req, res) => {
      const indexHtml = path.join(finalDistPath, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(200).send(defaultOpsShell());
      }
    });
  } else {
    // If frontend hasn't been built to dist yet, serve shell
    router.get("*", (_req, res) => {
      res.status(200).send(defaultOpsShell());
    });
  }

  return router;
}

function defaultOpsShell(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TMV Operations Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0A1A2F; color: #F1F4F8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #12263F; border: 1px solid #25436B; border-radius: 10px; padding: 32px; max-width: 480px; text-align: center; }
    h1 { color: #5EC8F0; font-size: 20px; margin: 0 0 12px; }
    p { color: #C3CEDC; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
    a { color: #29ABE2; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>TMV Operations Dashboard (/ops)</h1>
    <p>The dashboard API is online and authenticated. Building frontend bundle...</p>
    <a href="/ops/api/summary">View API Summary JSON &rarr;</a>
  </div>
</body>
</html>`;
}
