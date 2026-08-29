import bcrypt from "bcryptjs";
import { driverAccounts } from "./mongo";

const BCRYPT_ROUNDS = 12;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sets (creates or overwrites) a driver's PWA login password. Called from the admin
 * dashboard's Add/Edit Driver flow (dashboard/server/routes/drivers.route.ts) -- ops
 * sets it directly, drivers don't self-serve. Overwriting is intentional: this is also
 * how a password reset works, no separate path needed.
 */
export async function setDriverPassword(email: string, plainPassword: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  const now = new Date();
  const col = await driverAccounts();

  await col.updateOne(
    { email: normalized },
    {
      $set: { passwordHash, active: true, updatedAt: now },
      // Invalidates every session token issued before this change -- a password reset
      // should always log the driver out of every device, not just new ones going forward.
      $inc: { tokenVersion: 1 },
      $setOnInsert: { email: normalized, createdAt: now, lastLoginAt: null }
    },
    { upsert: true }
  );
}

/** Deactivates a driver's PWA login without deleting the record, mirroring how the
 * Sheets Drivers row itself is soft-deactivated (Active column), never hard-deleted. */
export async function deactivateDriverAccount(email: string): Promise<void> {
  const col = await driverAccounts();
  await col.updateOne(
    { email: normalizeEmail(email) },
    { $set: { active: false, updatedAt: new Date() }, $inc: { tokenVersion: 1 } }
  );
}

export async function hasDriverAccount(email: string): Promise<boolean> {
  const col = await driverAccounts();
  const doc = await col.findOne({ email: normalizeEmail(email) }, { projection: { _id: 1 } });
  return doc !== null;
}
