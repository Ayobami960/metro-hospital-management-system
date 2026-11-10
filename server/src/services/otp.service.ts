import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { otpCodes } from "../db/schema/security.js";
import type { OtpPurpose } from "../db/schema/enums.js";
import { env } from "../config/env.js";
import { AppError, conflict } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import {
  generateNumericCode,
  hashSecret,
  normalizeSecretCode,
  verifySecret,
} from "../lib/secrets.js";
import { sendEmail, type MailPurpose } from "./email.service.js";

/**
 * Purpose-scoped one-time codes.
 *
 * Every OTP is generated with the CSPRNG, stored only as an Argon2id digest,
 * bound to one account and one purpose, expiring, attempt-limited and single
 * use. A code issued for one purpose is never accepted by another workflow.
 */

export interface OtpRecipient {
  id: string;
  name: string;
  email: string;
}

interface PurposePolicy {
  length: number;
  ttlMinutes: number;
  maxAttempts: number;
  maxPerHour: number;
  emailPurpose: MailPurpose;
  subject: (hospital: string) => string;
  intro: (hospital: string) => string;
}

const POLICY: Record<OtpPurpose, PurposePolicy> = {
  EMAIL_VERIFICATION: {
    length: 6,
    ttlMinutes: env.auth.otp.emailVerificationTtlMinutes,
    maxAttempts: env.auth.otp.maxAttempts,
    maxPerHour: 8,
    emailPurpose: "EMAIL_VERIFICATION",
    subject: (hospital) => `${hospital} email verification code`,
    intro: (hospital) =>
      `Use this one-time code to verify the email address on your ${hospital} account.`,
  },
  DAILY_ROOM_ACCESS: {
    length: 8,
    ttlMinutes: env.auth.otp.ttlMinutes,
    maxAttempts: env.auth.otp.maxAttempts,
    maxPerHour: 10,
    emailPurpose: "DAILY_CODE",
    subject: (hospital) => `${hospital} daily room access code`,
    intro: (hospital) =>
      `Use this one-time code to unlock your ${hospital} room access sign-in for today.`,
  },
  PATIENT_LOGIN: {
    length: 6,
    ttlMinutes: env.auth.otp.patientLoginTtlMinutes,
    maxAttempts: env.auth.otp.maxAttempts,
    maxPerHour: 8,
    emailPurpose: "PATIENT_LOGIN",
    subject: (hospital) => `${hospital} patient sign-in code`,
    intro: (hospital) => `Use this one-time code to finish signing in to your ${hospital} patient portal.`,
  },
  ADMIN_2FA: {
    length: 6,
    ttlMinutes: env.auth.otp.patientLoginTtlMinutes,
    maxAttempts: env.auth.otp.maxAttempts,
    maxPerHour: 8,
    emailPurpose: "ADMIN_2FA",
    subject: (hospital) => `${hospital} administrator verification code`,
    intro: (hospital) => `Use this one-time code to finish administrator sign-in at ${hospital}.`,
  },
};

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your registered email";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
};

const otpEmail = (
  recipient: OtpRecipient,
  purpose: OtpPurpose,
  code: string,
  expiresAt: Date,
): { text: string; html: string } => {
  const policy = POLICY[purpose];
  const expiry = new Intl.DateTimeFormat("en-GB", {
    timeZone: env.clinicTimezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt);

  const text = [
    `Hello ${recipient.name},`,
    "",
    policy.intro(env.hospitalName),
    "",
    `    ${code}`,
    "",
    `It expires ${expiry} (${env.clinicTimezone}) and can be used once.`,
    "If you did not request this code, do not share it with anyone and contact the hospital IT desk.",
    "",
    env.hospitalName,
  ].join("\n");

  return {
    text,
    html: [
      `<p>Hello ${recipient.name},</p>`,
      `<p>${policy.intro(env.hospitalName)}</p>`,
      `<p style="font-size:24px;letter-spacing:4px;font-weight:700">${code}</p>`,
      `<p>It expires ${expiry} (${env.clinicTimezone}) and can be used once.</p>`,
      `<p>If you did not request this code, do not share it with anyone and contact the hospital IT desk.</p>`,
    ].join(""),
  };
};

export interface IssueOtpOptions {
  /** Replace an existing unconsumed code and send a new one. */
  force?: boolean;
}

export interface IssuedOtp {
  delivered: boolean;
  sentTo: string;
  expiresAt: Date;
  reused: boolean;
  retryAfterSeconds: number;
}

/**
 * Issues a new code, or returns the current one when it is still active.
 *
 * Callers that must not disclose account existence should ignore throws and
 * always return the same public response.
 */
export const issueOtp = async (
  recipient: OtpRecipient,
  purpose: OtpPurpose,
  options: IssueOtpOptions = {},
): Promise<IssuedOtp> => {
  const policy = POLICY[purpose];
  const now = new Date();

  const [latest] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.userId, recipient.id),
        eq(otpCodes.purpose, purpose),
        isNull(otpCodes.consumedAt),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (latest && latest.expiresAt.getTime() > now.getTime() && !options.force) {
    return {
      delivered: latest.deliveryStatus === "SENT",
      sentTo: maskEmail(recipient.email),
      expiresAt: latest.expiresAt,
      reused: true,
      retryAfterSeconds: 0,
    };
  }

  if (latest) {
    const elapsedMs = now.getTime() - latest.createdAt.getTime();
    const cooldownMs = env.auth.otp.resendCooldownSeconds * 1_000;
    const deliveryFailed = latest.deliveryStatus === "FAILED" && !latest.sentAt;
    if (options.force && elapsedMs < cooldownMs && !deliveryFailed) {
      throw new AppError("RATE_LIMITED", "Please wait before requesting another code.", {
        retryAfterSeconds: Math.ceil((cooldownMs - elapsedMs) / 1_000),
      });
    }
  }

  const [hourly] = await db
    .select({ value: count() })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.userId, recipient.id),
        eq(otpCodes.purpose, purpose),
        gt(otpCodes.createdAt, new Date(now.getTime() - 60 * 60_000)),
      ),
    );
  if (Number(hourly?.value ?? 0) >= policy.maxPerHour) {
    throw new AppError("RATE_LIMITED", "Too many code requests. Try again later.");
  }

  // Only the newest code for this account and purpose stays valid.
  await db
    .update(otpCodes)
    .set({ consumedAt: now, updatedAt: now })
    .where(
      and(eq(otpCodes.userId, recipient.id), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)),
    );

  const code = generateNumericCode(policy.length);
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(now.getTime() + policy.ttlMinutes * 60_000);

  const [row] = await db
    .insert(otpCodes)
    .values({
      userId: recipient.id,
      purpose,
      codeHash,
      expiresAt,
      maxAttempts: policy.maxAttempts,
      deliveryAttempts: 1,
    })
    .returning({ id: otpCodes.id });
  if (!row) throw new AppError("INTERNAL_ERROR", "Could not issue a verification code.");

  const body = otpEmail(recipient, purpose, code, expiresAt);
  const delivered = await sendEmail({
    to: recipient.email,
    subject: policy.subject(env.hospitalName),
    text: body.text,
    html: body.html,
    purpose: policy.emailPurpose,
  });

  await db
    .update(otpCodes)
    .set({
      deliveryStatus: delivered ? "SENT" : "FAILED",
      sentAt: delivered ? new Date() : null,
      lastDeliveryError: delivered ? null : "provider rejected the message",
      updatedAt: new Date(),
    })
    .where(eq(otpCodes.id, row.id));

  if (!delivered) logger.warn({ userId: recipient.id, purpose }, "verification code delivery failed");

  return {
    delivered,
    sentTo: maskEmail(recipient.email),
    expiresAt,
    reused: false,
    retryAfterSeconds: env.auth.otp.resendCooldownSeconds,
  };
};

const invalidCode = (): AppError =>
  new AppError("VALIDATION_ERROR", "That verification code is not valid or has expired.", {
    reason: "INVALID_OTP",
  });

/**
 * Verifies and consumes the newest code for this account and purpose.
 *
 * The attempt counter is written before the digest is checked, and consumption
 * is a conditional update, so parallel requests cannot reuse a code.
 */
export const verifyOtp = async (
  userId: string,
  purpose: OtpPurpose,
  rawCode: string,
): Promise<void> => {
  const code = normalizeSecretCode(rawCode);
  if (code.length < 4) throw invalidCode();

  const now = new Date();
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.userId, userId),
        eq(otpCodes.purpose, purpose),
        isNull(otpCodes.consumedAt),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) throw invalidCode();
  if (row.expiresAt.getTime() <= now.getTime()) {
    throw new AppError("PRECONDITION_FAILED", "That verification code has expired. Request a new one.", {
      reason: "EXPIRED_OTP",
    });
  }
  if (row.attempts >= row.maxAttempts) {
    throw new AppError("RATE_LIMITED", "Too many incorrect attempts. Request a new code.", {
      reason: "OTP_ATTEMPTS_EXCEEDED",
    });
  }

  await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1`, lastAttemptAt: now })
    .where(eq(otpCodes.id, row.id));

  if (!(await verifySecret(row.codeHash, code))) {
    throw new AppError("VALIDATION_ERROR", "That verification code is not correct.", {
      reason: "INVALID_OTP",
      attemptsRemaining: Math.max(0, row.maxAttempts - (row.attempts + 1)),
    });
  }

  const [consumed] = await db
    .update(otpCodes)
    .set({ consumedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id });

  if (!consumed) throw conflict("That verification code has already been used.");
};

export const otpPolicy = (purpose: OtpPurpose): PurposePolicy => POLICY[purpose];
