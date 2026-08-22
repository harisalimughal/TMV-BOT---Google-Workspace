import { createHmac, timingSafeEqual } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

const COOKIE_NAME = "tmv_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sign(exp: number): string {
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

/** Constant-time check against the single shared admin password. */
export function checkAdminPassword(candidate: string): boolean {
  if (!env.adminPassword || !candidate) return false;
  return safeEqual(candidate, env.adminPassword);
}

export function issueSessionCookie(res: Response): void {
  const exp = Date.now() + SESSION_TTL_MS;
  const value = `${exp}.${sign(exp)}`;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; Path=/admin; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}` +
      (env.nodeEnv === "production" ? "; Secure" : "")
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/admin; Max-Age=0`);
}

function hasValidSession(req: Request): boolean {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot === -1) return false;
  const exp = Number(raw.slice(0, dot));
  const sig = raw.slice(dot + 1);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return safeEqual(sig, sign(exp));
}

/** Everything under /admin except the login page/action requires a valid session. */
export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (hasValidSession(req)) return next();
  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Not logged in." });
    return;
  }
  res.redirect(302, "/admin/login");
}
