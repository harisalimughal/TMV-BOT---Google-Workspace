import {
  activityCollection, evidenceCollection, exceptionsCollection, jobsCollection, scenarioSubmissionsCollection,
  ActivityDoc, EvidenceDoc, ExceptionDoc, JobDoc, ScenarioSubmissionDoc
} from "../../../src/db/mongo";
import { log } from "../../../src/utils/logger";

export interface MongoDataset {
  jobs: JobDoc[];
  evidence: EvidenceDoc[];
  activity: ActivityDoc[];
  scenarioSubmissions: ScenarioSubmissionDoc[];
  exceptions: ExceptionDoc[];
  fetchedAt: string;
  durationMs: number;
}

const LATENCY_BUDGET_MS = 1000;

/**
 * Replaces read/sheet-reader.ts's readDataset() as this dashboard's job/evidence data
 * source -- see normalize/normalize-mongo.ts for the NormalizedJob[] this feeds into,
 * and src/db/mongo.ts for why these are standalone copies of tmv-pwa's document
 * shapes rather than a shared import. No cache here (unlike sheetCache) -- Mongo reads
 * are already fast, the caching existed specifically to absorb Sheets' API cost/
 * latency, which doesn't apply.
 */
export async function readMongoDataset(): Promise<MongoDataset> {
  const started = Date.now();

  const [jobs, evidence, activity, scenarioSubmissions, exceptions] = await Promise.all([
    jobsCollection().then(c => c.find({}).toArray()),
    evidenceCollection().then(c => c.find({}).toArray()),
    activityCollection().then(c => c.find({}).toArray()),
    scenarioSubmissionsCollection().then(c => c.find({}).toArray()),
    exceptionsCollection().then(c => c.find({}).toArray())
  ]);

  const durationMs = Date.now() - started;
  if (durationMs > LATENCY_BUDGET_MS) {
    log.warn("dashboard mongo read exceeded latency budget", { duration_ms: durationMs, budget_ms: LATENCY_BUDGET_MS });
  }

  return {
    jobs, evidence, activity, scenarioSubmissions, exceptions,
    fetchedAt: new Date().toISOString(),
    durationMs
  };
}
