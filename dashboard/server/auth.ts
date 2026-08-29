import { createHmac, timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../../src/config/env";
import { checkAdminPassword } from "../../src/admin/admin.auth";

const COOKIE_NAME = "tmv_admin";
const OPS_COOKIE_NAME = "tmv_ops_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const WINDOW_MS = Number(process.env.TMV_DASHBOARD_RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.TMV_DASHBOARD_RATE_LIMIT_MAX) || 120;

function sign(exp: number): string {
  // No fallback key: src/server.ts's assertRuntimeConfig() already requires
  // TMV_SIGNATURE_LINK_SECRET to be set whenever NODE_ENV=production, but that check
  // doesn't fire for a deployment that's reachable without NODE_ENV actually set to
  // "production". A hardcoded fallback string here was a real login bypass in that
  // case: it's public (baked into this open-source-style code), so anyone could
  // compute a valid session cookie with it and skip the password entirely. Matching
  // src/admin/admin.auth.ts's sign(), which has never had this fallback.
  return createHmac("sha256", env.signatureLinkSecret).update(`admin-session.${exp}`).digest("hex");
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function hasValidOpsSession(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[OPS_COOKIE_NAME] || cookies[COOKIE_NAME];
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot === -1) return false;
  const exp = Number(raw.slice(0, dot));
  const sig = raw.slice(dot + 1);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return safeEqual(sig, sign(exp));
}

export function issueOpsCookie(res: Response): void {
  const exp = Date.now() + SESSION_TTL_MS;
  const value = `${exp}.${sign(exp)}`;
  // Path=/ ensures session works across both /admin and /admin
  res.setHeader(
    "Set-Cookie",
    [
      `${OPS_COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}` +
        (env.nodeEnv === "production" ? "; Secure" : ""),
      `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}` +
        (env.nodeEnv === "production" ? "; Secure" : "")
    ]
  );
}

export function clearOpsCookie(res: Response): void {
  res.setHeader("Set-Cookie", [
    `${OPS_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`,
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`
  ]);
}

/**
 * In-memory sliding-window rate limiter for /admin routes.
 */
export function dashboardRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS) {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please slow down."
      }
    });
    return;
  }

  record.count++;
  return next();
}

/**
 * Enforces session authentication for /admin endpoints.
 */
export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  if (hasValidOpsSession(req)) {
    return next();
  }

  // Allow static assets, favicon, and login API
  if (
    req.path.startsWith("/assets/") ||
    req.path === "/api/auth/login" ||
    req.path === "/api/auth/status" ||
    req.path === "/login"
  ) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Admin authentication required."
      }
    });
    return;
  }

  // For HTML requests, serve the modern SPA (which will display the login screen)
  return next();
}
