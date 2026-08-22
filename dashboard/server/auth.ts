import { NextFunction, Request, Response } from "express";
import { requireAdminSession } from "../../src/admin/admin.auth";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const WINDOW_MS = Number(process.env.TMV_DASHBOARD_RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.TMV_DASHBOARD_RATE_LIMIT_MAX) || 120;

/**
 * In-memory sliding-window rate limiter for /ops routes.
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
 * Enforces session authentication for /ops endpoints.
 * Returns structured JSON error for API requests, redirects browser to /admin/login for HTML requests.
 */
export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  requireAdminSession(req, res, next);
}
