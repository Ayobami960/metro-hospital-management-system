import type { UserRole } from "../db/schema/enums.js";
import { AppError } from "../lib/http.js";

/**
 * Single source of truth for "may this session reach a dashboard yet".
 *
 * Order of the remaining work:
 *   1. verify the email address,
 *   2. complete the mandatory profile,
 *   3. clear the optional authenticator factor (admins, legacy staff),
 *   4. clear the patient email sign-in code (returning patients).
 *
 * The Daily Room Access Code is deliberately absent: it is a pre-login staff
 * authorization and never gates a signed-in session.
 */
export type AuthNextStep =
  | "EMAIL_VERIFICATION"
  | "ONBOARDING"
  | "TOTP"
  | "PATIENT_OTP"
  | "READY";

export interface ProgressUser {
  id: string;
  role: UserRole;
  emailVerified: boolean;
  onboardingCompletedAt: Date | null;
  twoFactorEnabled: boolean;
}

export interface ProgressSession {
  mfaVerifiedAt: Date | null;
  mfaMethod: string | null;
}

export interface AuthProgress {
  emailVerificationRequired: boolean;
  emailVerified: boolean;
  onboardingRequired: boolean;
  onboardingCompleted: boolean;
  totpRequired: boolean;
  totpVerified: boolean;
  patientOtpRequired: boolean;
  patientOtpVerified: boolean;
  nextStep: AuthNextStep;
}

export const REQUIRED_REASON: Record<Exclude<AuthNextStep, "READY">, string> = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION_REQUIRED",
  ONBOARDING: "ONBOARDING_REQUIRED",
  TOTP: "TOTP_REQUIRED",
  PATIENT_OTP: "PATIENT_OTP_REQUIRED",
};

const hasTotpProof = (session: ProgressSession): boolean =>
  Boolean(session.mfaVerifiedAt) &&
  (session.mfaMethod === "TOTP" || session.mfaMethod === "RECOVERY");

const hasPatientOtpProof = (session: ProgressSession): boolean =>
  Boolean(session.mfaVerifiedAt) &&
  (session.mfaMethod === "PATIENT_OTP" || session.mfaMethod === "EMAIL_VERIFICATION");

export const evaluateProgress = async (
  user: ProgressUser,
  session: ProgressSession,
): Promise<AuthProgress> => {
  const emailVerified = user.emailVerified;
  const onboardingCompleted = Boolean(user.onboardingCompletedAt);
  const totpRequired = user.twoFactorEnabled;
  const totpVerified = totpRequired ? hasTotpProof(session) : true;
  const patientOtpRequired = user.role === "PATIENT" && !hasPatientOtpProof(session);
  const patientOtpVerified = !patientOtpRequired;

  let nextStep: AuthNextStep = "READY";
  if (!emailVerified) nextStep = "EMAIL_VERIFICATION";
  else if (!onboardingCompleted) nextStep = "ONBOARDING";
  else if (!totpVerified) nextStep = "TOTP";
  else if (patientOtpRequired) nextStep = "PATIENT_OTP";

  return {
    emailVerificationRequired: !emailVerified,
    emailVerified,
    onboardingRequired: !onboardingCompleted,
    onboardingCompleted,
    totpRequired,
    totpVerified,
    patientOtpRequired,
    patientOtpVerified,
    nextStep,
  };
};

const MESSAGE: Record<Exclude<AuthNextStep, "READY">, string> = {
  EMAIL_VERIFICATION: "Verify your email address to continue.",
  ONBOARDING: "Complete your profile to open your dashboard.",
  TOTP: "Two-factor authentication is required to continue.",
  PATIENT_OTP: "Enter the sign-in code emailed to you to continue.",
};

/** Throws a 403 carrying a stable machine-readable reason for the client. */
export const enforceProgress = (progress: AuthProgress): void => {
  if (progress.nextStep === "READY") return;
  throw new AppError("FORBIDDEN", MESSAGE[progress.nextStep], {
    reason: REQUIRED_REASON[progress.nextStep],
    nextStep: progress.nextStep,
  });
};
