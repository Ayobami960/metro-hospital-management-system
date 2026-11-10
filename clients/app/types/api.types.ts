/**
 * Shared HTTP contracts.
 *
 * Every backend response uses the envelope `{ data, meta }`; list endpoints put
 * pagination into `meta` (see `server/src/lib/http.ts`). Errors use
 * `{ error: { code, message, details } }`.
 */

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: PageMeta | null;
}

export interface Paginated<T> {
  rows: T[];
  meta: PageMeta;
}

/** Query parameters understood by every list endpoint. */
export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export type Id = string;

/** Operator roles returned by `GET /me`. */
export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "PATIENT"
  | "RECEPTION"
  | "PHARMACY"
  | "LABORATORY"
  | "BILLING";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarInitials: string;
  subtitle: string;
  nav: string[];
  permissions: string[];
  patientId: string | null;
  doctorId: string | null;
}

export type QueryValue = string | number | boolean | null | undefined;

/**
 * Post-password account progress. Room Access is not part of this list: it is
 * verified before the staff login form and never gates a signed-in session.
 */
export type AuthNextStep =
  | "EMAIL_VERIFICATION"
  | "ONBOARDING"
  | "TOTP"
  | "PATIENT_OTP"
  | "READY";

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

export interface AccountStatus {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    image: string | null;
    emailVerified: boolean;
  };
  twoFactorEnabled: boolean;
  onboardingRequired: boolean;
  onboardingCompleted: boolean;
  verificationSentTo: string | null;
  progress: AuthProgress;
  nextStep: AuthNextStep;
}

export interface AuthChallengeResult {
  method: string;
  progress: AuthProgress;
  nextStep: AuthNextStep;
}

export interface OtpVerificationResult {
  verified: boolean;
  alreadyVerified?: boolean;
  progress: AuthProgress;
  nextStep: AuthNextStep;
}

export interface OtpResendResult {
  delivered: boolean;
  sentTo: string;
}

/* Daily Room Access — hospital staff only, before their normal password login. */

export type RoomAccessRole =
  | "DOCTOR"
  | "NURSE"
  | "RECEPTION"
  | "PHARMACY"
  | "LABORATORY"
  | "BILLING";

export interface RoomAccessRequestResult {
  requested: true;
  message: string;
}

export interface RoomAccessVerifyResult {
  verified: true;
  role: RoomAccessRole;
  portalLabel: string;
  loginPath: string;
  expiresAt: string;
}

export interface RoomAccessSession {
  active: boolean;
  role?: RoomAccessRole;
  portalLabel?: string;
  loginPath?: string;
  expiresAt?: string;
}

/* Mandatory first-login profile completion. */

export interface OnboardingStatus {
  completed: boolean;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  patient: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    dateOfBirth: string;
    sexAtBirth: string;
    bloodType: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    mrn: string;
  } | null;
  staff: {
    title: string | null;
    licenseNumber: string | null;
    employeeId: string | null;
    ward: string | null;
    departmentId: string | null;
  } | null;
  required: {
    patient: boolean;
    staff: boolean;
    license: boolean;
  };
}

export interface OnboardingInput {
  name: string;
  phone: string;
  image?: string | null;
  patient?: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    dateOfBirth: string;
    sexAtBirth: "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN";
    bloodType?: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  staff?: {
    title: string;
    licenseNumber?: string | null;
    employeeId?: string | null;
    ward?: string | null;
    departmentId?: string | null;
  };
}

export interface TotpEnrollment {
  secret: string;
  otpauthUri: string;
}

export interface RecoveryCodesResult {
  recoveryCodes: string[];
}

export interface InvitationPreview {
  email: string;
  name: string;
  role: Role;
  expiresAt: string;
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  phone: string | null;
  hospitalId: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface StaffInvitation {
  id: string;
  email: string;
  name: string;
  role: Role;
  hospitalId: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface StaffDirectoryParams extends ListParams {
  role?: string;
  status?: string;
}

export interface InviteStaffInput {
  name: string;
  email: string;
  role: Role;
  hospitalId: string;
  phone?: string;
  departmentId?: string;
  employeeId?: string;
}
