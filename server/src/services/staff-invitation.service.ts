import crypto from "node:crypto";
import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/client.js";
import { accounts, sessions, staffProfiles, users } from "../db/schema/identity.js";
import { staffInvitations } from "../db/schema/security.js";
import type { UserRole, UserStatus } from "../db/schema/enums.js";
import { env } from "../config/env.js";
import { writeAudit } from "../lib/audit.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { sendEmail } from "./email.service.js";
import { issueOtp } from "./otp.service.js";

/**
 * Staff accounts are never self-registered: an administrator invites them with
 * a single-use token, and only that token can activate the account. The role
 * and hospital ID come from the invitation, never from the acceptance request.
 */

const INVITABLE_BY: Partial<Record<UserRole, UserRole[]>> = {
  SUPER_ADMIN: ["ADMIN", "DOCTOR", "NURSE", "RECEPTION", "PHARMACY", "LABORATORY", "BILLING"],
  ADMIN: ["DOCTOR", "NURSE", "RECEPTION", "PHARMACY", "LABORATORY", "BILLING"],
};

export const invitableRolesFor = (role: UserRole): UserRole[] => INVITABLE_BY[role] ?? [];

export const normalizeHospitalId = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export interface InviteStaffInput {
  name: string;
  email: string;
  role: UserRole;
  hospitalId: string;
  phone?: string | undefined;
  departmentId?: string | undefined;
  employeeId?: string | undefined;
}

const passwordProblem = (password: string): string | null => {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
};

const invitationEmail = (name: string, role: UserRole, token: string, expiresAt: Date): string => {
  const link = `${env.frontendOrigin}/activate-account?token=${encodeURIComponent(token)}`;
  const expiry = new Intl.DateTimeFormat("en-GB", {
    timeZone: env.clinicTimezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt);
  return [
    `Hello ${name},`,
    "",
    `An account has been created for you at ${env.hospitalName} with the role ${role}.`,
    "Set your password once using the link below; it can only be used once:",
    "",
    link,
    "",
    `The link expires ${expiry} (${env.clinicTimezone}).`,
    "If you were not expecting this invitation, contact the hospital IT desk.",
  ].join("\n");
};

export const inviteStaff = async (
  actor: { id: string; role: UserRole },
  input: InviteStaffInput,
): Promise<{ invitationId: string; email: string; role: UserRole; expiresAt: Date; delivered: boolean }> => {
  const allowed = invitableRolesFor(actor.role);
  if (!allowed.includes(input.role)) {
    throw forbidden(`Role ${actor.role} cannot invite ${input.role}`);
  }

  const email = input.email.trim().toLowerCase();
  const hospitalId = normalizeHospitalId(input.hospitalId);
  if (hospitalId.length < 3) throw badRequest("Enter a valid hospital ID.");

  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing && existing.status !== "INVITED") {
    throw conflict("An account with that email already exists.");
  }

  const [badgeOwner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.hospitalId, hospitalId))
    .limit(1);
  if (badgeOwner && badgeOwner.id !== existing?.id) {
    throw conflict("That hospital ID is already assigned to another account.");
  }

  const userId = existing?.id ?? crypto.randomUUID();
  const now = new Date();
  if (existing) {
    await db
      .update(users)
      .set({
        name: input.name,
        role: input.role,
        phone: input.phone ?? existing.phone,
        hospitalId,
        status: "INVITED",
        emailVerified: false,
        emailVerifiedAt: null,
        onboardingCompletedAt: null,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  } else {
    await db.insert(users).values({
      id: userId,
      name: input.name,
      email,
      emailVerified: false,
      role: input.role,
      status: "INVITED",
      phone: input.phone ?? null,
      hospitalId,
    });
  }

  const [profile] = await db
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, userId))
    .limit(1);
  if (profile) {
    await db
      .update(staffProfiles)
      .set({
        departmentId: input.departmentId ?? null,
        employeeId: input.employeeId ?? null,
        updatedAt: now,
      })
      .where(eq(staffProfiles.id, profile.id));
  } else if (input.departmentId || input.employeeId) {
    await db.insert(staffProfiles).values({
      userId,
      departmentId: input.departmentId ?? null,
      employeeId: input.employeeId ?? null,
    });
  }

  // Any earlier pending invitation for this address stops working now.
  await db
    .update(staffInvitations)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        sql`lower(${staffInvitations.email}) = ${email}`,
        isNull(staffInvitations.consumedAt),
        isNull(staffInvitations.revokedAt),
      ),
    );

  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + env.auth.invitationTtlHours * 3_600_000);
  const [invitation] = await db
    .insert(staffInvitations)
    .values({
      userId,
      email,
      name: input.name,
      role: input.role,
      hospitalId,
      departmentId: input.departmentId ?? null,
      employeeId: input.employeeId ?? null,
      tokenHash: sha256(token),
      expiresAt,
      invitedByUserId: actor.id,
    })
    .returning({ id: staffInvitations.id, expiresAt: staffInvitations.expiresAt });
  if (!invitation) throw new AppError("INTERNAL_ERROR", "Invitation could not be created.");

  const delivered = await sendEmail({
    to: email,
    subject: `Your ${env.hospitalName} staff invitation`,
    text: invitationEmail(input.name, input.role, token, expiresAt),
    purpose: "INVITE",
  });
  if (!delivered) logger.warn({ invitationId: invitation.id }, "invitation email not delivered");

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "identity.staff.invited",
    module: "identity",
    entityType: "user",
    entityId: userId,
    level: "SUCCESS",
    detail: { role: input.role, delivered },
  });

  return { invitationId: invitation.id, email, role: input.role, expiresAt, delivered };
};

export const validateInvitation = async (
  token: string,
): Promise<{ email: string; name: string; role: UserRole; expiresAt: Date }> => {
  const [row] = await db
    .select()
    .from(staffInvitations)
    .where(eq(staffInvitations.tokenHash, sha256(token)))
    .limit(1);
  if (!row || row.consumedAt || row.revokedAt) {
    throw notFound("This invitation link is not valid.");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError("PRECONDITION_FAILED", "This invitation has expired. Ask an administrator to resend it.");
  }
  return { email: row.email, name: row.name, role: row.role, expiresAt: row.expiresAt };
};

export const acceptInvitation = async (input: {
  token: string;
  password: string;
  name?: string;
}): Promise<{ email: string; role: UserRole; verificationRequired: boolean }> => {
  const invitation = await validateInvitation(input.token);
  const problem = passwordProblem(input.password);
  if (problem) throw badRequest(problem, { field: "password" });

  const [row] = await db
    .select()
    .from(staffInvitations)
    .where(eq(staffInvitations.tokenHash, sha256(input.token)))
    .limit(1);
  if (!row?.userId) throw notFound("This invitation link is not valid.");

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) throw notFound("This invitation link is not valid.");

  const [credential] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
    .limit(1);
  if (credential) {
    throw conflict("This account has already been activated. Sign in instead.");
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  await db.insert(accounts).values({
    id: crypto.randomUUID(),
    accountId: user.id,
    providerId: "credential",
    userId: user.id,
    password: passwordHash,
  });
  await db
    .update(users)
    .set({
      status: "ACTIVE",
      // The invited address still has to prove control with an OTP before the
      // account can open a dashboard, and the profile is completed after that.
      emailVerified: false,
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
      mustChangePassword: false,
      name: input.name?.trim() && input.name.trim().length >= 2 ? input.name.trim() : user.name,
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  // Atomic single use: the second concurrent acceptance sees no row.
  const [consumed] = await db
    .update(staffInvitations)
    .set({ consumedAt: now, updatedAt: now })
    .where(and(eq(staffInvitations.id, row.id), isNull(staffInvitations.consumedAt)))
    .returning({ id: staffInvitations.id });
  if (!consumed) throw conflict("This invitation has already been used.");

  await db
    .update(staffInvitations)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        sql`lower(${staffInvitations.email}) = ${invitation.email.toLowerCase()}`,
        isNull(staffInvitations.consumedAt),
        isNull(staffInvitations.revokedAt),
      ),
    );

  try {
    await issueOtp(
      { id: user.id, name: user.name, email: user.email },
      "EMAIL_VERIFICATION",
      { force: true },
    );
  } catch (error) {
    // The verification screen can request a fresh code if delivery failed.
    logger.warn({ err: error, userId: user.id }, "staff email verification code not issued");
  }

  await writeAudit({
    actorId: user.id,
    actorRole: invitation.role,
    action: "identity.staff.activated",
    module: "identity",
    entityType: "user",
    entityId: user.id,
    level: "SUCCESS",
  });

  return { email: invitation.email, role: invitation.role, verificationRequired: true };
};

export interface StaffListQuery {
  page: number;
  pageSize: number;
  search: string;
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
}

export const listStaff = async (
  query: StaffListQuery,
): Promise<{ rows: unknown[]; total: number }> => {
  const conditions: SQL[] = [sql`${users.role} <> 'PATIENT'`];
  if (query.role) conditions.push(sql`${users.role} = ${query.role}`);
  if (query.status) conditions.push(sql`${users.status} = ${query.status}`);
  if (query.search) {
    const term = `%${query.search}%`;
    const search = or(
      ilike(users.name, term),
      ilike(users.email, term),
      ilike(users.hospitalId, term),
    );
    if (search) conditions.push(search);
  }
  const where = and(...conditions);
  const offset = (query.page - 1) * query.pageSize;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        phone: users.phone,
        hospitalId: users.hospitalId,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(query.pageSize)
      .offset(offset),
    db.select({ value: count() }).from(users).where(where),
  ]);

  return { rows, total: Number(totalRow?.value ?? 0) };
};

export const setUserStatus = async (
  actor: { id: string; role: UserRole },
  userId: string,
  status: UserStatus,
): Promise<void> => {
  if (userId === actor.id) throw badRequest("You cannot change your own account status.");
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) throw notFound("User not found");
  if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
    throw forbidden("Only a super administrator can change that account.");
  }

  const now = new Date();
  await db.update(users).set({ status, updatedAt: now }).where(eq(users.id, userId));
  if (status !== "ACTIVE") {
    await db
      .update(sessions)
      .set({ revokedAt: now, revokeReason: `status:${status}`, updatedAt: now })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "identity.user.status_changed",
    module: "identity",
    entityType: "user",
    entityId: userId,
    level: "WARNING",
    detail: { status },
  });
};

export const revokeInvitation = async (
  actor: { id: string; role: UserRole },
  invitationId: string,
): Promise<void> => {
  const now = new Date();
  const [revoked] = await db
    .update(staffInvitations)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(staffInvitations.id, invitationId), isNull(staffInvitations.consumedAt)))
    .returning({ id: staffInvitations.id });
  if (!revoked) throw notFound("No pending invitation was found.");
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "identity.invitation.revoked",
    module: "identity",
    entityType: "staff_invitation",
    entityId: invitationId,
    level: "WARNING",
  });
};

export const resendInvitation = async (
  actor: { id: string; role: UserRole },
  invitationId: string,
): Promise<{ delivered: boolean; expiresAt: Date }> => {
  const [row] = await db
    .select()
    .from(staffInvitations)
    .where(eq(staffInvitations.id, invitationId))
    .limit(1);
  if (!row || row.consumedAt || row.revokedAt) throw notFound("No pending invitation was found.");
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AppError("PRECONDITION_FAILED", "That invitation has expired; create a new one.");
  }

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.auth.invitationTtlHours * 3_600_000);
  await db
    .update(staffInvitations)
    .set({ tokenHash: sha256(token), expiresAt, updatedAt: new Date() })
    .where(eq(staffInvitations.id, row.id));

  const delivered = await sendEmail({
    to: row.email,
    subject: `Your ${env.hospitalName} staff invitation`,
    text: invitationEmail(row.name, row.role, token, expiresAt),
    purpose: "INVITE",
  });
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "identity.invitation.resent",
    module: "identity",
    entityType: "staff_invitation",
    entityId: row.id,
    level: "INFO",
    detail: { delivered },
  });
  return { delivered, expiresAt };
};

export const pendingInvitations = async (): Promise<unknown[]> =>
  db
    .select({
      id: staffInvitations.id,
      email: staffInvitations.email,
      name: staffInvitations.name,
      role: staffInvitations.role,
      hospitalId: staffInvitations.hospitalId,
      expiresAt: staffInvitations.expiresAt,
      createdAt: staffInvitations.createdAt,
    })
    .from(staffInvitations)
    .where(and(isNull(staffInvitations.consumedAt), isNull(staffInvitations.revokedAt)))
    .orderBy(desc(staffInvitations.createdAt))
    .limit(100);
