import express, { Request, Response, Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { checkAdminPassword } from "../../src/admin/admin.auth";
import { clearOpsCookie, dashboardRateLimit, hasValidOpsSession, issueOpsCookie, requireDashboardAuth } from "./auth";
import { activityRoute } from "./routes/activity.route";
import { driversRoute } from "./routes/drivers.route";
import { exceptionsRoute } from "./routes/exceptions.route";
import { financeRoute } from "./routes/finance.route";
import { fleetRoute } from "./routes/fleet.route";
import { jobsRoute } from "./routes/jobs.route";
import { notificationsRoute } from "./routes/notifications.route";
import { scenariosRoute } from "./routes/scenarios.route";
import { settingsRoute } from "./routes/settings.route";
import { summaryRoute } from "./routes/summary.route";

export function dashboardRouter(options: { serveAppShell?: boolean } = {}): Router {
  const { serveAppShell = true } = options;
  const router = Router();

  // Authentication & Rate Limiting guard for all /admin routes
  router.use(dashboardRateLimit);
  router.use(requireDashboardAuth);

  // Mount API endpoints under /api
  const api = Router();

  // Auth endpoints for the modern SPA
  api.post("/auth/login", (req: Request, res: Response) => {
    const password = String(req.body?.password || "").trim();
    if (checkAdminPassword(password)) {
      issueOpsCookie(res);
      return res.status(200).json({ ok: true, message: "Authenticated successfully" });
    }
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Incorrect admin password" } });
  });

  api.get("/auth/status", (req: Request, res: Response) => {
    const authenticated = hasValidOpsSession(req);
    return res.status(200).json({ authenticated });
  });

  api.post("/auth/logout", (_req: Request, res: Response) => {
    clearOpsCookie(res);
    return res.status(200).json({ ok: true });
  });

  api.use("/summary", summaryRoute());
  api.use("/jobs", jobsRoute());
  api.use("/drivers", driversRoute());
  api.use("/finance", financeRoute());
  api.use("/exceptions", exceptionsRoute());
  api.use("/fleet", fleetRoute());
  api.use("/scenarios", scenariosRoute());
  api.use("/activity", activityRoute());
  api.use("/settings", settingsRoute());
  api.use("/notifications", notificationsRoute());

  // Kept for the frontend's existing "Refresh" button -- a no-op now rather than
  // removed outright. Mongo reads (jobs/evidence/activity/scenario_submissions) have
  // no cache to invalidate, unlike the old Sheets-backed sheetCache this used to
  // clear; the Drivers-roster lookup still goes through Sheets (see
  // normalize-mongo.ts) and has its own short TTL (env.driverCacheTtlMs) that clears
  // itself quickly regardless.
  api.post("/refresh", async (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, meta: { fetchedAt: new Date().toISOString() } });
  });

  router.use("/api", api);

  // Serve static assets from dashboard/web/dist if built
  const distPath = path.resolve(__dirname, "../../dashboard/web/dist");
  const fallbackDistPath = path.resolve(process.cwd(), "dashboard/web/dist");
  const finalDistPath = fs.existsSync(distPath) ? distPath : fallbackDistPath;

  if (fs.existsSync(finalDistPath)) {
    // index: false when not the app shell entry point, so a bare request to this
    // mount's root doesn't fall back to serving index.html (serve-static's default
    // directory-index behavior) -- only explicitly-named files (assets, images) resolve.
    router.use(express.static(finalDistPath, serveAppShell ? {} : { index: false }));
    if (serveAppShell) {
      router.get("*", (_req, res) => {
        const indexHtml = path.join(finalDistPath, "index.html");
        if (fs.existsSync(indexHtml)) {
          res.sendFile(indexHtml);
        } else {
          res.status(200).send(defaultOpsShell());
        }
      });
    }
  } else if (serveAppShell) {
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
    <h1>TMV Operations Dashboard (/admin)</h1>
    <p>The dashboard API is online and authenticated. Building frontend bundle...</p>
    <a href="/admin/api/summary">View API Summary JSON &rarr;</a>
  </div>
</body>
</html>`;
}
