import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { db } from "../db/client.js";
import { accounts, sessions, twoFactor, users } from "../db/schema/identity.js";
import { env } from "../config/env.js";
import { encryptField } from "../lib/crypto.js";
import { AppError, badRequest, conflict, forbidden } from "../lib/http.js";
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  normalizeSecretCode,
  parseRecoveryHashes,
  verifySecret,
} from "../lib/secrets.js";
import { createTotpSecret, totpEnrollmentUri, verifyTotpToken } from "../lib/totp.js";
import { logger } from "../lib/logger.js";

/**
 * Optional TOTP second factor.
 *
 * The secret is encrypted at rest (AES-256-GCM, FIELD_ENCRYPTION_KEY) and the
 * recovery codes are Argon2id digests. A challenge is bound to the better-auth
 * session row (`mfa_verified_at`), so a password-only session can never reach a
 * role dashboard. Failures are counted and lock the factor for a cool-down.
 */

export type ChallengeKind = "TOTP" | "RECOVERY";
export type SessionMfaMethod = ChallengeKind | "PATIENT_OTP" | "EMAIL_VERIFICATION";

const now = (): Date => new Date();

const lockRemainingSeconds = (lockedUntil: Date | null): number =>
  lockedUntil ? Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)) : 0;

export const getTotpRow = async (userId: string) => {
  const [row] = await db.select().from(twoFactor).where(eq(twoFactor.userId, userId)).limit(1);
  return row ?? null;
};

const assertNotLocked = (lockedUntil: Date | null): void => {
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    throw new AppError("RATE_LIMITED", "Too many incorrect codes. Try again later.", {
      retryAfterSeconds: lockRemainingSeconds(lockedUntil),
    });
  }
};

const recordFailure = async (row: { id: string; failedVerificationCount: number }): Promise<void> => {
  const count = row.failedVerificationCount + 1;
  const lockedUntil =
    count >= env.auth.totp.maxAttempts
      ? new Date(Date.now() + env.auth.totp.lockMinutes * 60_000)
      : null;
  await db
    .update(twoFactor)
    .set({
      failedVerificationCount: count,
      lockedUntil,
      updatedAt: now(),
    })
    .where(eq(twoFactor.id, row.id));
  if (lockedUntil) {
    logger.warn({ factorId: row.id }, "TOTP factor temporarily locked");
  }
};

const resetFailures = async (id: string): Promise<void> => {
  await db
    .update(twoFactor)
    .set({ failedVerificationCount: 0, lockedUntil: null, updatedAt: now() })
    .where(eq(twoFactor.id, id));
};

/** Marks the current session as having cleared its second factor. */
export const markSessionVerified = async (
  sessionId: string,
  method: SessionMfaMethod,
): Promise<void> => {
  await db
    .update(sessions)
    .set({ mfaVerifiedAt: now(), mfaMethod: method, updatedAt: now() })
    .where(eq(sessions.id, sessionId));
};

/**
 * Verifies the account password through better-auth's own hasher so the check
 * stays compatible with the credential provider.
 */
export const verifyAccountPassword = async (userId: string, password: string): Promise<boolean> => {
  const [account] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  if (!account?.password) return false;
  try {
    return await verifyPassword({ hash: account.password, password });
  } catch {
    return false;
  }
};

export const startEnrollment = async (user: {
  id: string;
  email: string;
}): Promise<{ secret: string; otpauthUri: string }> => {
  const existing = await getTotpRow(user.id);
  if (existing?.verified) {
    throw conflict("Two-factor authentication is already enabled for this account.");
  }
  if (existing) {
    await db.delete(twoFactor).where(eq(twoFactor.id, existing.id));
  }

  const secret = createTotpSecret();
  await db.insert(twoFactor).values({
    id: crypto.randomUUID(),
    userId: user.id,
    secret: encryptField(secret),
    backupCodes: "[]",
    verified: false,
  });

  // Shown once, for the authenticator app; never recoverable afterwards.
  return { secret, otpauthUri: totpEnrollmentUri(secret, user.email) };
};

export const confirmEnrollment = async (
  user: { id: string; email: string },
  token: string,
): Promise<{ recoveryCodes: string[] }> => {
  const row = await getTotpRow(user.id);
  if (!row || row.verified) throw badRequest("Start two-factor enrollment first.");
  assertNotLocked(row.lockedUntil);

  if (!verifyTotpToken(row.secret, user.email, token)) {
    await recordFailure(row);
    throw badRequest("That authenticator code is not valid.");
  }

  const recoveryCodes = generateRecoveryCodes(env.auth.totp.recoveryCodeCount);
  const hashes = await hashRecoveryCodes(recoveryCodes);
  await db
    .update(twoFactor)
    .set({
      backupCodes: JSON.stringify(hashes),
      verified: true,
      failedVerificationCount: 0,
      lockedUntil: null,
      updatedAt: now(),
    })
    .where(eq(twoFactor.id, row.id));
  await db
    .update(users)
    .set({ twoFactorEnabled: true, updatedAt: now() })
    .where(eq(users.id, user.id));

  return { recoveryCodes };
};

/** Clears the TOTP challenge for the current session. */
export const verifySecondFactor = async (input: {
  userId: string;
  email: string;
  sessionId: string;
  token: string;
  kind: ChallengeKind;
}): Promise<{ method: ChallengeKind }> => {
  const row = await getTotpRow(input.userId);
  if (!row?.verified) throw forbidden("Two-factor authentication is not enabled for this account.");
  assertNotLocked(row.lockedUntil);

  if (input.kind === "TOTP") {
    if (!verifyTotpToken(row.secret, input.email, input.token)) {
      await recordFailure(row);
      throw badRequest("That authenticator code is not valid.");
    }
    await resetFailures(row.id);
    await markSessionVerified(input.sessionId, "TOTP");
    return { method: "TOTP" };
  }

  const attempts = parseRecoveryHashes(row.backupCodes);
  const normalized = normalizeSecretCode(input.token);
  let matchedIndex = -1;
  for (let index = 0; index < attempts.length; index += 1) {
    const hash = attempts[index];
    if (!hash) continue;
    // Codes are high-entropy and hashed, so a linear scan is fine and leaks no
    // ordering information beyond which code was used.
    if (await verifySecret(hash, normalized)) {
      matchedIndex = index;
      break;
    }
  }
  if (matchedIndex === -1) {
    await recordFailure(row);
    throw badRequest("That recovery code is not valid.");
  }

  // Single use: the matched digest is removed atomically.
  const remaining = attempts.filter((_, index) => index !== matchedIndex);
  await db
    .update(twoFactor)
    .set({ backupCodes: JSON.stringify(remaining), updatedAt: now() })
    .where(eq(twoFactor.id, row.id));
  await resetFailures(row.id);
  await markSessionVerified(input.sessionId, "RECOVERY");
  return { method: "RECOVERY" };
};

export const disableTotp = async (
  userId: string,
  password: string,
  sessionId: string,
): Promise<void> => {
  if (!(await verifyAccountPassword(userId, password))) {
    throw badRequest("The password is not correct.");
  }
  await db.delete(twoFactor).where(eq(twoFactor.userId, userId));
  await db
    .update(users)
    .set({ twoFactorEnabled: false, updatedAt: now() })
    .where(eq(users.id, userId));
  // The current session already proved the password + factor; other sessions
  // stay untouched but every future sign-in no longer asks for TOTP.
  await db
    .update(sessions)
    .set({ mfaVerifiedAt: now(), mfaMethod: "TOTP", updatedAt: now() })
    .where(eq(sessions.id, sessionId));
};

export const regenerateRecoveryCodes = async (
  userId: string,
  password: string,
): Promise<{ recoveryCodes: string[] }> => {
  if (!(await verifyAccountPassword(userId, password))) {
    throw badRequest("The password is not correct.");
  }
  const row = await getTotpRow(userId);
  if (!row?.verified) throw badRequest("Enable two-factor authentication first.");

  const recoveryCodes = generateRecoveryCodes(env.auth.totp.recoveryCodeCount);
  const hashes = await hashRecoveryCodes(recoveryCodes);
  await db
    .update(twoFactor)
    .set({ backupCodes: JSON.stringify(hashes), updatedAt: now() })
    .where(eq(twoFactor.id, row.id));
  return { recoveryCodes };
};
