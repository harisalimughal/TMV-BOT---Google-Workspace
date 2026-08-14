import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

/** How long a signature-pad link stays valid after a card renders it. */
export const SIGNATURE_LINK_TTL_MS = 30 * 60 * 1000;

function sign(jobId: string, exp: number): string {
  return createHmac("sha256", env.signatureLinkSecret).update(`${jobId}.${exp}`).digest("hex");
}

/** Builds the public, time-limited URL a driver's "OPEN SIGNATURE PAD" button opens. */
export function signatureLinkFor(jobId: string): string {
  const exp = Date.now() + SIGNATURE_LINK_TTL_MS;
  return `${env.workerBaseUrl}/sign/${encodeURIComponent(jobId)}?exp=${exp}&sig=${sign(jobId, exp)}`;
}

/** Verifies the exp/sig query params a GET or POST to /sign/:jobId carries. */
export function verifySignatureLink(jobId: string, expRaw: unknown, sigRaw: unknown): boolean {
  if (typeof expRaw !== "string" || typeof sigRaw !== "string") return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const expected = Buffer.from(sign(jobId, exp), "hex");
  const actual = Buffer.from(sigRaw, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
