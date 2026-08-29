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

export async function driverAccounts(): Promise<Collection<DriverAccountDoc>> {
  const client = await getClient();
  const db: Db = client.db(env.mongoDbName);
  return db.collection<DriverAccountDoc>("driver_accounts");
}
