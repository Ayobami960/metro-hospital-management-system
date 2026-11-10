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

export interface PatientDocument {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
}

export interface PatientInsuranceInput {
  providerName: string;
  planName?: string | null;
  policyNumber: string;
  memberId?: string | null;
  groupNumber?: string | null;
}

export interface PatientConsentsInput {
  terms: boolean;
  privacy: boolean;
  hipaa: boolean;
}

export type PatientGender = "MALE" | "FEMALE" | "NON_BINARY" | "PREFER_NOT_TO_SAY";

export interface PatientProfileInput {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth: string;
  gender: PatientGender;
  bloodType?: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  emergencyContact?: {
    name: string;
    relationship: "SPOUSE" | "PARENT" | "CHILD" | "SIBLING" | "GUARDIAN" | "OTHER";
    phone: string;
  };
  allergies?: string[];
  conditions?: string[];
  insurance?: PatientInsuranceInput;
  consents: PatientConsentsInput;
}

/** In-progress wizard data saved on the account (cross-device resume). */
export interface PatientDraft {
  step?: number;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: PatientGender;
  bloodType?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContact?: {
    name?: string;
    relationship?: "SPOUSE" | "PARENT" | "CHILD" | "SIBLING" | "GUARDIAN" | "OTHER";
    phone?: string;
  };
  allergies?: string[];
  conditions?: string[];
  insurance?: {
    providerName?: string;
    planName?: string;
    policyNumber?: string;
    memberId?: string;
    groupNumber?: string;
  };
  consents?: { terms?: boolean; privacy?: boolean; hipaa?: boolean };
}

export interface PatientDraftEnvelope {
  data: PatientDraft;
  updatedAt: string;
}

export interface OnboardingStatus {
  completed: boolean;
  draft: PatientDraftEnvelope | null;
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
    gender: string | null;
    sexAtBirth: string;
    bloodType: string;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    mrn: string;
    emergencyContact: { name: string; relationship: string; phone: string } | null;
    allergies: string[];
    conditions: string[];
    insurance: {
      providerName: string | null;
      planName: string | null;
      policyNumber: string;
      memberId: string | null;
      groupNumber: string | null;
    } | null;
    consents: PatientConsentsInput;
    documents: PatientDocument[];
  } | null;
  staff: {
    title: string | null;
    licenseNumber: string | null;
    employeeId: string | null;
    ward: string | null;
    departmentId: string | null;
    specialtyId?: string | null;
    departmentName?: string | null;
    specialtyName?: string | null;
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
  patient?: PatientProfileInput;
  staff?: {
    title: string;
    licenseNumber?: string | null;
    employeeId?: string | null;
    ward?: string | null;
    departmentId?: string | null;
    specialtyId?: string | null;
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
  hospitalId?: string;
  phone?: string;
  departmentId?: string;
  specialtyId?: string;
  employeeId?: string;
  title?: string;
  licenseNumber?: string;
  mode?: "CREATE" | "INVITE";
}

/* Admin user management */

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  image: string | null;
  phone: string | null;
  hospitalId: string | null;
  mrn: string | null;
  emailVerified: boolean;
  profileCompleted: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  departmentId: string | null;
  departmentName: string | null;
}

export interface ManagedUserDetail {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  phone: string | null;
  hospitalId: string | null;
  image: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  onboardingCompletedAt: string | null;
  profileCompleted: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  roomVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  departmentId: string | null;
  departmentName: string | null;
  specialtyId: string | null;
  specialtyName: string | null;
  title: string | null;
  licenseNumber: string | null;
  employeeId: string | null;
  ward: string | null;
  mrn: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  dateOfBirth: string | null;
  patientPhone: string | null;
  invitation: {
    id: string;
    status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
    expiresAt: string;
    createdAt: string;
  } | null;
}

export interface UserStatistics {
  total: number;
  active: number;
  pending: number;
  pendingInvitations: number;
  suspended: number;
  doctors: number;
  nurses: number;
  patients: number;
  profilesComplete: number;
}

export type ManagedUserSort = "name" | "email" | "role" | "status" | "createdAt";

export interface ManagedUserParams extends ListParams {
  role?: string;
  status?: string;
  departmentId?: string;
  verified?: "true" | "false";
  profileComplete?: "true" | "false";
  sort?: ManagedUserSort;
  order?: "asc" | "desc";
}

export interface UpdateManagedUserInput {
  name?: string;
  phone?: string | null;
  hospitalId?: string | null;
  departmentId?: string | null;
  specialtyId?: string | null;
  title?: string | null;
  employeeId?: string | null;
  ward?: string | null;
  licenseNumber?: string | null;
}
