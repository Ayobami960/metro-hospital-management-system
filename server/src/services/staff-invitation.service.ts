import crypto from "node:crypto";
import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../db/client.js";
import { accounts, patients, sessions, staffProfiles, users } from "../db/schema/index.js";
import { staffInvitations } from "../db/schema/security.js";
import { departments, specialties } from "../db/schema/reference.js";
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
  SUPER_ADMIN: ["ADMIN", "DOCTOR", "NURSE", "PATIENT", "RECEPTION", "PHARMACY", "LABORATORY", "BILLING"],
  ADMIN: ["DOCTOR", "NURSE", "PATIENT", "RECEPTION", "PHARMACY", "LABORATORY", "BILLING"],
};

const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: "Super administrator",
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  PATIENT: "Patient",
  RECEPTION: "Reception",
  PHARMACY: "Pharmacy",
  LABORATORY: "Laboratory",
  BILLING: "Billing",
};

export const invitableRolesFor = (role: UserRole): UserRole[] => INVITABLE_BY[role] ?? [];

export const normalizeHospitalId = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export interface InviteStaffInput {
  name: string;
  email: string;
  role: UserRole;
  hospitalId?: string | undefined;
  phone?: string | undefined;
  departmentId?: string | undefined;
  specialtyId?: string | undefined;
  employeeId?: string | undefined;
  licenseNumber?: string | undefined;
  title?: string | undefined;
}

const STAFF_ROLES: UserRole[] = [
  "DOCTOR",
  "NURSE",
  "RECEPTION",
  "PHARMACY",
  "LABORATORY",
  "BILLING",
];

export const isStaffRole = (role: UserRole): boolean => STAFF_ROLES.includes(role);

/** Invitations never live longer than the 24-hour policy. */
const invitationExpiry = (from: Date): Date =>
  new Date(from.getTime() + Math.min(env.auth.invitationTtlHours, 24) * 3_600_000);

const passwordProblem = (password: string): string | null => {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
};

const invitationEmail = (name: string, role: UserRole, token: string, expiresAt: Date): string => {
  const link = `${env.frontendOrigin}/accept-invitation?token=${encodeURIComponent(token)}`;
  const expiry = new Intl.DateTimeFormat("en-GB", {
    timeZone: env.clinicTimezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAt);
  return [
    `Hello ${name},`,
    "",
    `You have been invited to join ${env.hospitalName}.`,
    "",
    `Your assigned role is: ${ROLE_LABEL[role]} (${role}).`,
    "",
    "Please follow the secure invitation link below to complete your account setup, create your password, and verify your email address.",
    "",
    link,
    "",
    `This invitation expires ${expiry} (${env.clinicTimezone}) and can only be used once.`,
    "If you were not expecting this invitation, contact the hospital IT desk.",
    "",
    `${env.hospitalName} Administration`,
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
  const patientRole = input.role === "PATIENT";
  const hospitalId = patientRole ? null : normalizeHospitalId(input.hospitalId ?? "");
  if (!patientRole && hospitalId!.length < 3) throw badRequest("Enter a valid hospital ID.");

  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing && existing.status !== "INVITED") {
    throw conflict("An account with that email already exists.");
  }

  if (hospitalId) {
    const [badgeOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.hospitalId, hospitalId))
      .limit(1);
    if (badgeOwner && badgeOwner.id !== existing?.id) {
      throw conflict("That hospital ID is already assigned to another account.");
    }
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

  if (!patientRole) {
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
          specialtyId: input.specialtyId ?? null,
          title: input.title ?? null,
          licenseNumber: input.licenseNumber ?? null,
          employeeId: input.employeeId ?? null,
          updatedAt: now,
        })
        .where(eq(staffProfiles.id, profile.id));
    } else if (input.departmentId || input.employeeId || input.title) {
      await db.insert(staffProfiles).values({
        userId,
        departmentId: input.departmentId ?? null,
        specialtyId: input.specialtyId ?? null,
        title: input.title ?? null,
        licenseNumber: input.licenseNumber ?? null,
        employeeId: input.employeeId ?? null,
      });
    }
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
  const expiresAt = invitationExpiry(now);
  const [invitation] = await db
    .insert(staffInvitations)
    .values({
      userId,
      email,
      name: input.name,
      role: input.role,
      hospitalId,
      departmentId: patientRole ? null : (input.departmentId ?? null),
      employeeId: patientRole ? null : (input.employeeId ?? null),
      tokenHash: sha256(token),
      expiresAt,
      invitedByUserId: actor.id,
    })
    .returning({ id: staffInvitations.id, expiresAt: staffInvitations.expiresAt });
  if (!invitation) throw new AppError("INTERNAL_ERROR", "Invitation could not be created.");

  const delivered = await sendEmail({
    to: email,
    subject: patientRole
      ? `You Have Been Invited to Join ${env.hospitalName}`
      : `You Have Been Invited to Join ${env.hospitalName}`,
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
  if (user.status !== "INVITED") {
    throw forbidden("This account is not open for invitation activation.");
  }

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

  // Credential, account state and token consumption succeed or roll back together.
  await db.transaction(async (tx) => {
    await tx.insert(accounts).values({
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: passwordHash,
    });
    await tx
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
    const [consumed] = await tx
      .update(staffInvitations)
      .set({ consumedAt: now, updatedAt: now })
      .where(and(eq(staffInvitations.id, row.id), isNull(staffInvitations.consumedAt)))
      .returning({ id: staffInvitations.id });
    if (!consumed) throw conflict("This invitation has already been used.");

    await tx
      .update(staffInvitations)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          sql`lower(${staffInvitations.email}) = ${invitation.email.toLowerCase()}`,
          isNull(staffInvitations.consumedAt),
          isNull(staffInvitations.revokedAt),
        ),
      );
  });

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

export interface ManagedUserQuery {
  page: number;
  pageSize: number;
  search: string;
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
  departmentId?: string | undefined;
  verified?: boolean | undefined;
  profileComplete?: boolean | undefined;
  sort?: "name" | "email" | "role" | "status" | "createdAt" | undefined;
  order?: "asc" | "desc" | undefined;
}

export interface ManagedUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  image: string | null;
  phone: string | null;
  hospitalId: string | null;
  mrn: string | null;
  emailVerified: boolean;
  profileCompleted: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  departmentId: string | null;
  departmentName: string | null;
}

const managedUserSelection = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  status: users.status,
  image: users.image,
  phone: users.phone,
  hospitalId: users.hospitalId,
  mrn: patients.mrn,
  emailVerified: users.emailVerified,
  onboardingCompletedAt: users.onboardingCompletedAt,
  twoFactorEnabled: users.twoFactorEnabled,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  departmentId: staffProfiles.departmentId,
  departmentName: departments.name,
};

const managedUserQuery = (query: ManagedUserQuery) => {
  const conditions: SQL[] = [];
  if (query.role) conditions.push(sql`${users.role} = ${query.role}`);
  if (query.status) conditions.push(sql`${users.status} = ${query.status}`);
  if (query.departmentId) conditions.push(sql`${staffProfiles.departmentId} = ${query.departmentId}`);
  if (query.verified !== undefined) conditions.push(sql`${users.emailVerified} = ${query.verified}`);
  if (query.profileComplete !== undefined) {
    conditions.push(
      query.profileComplete
        ? sql`${users.onboardingCompletedAt} is not null`
        : sql`${users.onboardingCompletedAt} is null`,
    );
  }
  if (query.search) {
    const term = `%${query.search}%`;
    const search = or(
      ilike(users.name, term),
      ilike(users.email, term),
      ilike(users.hospitalId, term),
      ilike(patients.mrn, term),
    );
    if (search) conditions.push(search);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
};

const managedUserOrder = (sort: ManagedUserQuery["sort"], order: "asc" | "desc") => {
  const direction = order === "asc" ? asc : desc;
  switch (sort) {
    case "name":
      return direction(users.name);
    case "email":
      return direction(users.email);
    case "role":
      return direction(users.role);
    case "status":
      return direction(users.status);
    default:
      return direction(users.createdAt);
  }
};

interface ManagedUserSelectRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  image: string | null;
  phone: string | null;
  hospitalId: string | null;
  mrn: string | null;
  emailVerified: boolean;
  onboardingCompletedAt: Date | null;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  departmentId: string | null;
  departmentName: string | null;
}

const toManagedUser = (row: ManagedUserSelectRow): ManagedUserRow => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  status: row.status,
  image: row.image,
  phone: row.phone,
  hospitalId: row.hospitalId,
  mrn: row.mrn,
  emailVerified: row.emailVerified,
  profileCompleted: Boolean(row.onboardingCompletedAt),
  twoFactorEnabled: row.twoFactorEnabled,
  lastLoginAt: row.lastLoginAt,
  createdAt: row.createdAt,
  departmentId: row.departmentId,
  departmentName: row.departmentName,
});

/** Every role in the directory (staff and patients), for the admin table. */
export const listManagedUsers = async (
  query: ManagedUserQuery,
): Promise<{ rows: ManagedUserRow[]; total: number }> => {
  const where = managedUserQuery(query);
  const offset = (query.page - 1) * query.pageSize;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(managedUserSelection)
      .from(users)
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .leftJoin(departments, eq(staffProfiles.departmentId, departments.id))
      .leftJoin(patients, eq(patients.userId, users.id))
      .where(where)
      .orderBy(managedUserOrder(query.sort, query.order ?? "desc"))
      .limit(query.pageSize)
      .offset(offset),
    db
      .select({ value: count() })
      .from(users)
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .leftJoin(patients, eq(patients.userId, users.id))
      .where(where),
  ]);

  return {
    rows: (rows as ManagedUserSelectRow[]).map(toManagedUser),
    total: Number(totalRow?.value ?? 0),
  };
};

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

export const getUserStatistics = async (): Promise<UserStatistics> => {
  const [row] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${users.status} = 'ACTIVE')`,
      pending: sql<number>`count(*) filter (where ${users.status} = 'INVITED')`,
      suspended: sql<number>`count(*) filter (where ${users.status} in ('SUSPENDED', 'LOCKED', 'DEACTIVATED'))`,
      doctors: sql<number>`count(*) filter (where ${users.role} = 'DOCTOR')`,
      nurses: sql<number>`count(*) filter (where ${users.role} = 'NURSE')`,
      patients: sql<number>`count(*) filter (where ${users.role} = 'PATIENT')`,
      profilesComplete: sql<number>`count(*) filter (where ${users.onboardingCompletedAt} is not null)`,
    })
    .from(users);

  const [invites] = await db
    .select({ value: count() })
    .from(staffInvitations)
    .where(
      and(
        isNull(staffInvitations.consumedAt),
        isNull(staffInvitations.revokedAt),
        sql`${staffInvitations.expiresAt} > now()`,
      ),
    );

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    pending: Number(row?.pending ?? 0),
    pendingInvitations: Number(invites?.value ?? 0),
    suspended: Number(row?.suspended ?? 0),
    doctors: Number(row?.doctors ?? 0),
    nurses: Number(row?.nurses ?? 0),
    patients: Number(row?.patients ?? 0),
    profilesComplete: Number(row?.profilesComplete ?? 0),
  };
};

export const getManagedUser = async (userId: string) => {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      phone: users.phone,
      hospitalId: users.hospitalId,
      image: users.image,
      emailVerified: users.emailVerified,
      emailVerifiedAt: users.emailVerifiedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
      twoFactorEnabled: users.twoFactorEnabled,
      lastLoginAt: users.lastLoginAt,
      roomVerifiedAt: users.roomVerifiedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      departmentId: staffProfiles.departmentId,
      departmentName: departments.name,
      specialtyId: staffProfiles.specialtyId,
      specialtyName: specialties.name,
      title: staffProfiles.title,
      licenseNumber: staffProfiles.licenseNumber,
      employeeId: staffProfiles.employeeId,
      ward: staffProfiles.ward,
      mrn: patients.mrn,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      patientPhone: patients.phone,
    })
    .from(users)
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .leftJoin(departments, eq(staffProfiles.departmentId, departments.id))
    .leftJoin(specialties, eq(staffProfiles.specialtyId, specialties.id))
    .leftJoin(patients, eq(patients.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) throw notFound("User not found");

  const [invitation] = await db
    .select({
      id: staffInvitations.id,
      status: sql<string>`case
        when ${staffInvitations.consumedAt} is not null then 'ACCEPTED'
        when ${staffInvitations.revokedAt} is not null then 'REVOKED'
        when ${staffInvitations.expiresAt} <= now() then 'EXPIRED'
        else 'PENDING'
      end`,
      expiresAt: staffInvitations.expiresAt,
      createdAt: staffInvitations.createdAt,
    })
    .from(staffInvitations)
    .where(eq(staffInvitations.userId, userId))
    .orderBy(desc(staffInvitations.createdAt))
    .limit(1);

  return {
    ...row,
    profileCompleted: Boolean(row.onboardingCompletedAt),
    invitation: invitation ?? null,
  };
};

const assertCanManageTarget = (
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
): void => {
  if (target.id === actor.id) throw badRequest("You cannot manage your own account here.");
  if ((target.role === "ADMIN" || target.role === "SUPER_ADMIN") && actor.role !== "SUPER_ADMIN") {
    throw forbidden("Only a super administrator can manage that account.");
  }
};

export interface UpdateManagedUserInput {
  name?: string | undefined;
  phone?: string | null | undefined;
  hospitalId?: string | null | undefined;
  departmentId?: string | null | undefined;
  specialtyId?: string | null | undefined;
  title?: string | null | undefined;
  employeeId?: string | null | undefined;
  ward?: string | null | undefined;
  licenseNumber?: string | null | undefined;
}

export const updateManagedUser = async (
  actor: { id: string; role: UserRole },
  userId: string,
  input: UpdateManagedUserInput,
): Promise<void> => {
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) throw notFound("User not found");
  assertCanManageTarget(actor, target);

  const now = new Date();
  let hospitalId: string | null | undefined;
  if (input.hospitalId !== undefined) {
    hospitalId = input.hospitalId ? normalizeHospitalId(input.hospitalId) : null;
    if (hospitalId && hospitalId.length < 3) throw badRequest("Enter a valid hospital ID.");
    if (hospitalId) {
      const [owner] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.hospitalId, hospitalId))
        .limit(1);
      if (owner && owner.id !== userId) {
        throw conflict("That hospital ID is already assigned to another account.");
      }
    }
  }

  await db
    .update(users)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(hospitalId !== undefined ? { hospitalId } : {}),
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  if (isStaffRole(target.role)) {
    const values = {
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null } : {}),
      ...(input.specialtyId !== undefined ? { specialtyId: input.specialtyId || null } : {}),
      ...(input.title !== undefined ? { title: input.title || null } : {}),
      ...(input.employeeId !== undefined ? { employeeId: input.employeeId || null } : {}),
      ...(input.ward !== undefined ? { ward: input.ward || null } : {}),
      ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber || null } : {}),
      updatedAt: now,
    };
    const [profile] = await db
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, userId))
      .limit(1);
    if (profile) {
      await db.update(staffProfiles).set(values).where(eq(staffProfiles.id, profile.id));
    } else {
      await db.insert(staffProfiles).values({ userId, ...values });
    }
  }

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "identity.user.updated",
    module: "identity",
    entityType: "user",
    entityId: userId,
    level: "INFO",
    detail: { fields: Object.keys(input) },
  });
};

export const changeUserRole = async (
  actor: { id: string; role: UserRole },
  userId: string,
  role: UserRole,
): Promise<void> => {
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) throw notFound("User not found");
  assertCanManageTarget(actor, target);

  const assignable =
    actor.role === "SUPER_ADMIN"
      ? [...invitableRolesFor(actor.role), "ADMIN"]
      : invitableRolesFor(actor.role);
  if (!assignable.includes(role)) {
    throw forbidden(`Role ${actor.role} cannot assign ${role}`);
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      role,
      // The new role has its own mandatory onboarding requirements, so the
      // previous completion no longer counts.
      onboardingCompletedAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
  await db
    .update(sessions)
    .set({ revokedAt: now, revokeReason: "role_changed", updatedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "identity.user.role_changed",
    module: "identity",
    entityType: "user",
    entityId: userId,
    level: "WARNING",
    detail: { from: target.role, to: role },
  });
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
    // A suspended pending invite must not be able to activate itself.
    await db
      .update(staffInvitations)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(staffInvitations.userId, userId),
          isNull(staffInvitations.consumedAt),
          isNull(staffInvitations.revokedAt),
        ),
      );
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
  const expiresAt = invitationExpiry(new Date());
  await db
    .update(staffInvitations)
    .set({ tokenHash: sha256(token), expiresAt, updatedAt: new Date() })
    .where(eq(staffInvitations.id, row.id));

  const delivered = await sendEmail({
    to: row.email,
    subject: `You Have Been Invited to Join ${env.hospitalName}`,
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
