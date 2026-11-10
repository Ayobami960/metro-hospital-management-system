import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { beds, departments, doctors, rooms, specialties } from "../db/schema/reference.js";
import { users } from "../db/schema/identity.js";
import { patients } from "../db/schema/patients.js";
import { bedAssignments } from "../db/schema/clinical.js";
import { requirePermission, type Actor } from "../lib/authorize.js";
import { writeAudit } from "../lib/audit.js";
import { AppError, conflict, notFound } from "../lib/http.js";
import { initials } from "../lib/crypto.js";
import { ageFromDob } from "../lib/time.js";

/**
 * Administration + reference data: departments, specialties, doctors, rooms and
 * beds. Occupancy, staff counts, room status and doctor panel sizes are derived
 * on read; beds are individual rows with an append-only assignment history.
 */

export const DEPARTMENT_SORTS = ["createdAt", "name", "floor", "bedCapacity"] as const;
export const SPECIALTY_SORTS = ["createdAt", "name"] as const;
export const DOCTOR_SORTS = ["createdAt", "name", "license"] as const;
export const ROOM_SORTS = ["createdAt", "number", "floor"] as const;
export const BED_SORTS = ["createdAt", "label"] as const;

export type RoomType = "STANDARD" | "PRIVATE" | "ICU" | "EMERGENCY" | "ISOLATION";
export type BedStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "CLEANING";
export type StaffStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE";

const isUniqueViolation = (error: unknown): boolean => (error as { code?: string }).code === "23505";

export interface ListQuery {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export interface PagedRows<T> {
  rows: T[];
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Departments                                                                */
/* -------------------------------------------------------------------------- */

const departmentStatus = (occupancyPercent: number): "Operational" | "High Volume" | "Under Maintenance" =>
  occupancyPercent >= 85 ? "High Volume" : "Operational";

const departmentIdRef = sql`${sql.identifier("hms")}.${sql.identifier("department")}.${sql.identifier("id")}`;
const departmentHeadDoctorIdRef = sql`${sql.identifier("hms")}.${sql.identifier("department")}.${sql.identifier("head_doctor_id")}`;

const departmentSelection = {
  id: departments.id,
  name: departments.name,
  code: departments.code,
  floor: departments.floor,
  location: departments.location,
  bedCapacity: departments.bedCapacity,
  headDoctorId: departments.headDoctorId,
  head: sql<string | null>`(
    select u.name from hms.doctor d join hms."user" u on u.id = d.user_id
    where d.id = ${departmentHeadDoctorIdRef}
  )`,
  staffCount: sql<number>`(
    select count(*)::int from hms.doctor d where d.department_id = ${departmentIdRef}
  )`,
  bedCount: sql<number>`(
    select count(*)::int from hms.bed b
    join hms.room r on r.id = b.room_id
    where r.department_id = ${departmentIdRef}
  )`,
  bedsOccupied: sql<number>`(
    select count(*)::int from hms.bed b
    join hms.room r on r.id = b.room_id
    where r.department_id = ${departmentIdRef} and b.status = 'OCCUPIED'
  )`,
  bedsMaintenance: sql<number>`(
    select count(*)::int from hms.bed b
    join hms.room r on r.id = b.room_id
    where r.department_id = ${departmentIdRef} and b.status = 'MAINTENANCE'
  )`,
  roomsCount: sql<number>`(
    select count(*)::int from hms.room r where r.department_id = ${departmentIdRef}
  )`,
  createdAt: departments.createdAt,
};

type DepartmentRow = { bedCount: number; bedsOccupied: number; bedsMaintenance: number };

const shapeDepartment = <T extends DepartmentRow>(row: T) => {
  const bedCount = Number(row.bedCount ?? 0);
  const bedsOccupied = Number(row.bedsOccupied ?? 0);
  const bedsMaintenance = Number(row.bedsMaintenance ?? 0);
  const occupancyPercent = bedCount > 0 ? Math.round((bedsOccupied / bedCount) * 100) : 0;
  const underMaintenance = bedCount > 0 && bedsMaintenance === bedCount;
  return {
    ...row,
    bedCount,
    bedsOccupied,
    bedsMaintenance,
    occupancyPercent,
    status: underMaintenance ? "Under Maintenance" : departmentStatus(occupancyPercent),
  };
};

export const listDepartments = async (actor: Actor, query: ListQuery, floor?: string) => {
  requirePermission(actor, "reference:read");
  const filters = [];
  if (query.search) filters.push(ilike(departments.name, `%${query.search}%`));
  if (floor) filters.push(eq(departments.floor, floor));
  const where = filters.length ? and(...filters) : undefined;
  const orderColumn =
    { createdAt: departments.createdAt, name: departments.name, floor: departments.floor, bedCapacity: departments.bedCapacity }[
      query.sort
    ] ?? departments.name;

  const [rows, [totals]] = await Promise.all([
    db
      .select(departmentSelection)
      .from(departments)
      .where(where)
      .orderBy(query.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: count() }).from(departments).where(where),
  ]);
  return { rows: rows.map(shapeDepartment), total: totals?.value ?? 0 };
};

export interface CreateDepartmentInput {
  name: string;
  code?: string | undefined;
  floor?: string | undefined;
  location?: string | undefined;
  headDoctorId?: string | undefined;
  bedCapacity: number;
}

export const createDepartment = async (actor: Actor, body: CreateDepartmentInput, ip?: string) => {
  requirePermission(actor, "reference:write");
  if (body.headDoctorId) {
    const [head] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, body.headDoctorId)).limit(1);
    if (!head) throw notFound("Head doctor not found");
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(departments)
        .values({
          name: body.name,
          code: body.code ?? null,
          floor: body.floor ?? null,
          location: body.location ?? null,
          headDoctorId: body.headDoctorId ?? null,
          bedCapacity: body.bedCapacity,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Department insert failed");
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "department.create",
          module: "admin",
          entityType: "department",
          entityId: row.id,
          detail: { name: row.name },
          ip,
        },
        tx,
      );
      return { id: row.id, name: row.name };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("A department with that name already exists");
    throw error;
  }
};

export const getDepartment = async (actor: Actor, id: string) => {
  requirePermission(actor, "reference:read");
  const [row] = await db.select(departmentSelection).from(departments).where(eq(departments.id, id)).limit(1);
  if (!row) throw notFound("Department not found");

  const [members, roomRows] = await Promise.all([
    db
      .select({ id: doctors.id, name: users.name, specialty: specialties.name, status: doctors.status })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .leftJoin(specialties, eq(doctors.specialtyId, specialties.id))
      .where(eq(doctors.departmentId, id))
      .orderBy(asc(users.name)),
    db
      .select({ id: rooms.id, number: rooms.number, type: rooms.type, floor: rooms.floor })
      .from(rooms)
      .where(eq(rooms.departmentId, id))
      .orderBy(asc(rooms.number)),
  ]);

  return { ...shapeDepartment(row), doctors: members, rooms: roomRows };
};

export type UpdateDepartmentInput = {
  name?: string | undefined;
  code?: string | undefined;
  floor?: string | undefined;
  location?: string | undefined;
  headDoctorId?: string | undefined;
  bedCapacity?: number | undefined;
}

export const updateDepartment = async (
  actor: Actor,
  id: string,
  body: UpdateDepartmentInput,
  ip?: string,
) => {
  requirePermission(actor, "reference:write");
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(departments)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.floor !== undefined ? { floor: body.floor } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.headDoctorId !== undefined ? { headDoctorId: body.headDoctorId } : {}),
          ...(body.bedCapacity !== undefined ? { bedCapacity: body.bedCapacity } : {}),
          updatedAt: new Date(),
        })
        .where(eq(departments.id, id))
        .returning();
      if (!row) throw notFound("Department not found");
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "department.update",
          module: "admin",
          entityType: "department",
          entityId: id,
          detail: body,
          ip,
        },
        tx,
      );
      return { id: row.id, name: row.name };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("A department with that name already exists");
    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/* Specialties                                                                */
/* -------------------------------------------------------------------------- */

export const listSpecialties = async (actor: Actor, query: ListQuery) => {
  requirePermission(actor, "reference:read");
  const where = query.search ? ilike(specialties.name, `%${query.search}%`) : undefined;
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: specialties.id,
        name: specialties.name,
        description: specialties.description,
        doctors: sql<number>`(select count(*)::int from hms.doctor d where d.specialty_id = ${specialties.id})`,
      })
      .from(specialties)
      .where(where)
      .orderBy(query.order === "asc" ? asc(specialties.name) : desc(specialties.name))
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: count() }).from(specialties).where(where),
  ]);
  return { rows, total: totals?.value ?? 0 };
};

export const createSpecialty = async (
  actor: Actor,
  body: { name: string; description?: string | undefined },
  ip?: string,
) => {
  requirePermission(actor, "reference:write");
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(specialties)
        .values({ name: body.name, description: body.description ?? null })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Specialty insert failed");
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "specialty.create",
          module: "admin",
          entityType: "specialty",
          entityId: row.id,
          ip,
        },
        tx,
      );
      return { id: row.id, name: row.name };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("That specialty already exists");
    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/* Doctors                                                                    */
/* -------------------------------------------------------------------------- */

const doctorSelection = {
  id: doctors.id,
  userId: doctors.userId,
  name: users.name,
  email: users.email,
  phone: users.phone,
  accountStatus: users.status,
  specialtyId: doctors.specialtyId,
  specialty: specialties.name,
  departmentId: doctors.departmentId,
  department: departments.name,
  license: doctors.licenseNumber,
  licenseExpiry: doctors.licenseExpiry,
  status: doctors.status,
  credentials: doctors.credentials,
  bio: doctors.bio,
  consultationFeeMinor: doctors.consultationFeeMinor,
  ratingAvg: doctors.ratingAvg,
  ratingCount: doctors.ratingCount,
  createdAt: doctors.createdAt,
  patients: sql<number>`(
    select count(distinct p.id)::int from hms.patient p
    where p.primary_doctor_id = ${doctors.id}
       or exists (
         select 1 from hms.doctor_panel dp
         where dp.patient_id = p.id and dp.doctor_id = ${doctors.id} and dp.active
       )
  )`,
};

export interface DoctorListFilters {
  specialtyId?: string | undefined;
  departmentId?: string | undefined;
  status?: StaffStatus | undefined;
}

export const listDoctors = async (actor: Actor, query: ListQuery, filters: DoctorListFilters) => {
  requirePermission(actor, "reference:read");
  const conditions = [];
  if (query.search) {
    conditions.push(
      sql`(${users.name} ilike ${`%${query.search}%`} or ${doctors.licenseNumber} ilike ${`%${query.search}%`} or ${users.email} ilike ${`%${query.search}%`})`,
    );
  }
  if (filters.specialtyId) conditions.push(eq(doctors.specialtyId, filters.specialtyId));
  if (filters.departmentId) conditions.push(eq(doctors.departmentId, filters.departmentId));
  if (filters.status) conditions.push(eq(doctors.status, filters.status));
  const where = conditions.length ? and(...conditions) : undefined;
  const orderColumn = { createdAt: doctors.createdAt, name: users.name, license: doctors.licenseNumber }[query.sort] ?? users.name;

  const [rows, [totals]] = await Promise.all([
    db
      .select(doctorSelection)
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .leftJoin(specialties, eq(doctors.specialtyId, specialties.id))
      .leftJoin(departments, eq(doctors.departmentId, departments.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: count() }).from(doctors).innerJoin(users, eq(doctors.userId, users.id)).where(where),
  ]);
  return {
    rows: rows.map((row) => ({ ...row, avatarInitials: initials(row.name) })),
    total: totals?.value ?? 0,
  };
};

export interface CreateDoctorInput {
  name: string;
  email: string;
  phone?: string | undefined;
  licenseNumber: string;
  licenseExpiry?: string | undefined;
  departmentId?: string | undefined;
  specialtyId?: string | undefined;
  consultationFeeMinor: number;
  credentials?: string | undefined;
  bio?: string | undefined;
}

/**
 * Creates the staff account (role DOCTOR, status INVITED) and the clinical
 * profile together. Credential provisioning is the invite flow's job: this
 * endpoint never accepts a password, so an admin cannot set one.
 */
export const createDoctor = async (actor: Actor, body: CreateDoctorInput, ip?: string) => {
  requirePermission(actor, "user:create");
  for (const [field, id] of [
    ["departmentId", body.departmentId],
    ["specialtyId", body.specialtyId],
  ] as const) {
    if (!id) continue;
    const table = field === "departmentId" ? departments : specialties;
    const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
    if (!row) throw notFound(`${field === "departmentId" ? "Department" : "Specialty"} not found`);
  }

  try {
    return await db.transaction(async (tx) => {
      const userId = randomUUID();
      await tx.insert(users).values({
        id: userId,
        name: body.name,
        email: body.email.toLowerCase(),
        phone: body.phone ?? null,
        role: "DOCTOR",
        status: "INVITED",
        mustChangePassword: true,
      });
      const [row] = await tx
        .insert(doctors)
        .values({
          userId,
          licenseNumber: body.licenseNumber,
          licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry) : null,
          departmentId: body.departmentId ?? null,
          specialtyId: body.specialtyId ?? null,
          consultationFeeMinor: body.consultationFeeMinor,
          credentials: body.credentials ?? null,
          bio: body.bio ?? null,
          status: "ACTIVE",
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Doctor insert failed");
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "doctor.create",
          module: "admin",
          entityType: "doctor",
          entityId: row.id,
          detail: { license: row.licenseNumber, email: body.email, invitePending: true },
          ip,
        },
        tx,
      );
      return {
        id: row.id,
        userId: row.userId,
        name: body.name,
        email: body.email,
        status: row.status,
        invitePending: true,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("That email address or licence number is already registered");
    throw error;
  }
};

export const getDoctor = async (actor: Actor, id: string) => {
  requirePermission(actor, "reference:read");
  const [row] = await db
    .select(doctorSelection)
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(specialties, eq(doctors.specialtyId, specialties.id))
    .leftJoin(departments, eq(doctors.departmentId, departments.id))
    .where(eq(doctors.id, id))
    .limit(1);
  if (!row) throw notFound("Doctor not found");

  const panel = await db
    .select({
      id: patients.id,
      name: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      mrn: patients.mrn,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .where(eq(patients.primaryDoctorId, row.id))
    .orderBy(asc(patients.lastName))
    .limit(50);

  return {
    ...row,
    avatarInitials: initials(row.name),
    nextAppointment: null,
    panel: panel.map((p) => ({ ...p, age: ageFromDob(p.dateOfBirth) })),
  };
};

export type UpdateDoctorInput = {
  name?: string | undefined;
  phone?: string | undefined;
  licenseNumber?: string | undefined;
  licenseExpiry?: string | undefined;
  departmentId?: string | undefined;
  specialtyId?: string | undefined;
  consultationFeeMinor?: number | undefined;
  credentials?: string | undefined;
  bio?: string | undefined;
  status?: StaffStatus | undefined;
}

export const updateDoctor = async (actor: Actor, id: string, body: UpdateDoctorInput, ip?: string) => {
  requirePermission(actor, "user:create");
  // Changing employment state is a separate capability from editing a profile.
  if (body.status !== undefined) requirePermission(actor, "user:deactivate");

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: doctors.id, userId: doctors.userId, status: doctors.status })
      .from(doctors)
      .where(eq(doctors.id, id))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Doctor not found");

    const [row] = await tx
      .update(doctors)
      .set({
        ...(body.licenseNumber !== undefined ? { licenseNumber: body.licenseNumber } : {}),
        ...(body.licenseExpiry !== undefined
          ? { licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry) : null }
          : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
        ...(body.specialtyId !== undefined ? { specialtyId: body.specialtyId } : {}),
        ...(body.consultationFeeMinor !== undefined ? { consultationFeeMinor: body.consultationFeeMinor } : {}),
        ...(body.credentials !== undefined ? { credentials: body.credentials } : {}),
        ...(body.bio !== undefined ? { bio: body.bio } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, id))
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Doctor update failed");

    if (body.name !== undefined || body.phone !== undefined || body.status !== undefined) {
      await tx
        .update(users)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          // Deactivating a clinician must also suspend the login.
          ...(body.status === "INACTIVE" ? { status: "DEACTIVATED" as const } : {}),
          ...(body.status === "ACTIVE" && existing.status === "INACTIVE" ? { status: "ACTIVE" as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.userId));
    }

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "doctor.update",
        module: "admin",
        entityType: "doctor",
        entityId: id,
        detail: body,
        ip,
      },
      tx,
    );
    return row;
  });

  return { id: updated.id, status: updated.status };
};

/* -------------------------------------------------------------------------- */
/* Rooms and beds                                                             */
/* -------------------------------------------------------------------------- */

type BedCounts = { total: number; occupied: number; maintenance: number; reserved: number; available: number };

const emptyCounts = (): BedCounts => ({ total: 0, occupied: 0, maintenance: 0, reserved: 0, available: 0 });

const roomStatus = (counts: BedCounts): "Available" | "Occupied" | "Maintenance" | "Reserved" => {
  if (counts.total === 0) return "Available";
  if (counts.maintenance === counts.total) return "Maintenance";
  if (counts.occupied > 0) return "Occupied";
  if (counts.reserved > 0) return "Reserved";
  return "Available";
};

const roomBedCounts = async (roomIds: string[]): Promise<Map<string, BedCounts>> => {
  const result = new Map<string, BedCounts>();
  if (roomIds.length === 0) return result;
  const rows = await db
    .select({ roomId: beds.roomId, status: beds.status, total: count() })
    .from(beds)
    .where(inArray(beds.roomId, roomIds))
    .groupBy(beds.roomId, beds.status);
  for (const row of rows) {
    const current = result.get(row.roomId) ?? emptyCounts();
    const n = Number(row.total);
    current.total += n;
    if (row.status === "OCCUPIED") current.occupied += n;
    else if (row.status === "MAINTENANCE") current.maintenance += n;
    else if (row.status === "RESERVED") current.reserved += n;
    else if (row.status === "AVAILABLE") current.available += n;
    result.set(row.roomId, current);
  }
  return result;
};

const roomOccupants = async (roomIds: string[]) => {
  const map = new Map<string, Array<{ patientId: string; name: string; mrn: string; bedId: string; label: string }>>();
  if (roomIds.length === 0) return map;
  const rows = await db
    .select({
      roomId: beds.roomId,
      bedId: beds.id,
      label: beds.label,
      patientId: patients.id,
      name: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      mrn: patients.mrn,
    })
    .from(bedAssignments)
    .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
    .innerJoin(patients, eq(bedAssignments.patientId, patients.id))
    .where(and(inArray(beds.roomId, roomIds), sql`${bedAssignments.releasedAt} is null`));
  for (const row of rows) {
    const list = map.get(row.roomId) ?? [];
    list.push({ patientId: row.patientId, name: row.name, mrn: row.mrn, bedId: row.bedId, label: row.label });
    map.set(row.roomId, list);
  }
  return map;
};

export interface RoomListFilters {
  floor?: string | undefined;
  type?: RoomType | undefined;
  departmentId?: string | undefined;
}

export const listRooms = async (actor: Actor, query: ListQuery, filters: RoomListFilters) => {
  requirePermission(actor, "bed:read");
  const conditions = [];
  if (query.search) conditions.push(ilike(rooms.number, `%${query.search}%`));
  if (filters.floor) conditions.push(eq(rooms.floor, filters.floor));
  if (filters.type) conditions.push(eq(rooms.type, filters.type));
  if (filters.departmentId) conditions.push(eq(rooms.departmentId, filters.departmentId));
  const where = conditions.length ? and(...conditions) : undefined;
  const orderColumn = { createdAt: rooms.createdAt, number: rooms.number, floor: rooms.floor }[query.sort] ?? rooms.number;

  const [rows, [totals], summaryRows] = await Promise.all([
    db
      .select({
        id: rooms.id,
        number: rooms.number,
        floor: rooms.floor,
        type: rooms.type,
        departmentId: rooms.departmentId,
        department: departments.name,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .leftJoin(departments, eq(rooms.departmentId, departments.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: count() }).from(rooms).where(where),
    db
      .select({ status: beds.status, total: count() })
      .from(beds)
      .innerJoin(rooms, eq(beds.roomId, rooms.id))
      .where(where)
      .groupBy(beds.status),
  ]);

  const roomIds = rows.map((r) => r.id);
  const [counts, occupants] = await Promise.all([roomBedCounts(roomIds), roomOccupants(roomIds)]);
  const summary = emptyCounts();
  for (const row of summaryRows) {
    const n = Number(row.total);
    summary.total += n;
    if (row.status === "OCCUPIED") summary.occupied += n;
    else if (row.status === "MAINTENANCE") summary.maintenance += n;
    else if (row.status === "RESERVED") summary.reserved += n;
    else if (row.status === "AVAILABLE") summary.available += n;
  }

  const data = rows.map((room) => {
    const roomCounts = counts.get(room.id) ?? emptyCounts();
    const roomPatients = occupants.get(room.id) ?? [];
    return {
      ...room,
      beds: roomCounts.total,
      occupied: roomCounts.occupied,
      available: roomCounts.available,
      status: roomStatus(roomCounts),
      patients: roomPatients,
      patient: roomPatients.map((p) => p.name).join(", ") || null,
    };
  });

  return {
    rows: data,
    total: totals?.value ?? 0,
    summary: {
      totalBeds: summary.total,
      occupiedBeds: summary.occupied,
      availableBeds: summary.available,
      maintenanceBeds: summary.maintenance,
      reservedBeds: summary.reserved,
      occupancyRate: summary.total > 0 ? Math.round((summary.occupied / summary.total) * 100) : 0,
    },
  };
};

export interface CreateRoomInput {
  number: string;
  floor: string;
  type: RoomType;
  departmentId?: string | undefined;
  bedCount: number;
  bedLabels?: string[] | undefined;
}

export const createRoom = async (actor: Actor, body: CreateRoomInput, ip?: string) => {
  requirePermission(actor, "reference:write");
  if (body.departmentId) {
    const [department] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, body.departmentId))
      .limit(1);
    if (!department) throw notFound("Department not found");
  }
  const labels = body.bedLabels ?? Array.from({ length: body.bedCount }, (_, i) => String.fromCharCode(65 + i));

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(rooms)
        .values({
          number: body.number,
          floor: body.floor,
          type: body.type,
          departmentId: body.departmentId ?? null,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Room insert failed");
      if (labels.length > 0) {
        await tx.insert(beds).values(labels.map((label) => ({ roomId: row.id, label })));
      }
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "room.create",
          module: "admin",
          entityType: "room",
          entityId: row.id,
          detail: { number: row.number, beds: labels.length },
          ip,
        },
        tx,
      );
      return { id: row.id, number: row.number, beds: labels.length };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("That room number already exists");
    throw error;
  }
};

export const getRoom = async (actor: Actor, id: string) => {
  requirePermission(actor, "bed:read");
  const [room] = await db
    .select({
      id: rooms.id,
      number: rooms.number,
      floor: rooms.floor,
      type: rooms.type,
      departmentId: rooms.departmentId,
      department: departments.name,
    })
    .from(rooms)
    .leftJoin(departments, eq(rooms.departmentId, departments.id))
    .where(eq(rooms.id, id))
    .limit(1);
  if (!room) throw notFound("Room not found");

  const roomBeds = await db
    .select({
      id: beds.id,
      label: beds.label,
      status: beds.status,
      patientId: patients.id,
      patientName: sql<string | null>`${patients.firstName} || ' ' || ${patients.lastName}`,
      mrn: patients.mrn,
      assignedAt: bedAssignments.assignedAt,
    })
    .from(beds)
    .leftJoin(bedAssignments, and(eq(bedAssignments.bedId, beds.id), sql`${bedAssignments.releasedAt} is null`))
    .leftJoin(patients, eq(bedAssignments.patientId, patients.id))
    .where(eq(beds.roomId, id))
    .orderBy(asc(beds.label));

  const counts = roomBeds.reduce((acc, bed) => {
    acc.total += 1;
    if (bed.status === "OCCUPIED") acc.occupied += 1;
    else if (bed.status === "MAINTENANCE") acc.maintenance += 1;
    else if (bed.status === "RESERVED") acc.reserved += 1;
    else if (bed.status === "AVAILABLE") acc.available += 1;
    return acc;
  }, emptyCounts());

  return {
    ...room,
    beds: roomBeds,
    bedCount: counts.total,
    occupied: counts.occupied,
    available: counts.available,
    status: roomStatus(counts),
    // Same shape as the list endpoint, so the room card renders identically.
    patients: roomBeds
      .filter((bed) => bed.patientId)
      .map((bed) => ({ patientId: bed.patientId, name: bed.patientName, mrn: bed.mrn, bedId: bed.id, label: bed.label })),
  };
};

export type UpdateRoomInput = {
  number?: string | undefined;
  floor?: string | undefined;
  type?: RoomType | undefined;
  departmentId?: string | undefined;
}

export const updateRoom = async (actor: Actor, id: string, body: UpdateRoomInput, ip?: string) => {
  requirePermission(actor, "reference:write");
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(rooms)
        .set({
          ...(body.number !== undefined ? { number: body.number } : {}),
          ...(body.floor !== undefined ? { floor: body.floor } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, id))
        .returning();
      if (!row) throw notFound("Room not found");
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "room.update",
          module: "admin",
          entityType: "room",
          entityId: id,
          detail: body,
          ip,
        },
        tx,
      );
      return { id: row.id, number: row.number, type: row.type };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("That room number already exists");
    throw error;
  }
};

export const addBed = async (actor: Actor, roomId: string, label: string, ip?: string) => {
  requirePermission(actor, "bed:configure");
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) throw notFound("Room not found");

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(beds).values({ roomId, label }).returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Bed insert failed");
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "bed.create",
          module: "admin",
          entityType: "bed",
          entityId: row.id,
          detail: { roomId, label },
          ip,
        },
        tx,
      );
      return { id: row.id, label: row.label, status: row.status };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("That bed label already exists in this room");
    throw error;
  }
};

export interface BedListFilters {
  roomId?: string | undefined;
  floor?: string | undefined;
  status?: BedStatus | undefined;
}

export const listBeds = async (actor: Actor, query: ListQuery, filters: BedListFilters) => {
  requirePermission(actor, "bed:read");
  const conditions = [];
  if (filters.roomId) conditions.push(eq(beds.roomId, filters.roomId));
  if (filters.floor) conditions.push(eq(rooms.floor, filters.floor));
  if (filters.status) conditions.push(eq(beds.status, filters.status));
  if (query.search) conditions.push(ilike(beds.label, `%${query.search}%`));
  const where = conditions.length ? and(...conditions) : undefined;
  const orderColumn = { createdAt: beds.createdAt, label: beds.label }[query.sort] ?? beds.label;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: beds.id,
        label: beds.label,
        status: beds.status,
        roomId: beds.roomId,
        roomNumber: rooms.number,
        floor: rooms.floor,
        roomType: rooms.type,
        patientId: patients.id,
        patientName: sql<string | null>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        assignedAt: bedAssignments.assignedAt,
      })
      .from(beds)
      .innerJoin(rooms, eq(beds.roomId, rooms.id))
      .leftJoin(bedAssignments, and(eq(bedAssignments.bedId, beds.id), sql`${bedAssignments.releasedAt} is null`))
      .leftJoin(patients, eq(bedAssignments.patientId, patients.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: count() }).from(beds).innerJoin(rooms, eq(beds.roomId, rooms.id)).where(where),
  ]);
  return { rows, total: totals?.value ?? 0 };
};

/**
 * Bed status is a consequence of the assignment history for OCCUPIED, so that
 * value can only be reached through `/beds/:id/assign`.
 */
export const setBedStatus = async (actor: Actor, id: string, status: BedStatus, ip?: string) => {
  requirePermission(actor, "bed:configure");
  if (status === "OCCUPIED") {
    throw new AppError("PRECONDITION_FAILED", "Use POST /beds/:id/assign to occupy a bed");
  }

  const updated = await db.transaction(async (tx) => {
    const [bed] = await tx.select().from(beds).where(eq(beds.id, id)).limit(1).for("update");
    if (!bed) throw notFound("Bed not found");

    const [openAssignment] = await tx
      .select({ id: bedAssignments.id })
      .from(bedAssignments)
      .where(and(eq(bedAssignments.bedId, id), sql`${bedAssignments.releasedAt} is null`))
      .limit(1);
    if (openAssignment) {
      throw new AppError("INVALID_TRANSITION", "Release the current occupant before changing this bed's status");
    }

    const [row] = await tx.update(beds).set({ status, updatedAt: new Date() }).where(eq(beds.id, id)).returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Bed update failed");
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "bed.status",
        module: "admin",
        entityType: "bed",
        entityId: id,
        detail: { from: bed.status, to: status },
        ip,
      },
      tx,
    );
    return row;
  });
  return { id: updated.id, status: updated.status };
};

/**
 * Assigns a patient to a bed. The bed row is locked FOR UPDATE inside the
 * transaction, so two simultaneous assignments cannot both succeed.
 */
export const assignBed = async (
  actor: Actor,
  id: string,
  body: { patientId: string; admissionId?: string | undefined },
  ip?: string,
) => {
  requirePermission(actor, "bed:assign");

  return db.transaction(async (tx) => {
    const [bed] = await tx.select().from(beds).where(eq(beds.id, id)).limit(1).for("update");
    if (!bed) throw notFound("Bed not found");
    if (bed.status !== "AVAILABLE") {
      throw new AppError("PRECONDITION_FAILED", `Bed is not available (status ${bed.status})`);
    }

    const [patient] = await tx
      .select({ id: patients.id, status: patients.status })
      .from(patients)
      .where(eq(patients.id, body.patientId))
      .limit(1);
    if (!patient) throw notFound("Patient not found");
    if (patient.status !== "ACTIVE") throw new AppError("PRECONDITION_FAILED", "Patient record is not active");

    const [row] = await tx
      .insert(bedAssignments)
      .values({
        bedId: id,
        patientId: body.patientId,
        admissionId: body.admissionId ?? null,
        assignedBy: actor.id,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Bed assignment failed");

    await tx.update(beds).set({ status: "OCCUPIED", updatedAt: new Date() }).where(eq(beds.id, id));
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "bed.assign",
        module: "admin",
        entityType: "bed",
        entityId: id,
        detail: { patientId: body.patientId },
        ip,
      },
      tx,
    );
    return { id: row.id, bedId: row.bedId, patientId: row.patientId, assignedAt: row.assignedAt };
  });
};

export const releaseBed = async (actor: Actor, id: string, reason?: string, ip?: string) => {
  requirePermission(actor, "bed:assign");

  const released = await db.transaction(async (tx) => {
    const [bed] = await tx.select().from(beds).where(eq(beds.id, id)).limit(1).for("update");
    if (!bed) throw notFound("Bed not found");

    const [assignment] = await tx
      .select({ id: bedAssignments.id, patientId: bedAssignments.patientId })
      .from(bedAssignments)
      .where(and(eq(bedAssignments.bedId, id), sql`${bedAssignments.releasedAt} is null`))
      .limit(1)
      .for("update");
    if (!assignment) throw notFound("No active occupant for this bed");

    const now = new Date();
    await tx.update(bedAssignments).set({ releasedAt: now }).where(eq(bedAssignments.id, assignment.id));
    // Released beds go through housekeeping before they are assignable again.
    await tx.update(beds).set({ status: "CLEANING", updatedAt: now }).where(eq(beds.id, id));
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "bed.release",
        module: "admin",
        entityType: "bed",
        entityId: id,
        detail: { patientId: assignment.patientId, reason: reason ?? null },
        ip,
      },
      tx,
    );
    return { assignmentId: assignment.id, releasedAt: now };
  });

  return { bedId: id, status: "CLEANING", ...released };
};
