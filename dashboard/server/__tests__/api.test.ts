import express from "express";
import { describe, expect, it } from "vitest";
import { issueOpsCookie } from "../auth";
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

    // issueOpsCookie is the dashboard's own cookie issuer -- signing a cookie with
    // src/admin/admin.auth.ts's issueSessionCookie instead would only work if
    // env.signatureLinkSecret happens to be truthy at module-load time (it falls
    // back to a different default in dashboard/server/auth.ts's sign() when empty),
    // and process.env writes here can't retroactively change the already-imported
    // env singleton either way.
    const mockRes: any = {
      headers: {},
      setHeader(name: string, val: string | string[]) {
        this.headers[name.toLowerCase()] = Array.isArray(val) ? val[0] : val;
      }
    };
    issueOpsCookie(mockRes);
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
