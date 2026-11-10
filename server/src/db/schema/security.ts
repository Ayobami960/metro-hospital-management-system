import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { hms, idColumn, timestamps } from "./namespace.js";
import { users } from "./identity.js";
import { emailPurpose, otpPurpose, userRole } from "./enums.js";

/**
 * Purpose-scoped one-time code.
 *
 * One table serves every verification workflow so the same guarantees
 * (CSPRNG code, Argon2id digest, expiry, attempt limit, resend cooldown, single
 * use) apply everywhere. `purpose` is part of every query, so a code issued for
 * a patient login can never satisfy email verification or Room Access.
 */
export const otpCodes = hms.table(
  "otp_code",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: otpPurpose("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    deliveryStatus: text("delivery_status").default("PENDING").notNull(),
    deliveryAttempts: integer("delivery_attempts").default(0).notNull(),
    lastDeliveryError: text("last_delivery_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("otp_user_purpose_idx").on(t.userId, t.purpose, t.createdAt),
    index("otp_expiry_idx").on(t.expiresAt),
  ],
);

/**
 * Short-lived authorization produced by a verified Daily Room Access Code.
 *
 * This is deliberately NOT a better-auth session: it only allows the holder to
 * sign in with their normal credentials through the role-specific login form.
 * The raw token is only in the httpOnly cookie; the table stores a SHA-256 hash.
 */
export const roomAccessSessions = hms.table(
  "room_access_session",
  {
    id: idColumn(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("room_access_token_uq").on(t.tokenHash),
    index("room_access_user_idx").on(t.userId, t.createdAt),
  ],
);

/**
 * Legacy mandatory daily code table, kept so existing production rows and the
 * migration history stay intact. No authentication path reads it any more.
 *
 * One active row per user per hospital-local day is enforced by
 * `daily_code_user_date_uq`, which is what made the old scheduler idempotent.
 *
 * The plaintext code is never stored: `code_hash` is an Argon2id digest. The
 * delivery columns record whether the email actually left the server.
 */
export const dailyVerificationCodes = hms.table(
  "daily_verification_code",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    codeHash: text("code_hash").notNull(),
    verificationDate: date("verification_date", { mode: "string" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    deliveryStatus: text("delivery_status").default("PENDING").notNull(),
    deliveryAttempts: integer("delivery_attempts").default(0).notNull(),
    lastDeliveryError: text("last_delivery_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("daily_code_user_date_uq").on(t.userId, t.verificationDate),
    index("daily_code_date_idx").on(t.verificationDate),
  ],
);

/**
 * Staff invitation. Tokens are single use: `consumed_at` is set atomically on
 * acceptance, and only a SHA-256 digest of the token is persisted.
 */
export const staffInvitations = hms.table(
  "staff_invitation",
  {
    id: idColumn(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRole("role").notNull(),
    hospitalId: text("hospital_id"),
    departmentId: uuid("department_id"),
    employeeId: text("employee_id"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("staff_invitation_token_uq").on(t.tokenHash),
    index("staff_invitation_email_idx").on(sql`lower(${t.email})`),
  ],
);

/**
 * Distributed lock for backend jobs. A job may only run while it holds the
 * row: the conditional upsert in `acquireJobLock` fails when another replica
 * still holds an unexpired lease, so duplicate sends cannot happen even if
 * every instance schedules the same tick.
 */
export const jobLocks = hms.table("job_lock", {
  name: text("name").primaryKey(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
  lockedBy: text("locked_by").notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastDetail: text("last_detail"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Delivery log for outbound mail (the table already exists in the database). */
export const emailOutbox = hms.table(
  "email_outbox",
  {
    id: idColumn(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    purpose: emailPurpose("purpose").notNull(),
    provider: text("provider").default("stub").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("email_outbox_to_idx").on(t.to)],
);
