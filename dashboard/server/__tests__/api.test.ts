import express from "express";
import { describe, expect, it } from "vitest";
import { issueSessionCookie } from "../../../src/admin/admin.auth";
import { dashboardRouter } from "../router";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/ops", dashboardRouter());
  return app;
}

describe("Dashboard API & Auth Gates (/ops/api/*)", () => {
  it("rejects unauthenticated requests to /ops/api/summary with 401", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/ops/api/summary`);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    } finally {
      server.close();
    }
  });

  it("rejects unauthenticated requests to /ops/api/jobs with 401", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/ops/api/jobs`);
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("rejects malformed fileId on photo proxy with 400", async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    // Create a mock response to issue cookie
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
      const res = await fetch(`http://127.0.0.1:${port}/ops/api/jobs/TMV-123/photos/invalid!id!with!bad!chars`, {
        headers: { Cookie: cookieHeader }
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("INVALID_FILE_ID");
    } finally {
      server.close();
    }
  });
});
