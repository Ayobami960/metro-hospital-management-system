import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { hms, idColumn, timestamps } from "./namespace.js";
import { userRole, userStatus } from "./enums.js";

/**
 * better-auth tables (user/session/account/verification) keep their expected
 * shape; `role` is an additional field consumed by the RBAC layer.
 */
export const users = hms.table(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** Set once the user has submitted the mandatory first-login profile form. */
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    image: text("image"),
    role: userRole("role").default("PATIENT").notNull(),
    status: userStatus("status").default("ACTIVE").notNull(),
    phone: text("phone"),
    /** Hospital identification number printed on the staff badge. */
    hospitalId: text("hospital_id"),
    /** Last successful Room Page hospital-ID check. */
    roomVerifiedAt: timestamp("room_verified_at", { withTimezone: true }),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    mustChangePassword: boolean("must_change_password").default(false).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("user_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("user_hospital_id_uq").on(t.hospitalId),
  ],
);

export const sessions = hms.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceName: text("device_name"),
    /** Set when the session cleared its TOTP (or recovery-code) challenge. */
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    mfaMethod: text("mfa_method"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),
    ...timestamps,
  },
  (t) => [uniqueIndex("session_token_uq").on(t.token), index("session_user_idx").on(t.userId)],
);

export const accounts = hms.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verifications = hms.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

/**
 * TOTP enrollment. `secret` is AES-256-GCM encrypted with FIELD_ENCRYPTION_KEY
 * (never plaintext), and `backup_codes` holds Argon2id digests of single-use
 * recovery codes.
 */
export const twoFactor = hms.table("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(false).notNull(),
  failedVerificationCount: integer("failed_verification_count").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  ...timestamps,
});

/** Staff directory extension for clinicians. */
export const staffProfiles = hms.table(
  "staff_profile",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    departmentId: uuid("department_id"),
    specialtyId: uuid("specialty_id"),
    licenseNumber: text("license_number"),
    employeeId: text("employee_id"),
    ward: text("ward"),
    ...timestamps,
  },
  (t) => [uniqueIndex("staff_profile_user_uq").on(t.userId)],
);

export const emailTokens = hms.table(
  "email_token",
  {
    id: idColumn(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    purpose: text("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("email_token_hash_uq").on(t.tokenHash), index("email_token_email_idx").on(t.email)],
);

export const loginAttempts = hms.table(
  "login_attempt",
  {
    id: idColumn(),
    email: text("email").notNull(),
    ip: text("ip"),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("login_attempt_email_idx").on(t.email, t.createdAt)],
);

export const notificationPreferences = hms.table(
  "notification_preference",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appointments: boolean("appointments").default(true).notNull(),
    labResults: boolean("lab_results").default(true).notNull(),
    prescriptions: boolean("prescriptions").default(true).notNull(),
    bills: boolean("bills").default(true).notNull(),
    messages: boolean("messages").default(true).notNull(),
    emailChannel: boolean("email_channel").default(true).notNull(),
    smsChannel: boolean("sms_channel").default(false).notNull(),
    pushChannel: boolean("push_channel").default(false).notNull(),
    privacyShareForResearch: boolean("privacy_share_for_research").default(false).notNull(),
    privacyShareWithFamily: boolean("privacy_share_with_family").default(false).notNull(),
    privacyAnalytics: boolean("privacy_analytics").default(false).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("notification_pref_user_uq").on(t.userId)],
);

export const hospitalSettings = hms.table("hospital_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull(),
  addressLine1: text("address_line_1"),
  city: text("city"),
  state: text("state"),
  postalCode: varchar("postal_code", { length: 16 }),
  phone: text("phone"),
  email: text("email"),
  timezone: text("timezone").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  mrnPrefix: text("mrn_prefix").default("MRN").notNull(),
  invoiceDueDays: integer("invoice_due_days").default(30).notNull(),
  nearExpiryDays: integer("near_expiry_days").default(90).notNull(),
  auditRetentionYears: integer("audit_retention_years").default(7).notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
});
