import { and, asc, count, eq, ilike, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.js";
import { cptCodes, departments, doctors, insurers, insurancePlans, specialties, staffProfiles, users } from "../db/schema/index.js";
import { AppError, conflict, notFound } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import type { Actor } from "../lib/authorize.js";
import { initials } from "../lib/crypto.js";
import type { UserRole } from "../db/schema/enums.js";

/**
 * Staff directory and the reference catalogues the billing and prescribing
 * screens pick from (insurers, plans, CPT codes). Account creation here only
 * provisions the login: clinical profiles are created by their own endpoints.
 */

export const listUsers = async (query: {
  page: number;
  pageSize: number;
  search?: string | undefined;
  role?: string | undefined;
  status?: string | undefined;
}) => {
  const filters = [];
  if (query.search) {
    filters.push(sql<boolean>`(${users.name} ilike ${`%${query.search}%`} or ${users.email} ilike ${`%${query.search}%`})`);
  }
  if (query.role) filters.push(eq(users.role, query.role as UserRole));
  if (query.status) filters.push(eq(users.status, query.status as "ACTIVE"));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: sql<string>`${users.role}::text`,
        status: sql<string>`${users.status}::text`,
        image: users.image,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        doctorId: doctors.id,
        licenseNumber: doctors.licenseNumber,
        department: departments.name,
        specialty: specialties.name,
        title: staffProfiles.title,
        employeeId: staffProfiles.employeeId,
      })
      .from(users)
      .leftJoin(doctors, eq(doctors.userId, users.id))
      .leftJoin(departments, eq(doctors.departmentId, departments.id))
      .leftJoin(specialties, eq(doctors.specialtyId, specialties.id))
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .where(where)
      .orderBy(asc(users.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(users).where(where),
  ]);

  return { rows: rows.map((row) => ({ ...row, avatarInitials: initials(row.name) })), total: Number(totals?.value ?? 0) };
};

export const createUser = async (
  actor: Actor,
  input: {
    name: string;
    email: string;
    role: UserRole;
    phone?: string | undefined;
    title?: string | undefined;
    employeeId?: string | undefined;
  },
) => {
  if (input.role === "PATIENT") {
    throw new AppError("BAD_REQUEST", "Patient accounts are created through patient registration");
  }
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(ilike(users.email, input.email))
    .limit(1);
  if (existing) throw conflict("That email address is already registered");

  try {
    const created = await db.transaction(async (tx) => {
      const id = randomUUID();
      const [user] = await tx
        .insert(users)
        .values({
          id,
          name: input.name,
          email: input.email.toLowerCase(),
          phone: input.phone ?? null,
          role: input.role,
          status: "INVITED",
          mustChangePassword: true,
        })
        .returning();
      if (!user) throw new AppError("INTERNAL_ERROR", "User insert failed");
      if (input.title || input.employeeId) {
        await tx.insert(staffProfiles).values({ userId: id, title: input.title ?? null, employeeId: input.employeeId ?? null });
      }
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "user.create",
          module: "admin",
          entityType: "user",
          entityId: id,
          detail: { role: input.role, invitePending: true },
        },
        tx,
      );
      return user;
    });
    return { id: created.id, name: created.name, email: created.email, role: created.role, status: created.status, invitePending: true };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw conflict("That email address is already registered");
    throw error;
  }
};

export const updateUser = async (
  actor: Actor,
  id: string,
  input: {
    name?: string | undefined;
    phone?: string | null | undefined;
    role?: UserRole | undefined;
    status?: "ACTIVE" | "SUSPENDED" | "LOCKED" | "DEACTIVATED" | undefined;
  },
) => {
  const [existing] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing) throw notFound("User not found");
  if (existing.id === actor.id && input.status && input.status !== "ACTIVE") {
    throw new AppError("BAD_REQUEST", "You cannot deactivate your own account");
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "User update failed");
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "user.update",
        module: "admin",
        entityType: "user",
        entityId: id,
        detail: input,
      },
      tx,
    );
    return row;
  });

  return { id: updated.id, name: updated.name, role: updated.role, status: updated.status };
};

export const listInsurers = async () =>
  db
    .select({
      id: insurers.id,
      name: insurers.name,
      code: insurers.code,
      phone: insurers.phone,
      email: insurers.email,
      plans: sql<number>`(select count(*)::int from hms.insurance_plan p where p.insurer_id = ${insurers.id} and p.active)`,
    })
    .from(insurers)
    .orderBy(asc(insurers.name));

export const listInsurancePlans = async (insurerId?: string) =>
  db
    .select({
      id: insurancePlans.id,
      insurerId: insurancePlans.insurerId,
      insurer: insurers.name,
      name: insurancePlans.name,
      planType: insurancePlans.planType,
      copayMinor: insurancePlans.copayMinor,
      deductibleMinor: insurancePlans.deductibleMinor,
      oopMaxMinor: insurancePlans.oopMaxMinor,
      coveragePercent: insurancePlans.coveragePercent,
      active: insurancePlans.active,
    })
    .from(insurancePlans)
    .innerJoin(insurers, eq(insurancePlans.insurerId, insurers.id))
    .where(insurerId ? eq(insurancePlans.insurerId, insurerId) : eq(insurancePlans.active, true))
    .orderBy(asc(insurers.name), asc(insurancePlans.name));

export const listCptCodes = async (search?: string) =>
  db
    .select({ id: cptCodes.id, code: cptCodes.code, description: cptCodes.description, priceMinor: cptCodes.priceMinor })
    .from(cptCodes)
    .where(search ? sql<boolean>`(${cptCodes.code} ilike ${`%${search}%`} or ${cptCodes.description} ilike ${`%${search}%`})` : undefined)
    .orderBy(asc(cptCodes.code))
    .limit(100);

export const listDepartmentsLite = async () =>
  db
    .select({ id: departments.id, name: departments.name, floor: departments.floor })
    .from(departments)
    .orderBy(asc(departments.name));

export const listSpecialtiesLite = async () =>
  db.select({ id: specialties.id, name: specialties.name }).from(specialties).orderBy(asc(specialties.name));

/** Roles that may be assigned from the staff form. */
export const assignableRoles = (): UserRole[] => [
  "ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTION",
  "PHARMACY",
  "LABORATORY",
  "BILLING",
];

export const usersByIds = async (ids: string[]) =>
  ids.length === 0
    ? []
    : db
        .select({ id: users.id, name: users.name, role: sql<string>`${users.role}::text` })
        .from(users)
        .where(inArray(users.id, ids));
