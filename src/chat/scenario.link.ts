import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import { ScenarioKey } from "./scenario.spec";

/** How long a scenario-form link stays valid after a card renders it. 30 minutes was
 *  too tight for real field conditions (a driver dealing with an actual parking/
 *  liability incident can easily be delayed past that) -- 6 hours comfortably covers
 *  a full shift while still eventually expiring. The link is scoped to one specific
 *  job+scenario and HMAC-signed, so a longer window isn't a meaningful new exposure;
 *  it only changes how long a leaked/screenshotted link would stay usable. */
export const SCENARIO_LINK_TTL_MS = 6 * 60 * 60 * 1000;

function sign(scenario: ScenarioKey, jobId: string, exp: number): string {
  return createHmac("sha256", env.signatureLinkSecret).update(`${scenario}.${jobId}.${exp}`).digest("hex");
}

/** Builds the public, time-limited URL a menu button's "OPEN <FORM>" button opens. */
export function scenarioLinkFor(scenario: ScenarioKey, jobId: string): string {
  const exp = Date.now() + SCENARIO_LINK_TTL_MS;
  return `${env.workerBaseUrl}/forms/${scenario}/${encodeURIComponent(jobId)}?exp=${exp}&sig=${sign(scenario, jobId, exp)}`;
}

/** Verifies the exp/sig query params a GET or POST to /forms/:scenario/:jobId carries. */
export function verifyScenarioLink(scenario: ScenarioKey, jobId: string, expRaw: unknown, sigRaw: unknown): boolean {
  if (typeof expRaw !== "string" || typeof sigRaw !== "string") return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const expected = Buffer.from(sign(scenario, jobId, exp), "hex");
  const actual = Buffer.from(sigRaw, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
