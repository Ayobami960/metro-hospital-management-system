import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { authenticate, currentActor, currentSessionId } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { parseMultipart } from "../middleware/upload.js";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema/identity.js";
import type { OtpPurpose } from "../db/schema/enums.js";
import { env } from "../config/env.js";
import { AppError, forbidden, handle, notFound, ok } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { isAdminRole } from "../lib/roles.js";
import { enforceProgress, evaluateProgress } from "../services/auth-progress.service.js";
import { issueOtp, maskEmail, verifyOtp } from "../services/otp.service.js";
import { getOnboarding, completeOnboarding } from "../services/onboarding.service.js";
import {
  confirmEnrollment,
  disableTotp,
  markSessionVerified,
  regenerateRecoveryCodes,
  startEnrollment,
  verifySecondFactor,
} from "../services/two-factor.service.js";
import { uploadAvatar } from "../services/files.service.js";

/**
 * Account endpoints reachable while a session is still mid-challenge. They are
 * the only door out of the challenge: nothing here returns PHI, and every state
 * change is audited.
 */
export const accountRouter = Router();

const verificationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: (req) => req.actor?.id ?? ipKeyGenerator(req.ip ?? "0.0.0.0"),
});

const loadUser = async (id: string) => {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) throw new AppError("UNAUTHENTICATED", "This account no longer exists");
  return row;
};

const loadSession = async (id: string | undefined) => {
  if (!id) return null;
  const [row] = await db
    .select({ mfaVerifiedAt: sessions.mfaVerifiedAt, mfaMethod: sessions.mfaMethod })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return row ?? null;
};

const currentProgress = async (userId: string, sessionId: string | undefined) => {
  const user = await loadUser(userId);
  const session = await loadSession(sessionId);
  const progress = await evaluateProgress(user, {
    mfaVerifiedAt: session?.mfaVerifiedAt ?? null,
    mfaMethod: session?.mfaMethod ?? null,
  });
  return { user, session, progress };
};

const issueIfAllowed = async (
  user: { id: string; name: string; email: string },
  purpose: OtpPurpose,
): Promise<void> => {
  try {
    await issueOtp(user, purpose);
  } catch {
    // Cooldown, hourly limit, or a delivery hiccup. The page offers an explicit
    // resend so the user can retry; the account state is still returned.
  }
};

accountRouter.get(
  "/account/status",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    const { user, progress } = await currentProgress(actor.id, currentSessionId(req));

    if (progress.nextStep === "EMAIL_VERIFICATION") {
      await issueIfAllowed(user, "EMAIL_VERIFICATION");
    } else if (progress.nextStep === "PATIENT_OTP") {
      await issueIfAllowed(user, "PATIENT_LOGIN");
    }

    const otpStage =
      progress.nextStep === "EMAIL_VERIFICATION" || progress.nextStep === "PATIENT_OTP";

    ok(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        emailVerified: user.emailVerified,
      },
      twoFactorEnabled: user.twoFactorEnabled,
      onboardingRequired: progress.onboardingRequired,
      onboardingCompleted: progress.onboardingCompleted,
      verificationSentTo: otpStage ? maskEmail(user.email) : null,
      progress,
      nextStep: progress.nextStep,
    });
  }),
);

/* Email verification (account registration and staff invitation activation). */

accountRouter.post(
  "/account/verification/email",
  authenticate,
  verificationLimiter,
  validate({ body: z.object({ code: z.string().trim().min(4).max(12) }) }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    const sessionId = currentSessionId(req);
    const { user } = await currentProgress(actor.id, sessionId);
    if (user.emailVerified) {
      ok(res, { verified: true, alreadyVerified: true });
      return;
    }

    await verifyOtp(user.id, "EMAIL_VERIFICATION", (req.body as { code: string }).code);
    const now = new Date();
    await db
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: now, updatedAt: now })
      .where(eq(users.id, user.id));

    // The email code proves possession of the registered address during this
    // first sign-in, so a newly verified patient is not asked for a second
    // patient-login code in the same session. Returning logins still are.
    if (user.role === "PATIENT" && sessionId) {
      await markSessionVerified(sessionId, "EMAIL_VERIFICATION");
    }

    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.email.verified",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "SUCCESS",
      ip: req.ip,
    });

    const after = await currentProgress(user.id, sessionId);
    ok(res, { verified: true, progress: after.progress, nextStep: after.progress.nextStep });
  }),
);

accountRouter.post(
  "/account/verification/email/resend",
  authenticate,
  verificationLimiter,
  handle(async (req, res) => {
    const actor = currentActor(req);
    const { user } = await currentProgress(actor.id, currentSessionId(req));
    if (user.emailVerified) throw new AppError("CONFLICT", "Your email is already verified.");

    const result = await issueOtp(user, "EMAIL_VERIFICATION", { force: true });
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.email.verification_resent",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "INFO",
      detail: { delivered: result.delivered },
      ip: req.ip,
    });
    ok(res, { delivered: result.delivered, sentTo: result.sentTo });
  }),
);

/* Patient login code. Patients never use the Room Access code. */

accountRouter.post(
  "/account/verification/patient-otp",
  authenticate,
  verificationLimiter,
  validate({ body: z.object({ code: z.string().trim().min(4).max(12) }) }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    const sessionId = currentSessionId(req);
    if (!sessionId) throw new AppError("UNAUTHENTICATED", "Session not found");
    const { user, progress } = await currentProgress(actor.id, sessionId);

    if (user.role !== "PATIENT") {
      throw forbidden("Only patient accounts use a patient sign-in code.");
    }
    if (progress.nextStep !== "PATIENT_OTP") {
      throw new AppError("FORBIDDEN", "A patient sign-in code is not required at this stage.", {
        reason: "PATIENT_OTP_NOT_REQUIRED",
      });
    }

    await verifyOtp(user.id, "PATIENT_LOGIN", (req.body as { code: string }).code);
    await markSessionVerified(sessionId, "PATIENT_OTP");
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.patient_otp.verified",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "SUCCESS",
      ip: req.ip,
    });

    const after = await currentProgress(user.id, sessionId);
    ok(res, { verified: true, progress: after.progress, nextStep: after.progress.nextStep });
  }),
);

accountRouter.post(
  "/account/verification/patient-otp/resend",
  authenticate,
  verificationLimiter,
  handle(async (req, res) => {
    const actor = currentActor(req);
    const { user, progress } = await currentProgress(actor.id, currentSessionId(req));
    if (user.role !== "PATIENT" || progress.nextStep !== "PATIENT_OTP") {
      throw forbidden("A patient sign-in code is not required at this stage.");
    }

    const result = await issueOtp(user, "PATIENT_LOGIN", { force: true });
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.patient_otp.resent",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "INFO",
      detail: { delivered: result.delivered },
      ip: req.ip,
    });
    ok(res, { delivered: result.delivered, sentTo: result.sentTo });
  }),
);

/* Optional admin authenticator second factor. */

accountRouter.post(
  "/account/verification/totp",
  authenticate,
  verificationLimiter,
  validate({ body: z.object({ code: z.string().trim().min(6).max(10) }) }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    const sessionId = currentSessionId(req);
    if (!sessionId) throw new AppError("UNAUTHENTICATED", "Session not found");
    const user = await loadUser(actor.id);

    const result = await verifySecondFactor({
      userId: actor.id,
      email: user.email,
      sessionId,
      token: (req.body as { code: string }).code,
      kind: "TOTP",
    });
    await writeAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "auth.totp.verified",
      module: "identity",
      entityType: "user",
      entityId: actor.id,
      level: "SUCCESS",
      detail: { method: result.method },
      ip: req.ip,
    });

    const after = await currentProgress(user.id, sessionId);
    ok(res, { method: result.method, progress: after.progress, nextStep: after.progress.nextStep });
  }),
);

accountRouter.post(
  "/account/verification/recovery-code",
  authenticate,
  verificationLimiter,
  validate({ body: z.object({ code: z.string().trim().min(8).max(32) }) }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    const sessionId = currentSessionId(req);
    if (!sessionId) throw new AppError("UNAUTHENTICATED", "Session not found");
    const user = await loadUser(actor.id);

    const result = await verifySecondFactor({
      userId: actor.id,
      email: user.email,
      sessionId,
      token: (req.body as { code: string }).code,
      kind: "RECOVERY",
    });
    await writeAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "auth.recovery_code.used",
      module: "identity",
      entityType: "user",
      entityId: actor.id,
      level: "WARNING",
      ip: req.ip,
    });

    const after = await currentProgress(user.id, sessionId);
    ok(res, { method: result.method, progress: after.progress, nextStep: after.progress.nextStep });
  }),
);

/* Enrollment and management — only from a fully verified session. */

const requireReady = async (req: Parameters<typeof currentActor>[0]) => {
  const actor = currentActor(req);
  const user = await loadUser(actor.id);
  const session = await loadSession(currentSessionId(req));
  const progress = await evaluateProgress(user, {
    mfaVerifiedAt: session?.mfaVerifiedAt ?? null,
    mfaMethod: session?.mfaMethod ?? null,
  });
  enforceProgress(progress);
  return { actor, user, sessionId: currentSessionId(req) };
};

accountRouter.post(
  "/account/totp/enroll",
  authenticate,
  verificationLimiter,
  handle(async (req, res) => {
    const { user } = await requireReady(req);
    if (!isAdminRole(user.role)) {
      throw forbidden("Two-factor authentication is only available for administrators.");
    }
    const enrollment = await startEnrollment({ id: user.id, email: user.email });
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.totp.enrollment_started",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "INFO",
      ip: req.ip,
    });
    ok(res, enrollment);
  }),
);

accountRouter.post(
  "/account/totp/enroll/confirm",
  authenticate,
  verificationLimiter,
  validate({ body: z.object({ code: z.string().trim().min(6).max(10) }) }),
  handle(async (req, res) => {
    const { user } = await requireReady(req);
    if (!isAdminRole(user.role)) {
      throw forbidden("Two-factor authentication is only available for administrators.");
    }
    const { recoveryCodes } = await confirmEnrollment(
      { id: user.id, email: user.email },
      (req.body as { code: string }).code,
    );
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.totp.enabled",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "SUCCESS",
      ip: req.ip,
    });
    ok(res, { enabled: true, recoveryCodes });
  }),
);

accountRouter.post(
  "/account/totp/disable",
  authenticate,
  verificationLimiter,
  validate({ body: z.object({ password: z.string().min(1).max(256) }) }),
  handle(async (req, res) => {
    const { user, sessionId } = await requireReady(req);
    if (!sessionId) throw new AppError("UNAUTHENTICATED", "Session not found");
    await disableTotp(user.id, (req.body as { password: string }).password, sessionId);
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.totp.disabled",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "WARNING",
      ip: req.ip,
    });
    ok(res, { enabled: false });
  }),
);

accountRouter.post(
  "/account/totp/recovery-codes",
  authenticate,
  verificationLimiter,
  validate({ body: z.object({ password: z.string().min(1).max(256) }) }),
  handle(async (req, res) => {
    const { user } = await requireReady(req);
    const { recoveryCodes } = await regenerateRecoveryCodes(
      user.id,
      (req.body as { password: string }).password,
    );
    await writeAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "auth.totp.recovery_codes_regenerated",
      module: "identity",
      entityType: "user",
      entityId: user.id,
      level: "WARNING",
      ip: req.ip,
    });
    ok(res, { recoveryCodes });
  }),
);

/* Mandatory first-login profile completion. */

accountRouter.get(
  "/account/onboarding",
  authenticate,
  handle(async (req, res) => {
    ok(res, await getOnboarding(currentActor(req).id));
  }),
);

const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  image: z.string().max(2048).nullable().optional(),
  patient: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      middleName: z.string().trim().max(80).nullable().optional(),
      dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sexAtBirth: z.enum(["MALE", "FEMALE", "INTERSEX", "UNKNOWN"]),
      bloodType: z
        .enum([
          "A_POS",
          "A_NEG",
          "B_POS",
          "B_NEG",
          "AB_POS",
          "AB_NEG",
          "O_POS",
          "O_NEG",
          "UNKNOWN",
        ])
        .optional(),
      addressLine1: z.string().trim().min(3).max(200),
      addressLine2: z.string().trim().max(200).nullable().optional(),
      city: z.string().trim().min(1).max(80),
      state: z.string().trim().min(1).max(80),
      postalCode: z.string().trim().min(3).max(16),
    })
    .optional(),
  staff: z
    .object({
      title: z.string().trim().min(2).max(120),
      licenseNumber: z.string().trim().max(80).nullable().optional(),
      employeeId: z.string().trim().max(40).nullable().optional(),
      ward: z.string().trim().max(80).nullable().optional(),
      departmentId: z.string().uuid().nullable().optional(),
    })
    .optional(),
});

accountRouter.post(
  "/account/onboarding",
  authenticate,
  validate({ body: onboardingSchema }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    await completeOnboarding(actor.id, req.body as z.infer<typeof onboardingSchema>, req.ip);
    ok(res, await getOnboarding(actor.id));
  }),
);

accountRouter.post(
  "/account/onboarding/avatar",
  authenticate,
  parseMultipart,
  handle(async (req, res) => {
    const actor = currentActor(req);
    if (!req.file) throw notFound("No image was uploaded.");
    const result = await uploadAvatar(
      actor,
      req.file.buffer,
      req.file.originalname || "avatar",
      req.ip,
    );
    ok(res, { image: result.avatarUrl });
  }),
);
