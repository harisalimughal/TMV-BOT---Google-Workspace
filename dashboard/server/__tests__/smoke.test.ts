import express from "express";
import { describe, expect, it, vi } from "vitest";
import { issueOpsCookie } from "../auth";
import { dashboardRouter } from "../router";

// Stubs the real Google Sheets/auth clients so this suite never depends on ambient
// gcloud credentials or a real spreadsheet existing -- same technique verify/*.js
// already uses for the classic bot's own E2E scripts, just as a vitest module mock
// instead of a require.cache patch. Every batchGet range comes back empty (no header
// row), so readDataset() resolves to an all-empty dataset rather than throwing.
vi.mock("googleapis", () => ({
  google: {
    sheets: () => ({
      spreadsheets: {
        get: async () => ({ data: { sheets: [] } }),
        values: {
          batchGet: async ({ ranges }: { ranges: string[] }) => ({
            data: { valueRanges: ranges.map(() => ({ values: [] })) }
          }),
          batchUpdate: async () => ({ data: {} })
        },
        batchUpdate: async () => ({ data: {} })
      }
    }),
    drive: () => ({ files: { list: async () => ({ data: { files: [] } }), create: async () => ({ data: {} }) } }),
    calendar: () => ({ events: { list: async () => ({ data: { items: [] } }) } }),
    auth: { GoogleAuth: class {}, JWT: class { async getAccessToken() { return { token: "fake" }; } } }
  }
}));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {},
  JWT: class {
    async getAccessToken() {
      return { token: "fake" };
    }
  },
  GoogleAuth: class {
    async getClient() {
      return { getAccessToken: async () => ({ token: "fake" }) };
    }
  }
}));

function mockCookieRes() {
  return {
    headers: {} as Record<string, string>,
    setHeader(name: string, val: string | string[]) {
      this.headers[name.toLowerCase()] = Array.isArray(val) ? val[0] : val;
    }
  };
}

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

    const mockRes = mockCookieRes();
    issueOpsCookie(mockRes as any);
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

    const mockRes = mockCookieRes();
    issueOpsCookie(mockRes as any);
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
