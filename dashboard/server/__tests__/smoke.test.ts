import express from "express";
import { describe, expect, it } from "vitest";
import { issueSessionCookie } from "../../../src/admin/admin.auth";
import { dashboardRouter } from "../router";

describe("TMV Dashboard /ops Smoke Test", () => {
  const app = express();
  app.use(express.json());
  app.use("/ops", dashboardRouter());
  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  it("answers healthz endpoint untouched", async () => {
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    } finally {
      server.close();
    }
  });

  it("serves the dashboard static frontend at /ops", async () => {
    const server = app.listen(0);
    const port = (server.address() as any).port;

    const mockRes: any = {
      headers: {},
      setHeader(name: string, val: string) {
        this.headers[name.toLowerCase()] = val;
      }
    };
    process.env.TMV_ADMIN_PASSWORD = "test-password";
    process.env.TMV_SIGNATURE_LINK_SECRET = "test-secret-key-for-signing-session-cookies";
    issueSessionCookie(mockRes);
    const cookieHeader = mockRes.headers["set-cookie"]?.split(";")[0];

    try {
      const res = await fetch(`http://127.0.0.1:${port}/ops`, {
        headers: { Cookie: cookieHeader }
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html.includes("TMV Operations Dashboard") || html.includes("<!doctype html>")).toBe(true);
    } finally {
      server.close();
    }
  });

  it("serves live API summary at /ops/api/summary", async () => {
    const server = app.listen(0);
    const port = (server.address() as any).port;

    const mockRes: any = {
      headers: {},
      setHeader(name: string, val: string) {
        this.headers[name.toLowerCase()] = val;
      }
    };
    issueSessionCookie(mockRes);
    const cookieHeader = mockRes.headers["set-cookie"]?.split(";")[0];

    try {
      const res = await fetch(`http://127.0.0.1:${port}/ops/api/summary`, {
        headers: { Cookie: cookieHeader }
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.kpis).toBeDefined();
      expect(data.kpis.totalJobs).toBeGreaterThanOrEqual(0);
      expect(data.charts).toBeDefined();
    } finally {
      server.close();
    }
  });
});
