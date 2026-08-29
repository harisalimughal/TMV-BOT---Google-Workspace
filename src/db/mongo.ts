import { Collection, Db, MongoClient } from "mongodb";
import { env } from "../config/env";

/**
 * Same shape as tmv-pwa/backend/src/db/mongo.ts's DriverAccountDoc -- both projects
 * read/write the same driver_accounts collection (tmv-pwa verifies logins against it,
 * this app's admin dashboard is the only thing that ever writes to it). Kept as a
 * separate copy rather than a shared package since the two projects are independent
 * repos/deployments; if the shape ever needs to change, change it in both places.
 */
export interface DriverAccountDoc {
  email: string;
  passwordHash: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  tokenVersion: number;
}

/**
 * The rest of this file is read access to tmv-pwa's job/evidence/activity/scenario
 * data -- same shapes as tmv-pwa/backend/src/jobs/job.types.ts + db/mongo.ts +
 * db/scenario.repo.ts, copied rather than shared for the same reason as
 * DriverAccountDoc above. Deliberately NOT this project's own src/jobs/job.types.ts --
 * that type represents the old Sheets-shape Job/EvidenceRecord this live Chat bot
 * still uses; it diverged from tmv-pwa's Mongo shape when tmv-pwa moved off Sheets/
 * Drive onto Mongo/Cloudinary (signatureUrl instead of a Signatures-sheet row,
 * cloudinaryPublicId/cloudinaryUrl instead of driveFileId/driveUrl, no
 * attachmentReference). This dashboard is now the only place that reads this data for
 * admin purposes; tmv-pwa's own backend still owns writing jobs/evidence/activity/
 * scenario_submissions, except job.driverInitials reassignment (see
 * dashboard/server/routes/jobs.route.ts), which this app also writes directly, and
 * the `exceptions` collection, which this app never writes to -- see
 * tmv-pwa/backend/src/db/exceptions.repo.ts.
 */

export enum JobStatus {
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum EvidenceStatus {
  RECEIVED = "RECEIVED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

export type EvidenceType =
  | "Arrival" | "VanLoaded" | "EmptyVan" | "Organized"
  | "CheckIn" | "CheckOut" | "ParkingLiability" | "LiabilityReport";

export interface JobDoc {
  _id: string;
  jobId: string;
  calendarEventId: string;
  driverInitials: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickup: string;
  dropoff: string;
  crewSize: number;
  basePrice: number;
  paidOnline: boolean;
  bookedStart: string;
  bookedFinish: string;
  actualStart: string;
  actualFinish: string;
  bookedMinutes: number;
  actualMinutes: number;
  differenceMinutes: number;
  delayStatus: string;
  extraCharges: string[];
  overtimeMinutes: number;
  overtimeCharge: number;
  totalCharges: number;
  paymentMethod: string;
  paymentStatus: string;
  clientNamePostcode: string;
  clientConfirmedBy: string;
  signatureUrl: string;
  status: JobStatus;
  currentState: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceDoc {
  _id: string;
  evidenceId: string;
  jobId: string;
  driverEmail: string;
  evidenceType: EvidenceType;
  contentType: string;
  fileName: string;
  status: EvidenceStatus;
  receivedAt: string;
  processingStartedAt: string;
  processingCompletedAt: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  retryCount: number;
  lastError: string;
}

export interface ActivityDoc {
  jobId: string;
  driver: string;
  action: string;
  fromState?: string;
  toState?: string;
  detail?: string;
  timestamp: string;
}

export interface ScenarioSubmissionDoc {
  jobId: string;
  scenario: "checkin" | "checkout" | "parking" | "liability";
  driver: string;
  fields: Record<string, string>;
  photoUrls: string[];
  signatureUrl: string;
  submittedAt: string;
}

export interface ExceptionDoc {
  jobId: string;
  type: string;
  detail: string;
  timestamp: string;
}

let clientPromise: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not configured -- driver PWA passwords can't be set until it is.");
  }
  if (!clientPromise) {
    const client = new MongoClient(env.mongoUri);
    clientPromise = client.connect().catch(error => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

async function db(): Promise<Db> {
  const client = await getClient();
  return client.db(env.mongoDbName);
}

export async function driverAccounts(): Promise<Collection<DriverAccountDoc>> {
  return (await db()).collection<DriverAccountDoc>("driver_accounts");
}

export async function jobsCollection(): Promise<Collection<JobDoc>> {
  return (await db()).collection<JobDoc>("jobs");
}

export async function evidenceCollection(): Promise<Collection<EvidenceDoc>> {
  return (await db()).collection<EvidenceDoc>("evidence");
}

export async function activityCollection(): Promise<Collection<ActivityDoc>> {
  return (await db()).collection<ActivityDoc>("activity");
}

export async function scenarioSubmissionsCollection(): Promise<Collection<ScenarioSubmissionDoc>> {
  return (await db()).collection<ScenarioSubmissionDoc>("scenario_submissions");
}

export async function exceptionsCollection(): Promise<Collection<ExceptionDoc>> {
  return (await db()).collection<ExceptionDoc>("exceptions");
}
