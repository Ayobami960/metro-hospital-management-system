import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  analytes,
  analyteRanges,
  doctors,
  equipment,
  equipmentMaintenance,
  labTests,
  patients,
  radiologyOrders,
  radiologyReports,
  users,
} from "../db/schema/index.js";
import { AppError, notFound } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import type { Actor } from "../lib/authorize.js";
import { ageFromDob, daysBetween } from "../lib/time.js";

/**
 * Diagnostics support: the test catalogue that drives order entry and result
 * templates, the radiology worklist, and the analyser/equipment log.
 */

const patientName = sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`;

export const testCatalogue = async (search?: string) =>
  db
    .select({
      id: labTests.id,
      code: labTests.code,
      name: labTests.name,
      department: labTests.department,
      specimenType: labTests.specimenType,
      turnaroundHours: labTests.turnaroundHours,
      isPanel: labTests.isPanel,
      priceMinor: labTests.priceMinor,
      analytes: sql<Array<{ id: string; name: string; unit: string | null; sortOrder: number }>>`coalesce((
        select json_agg(json_build_object('id', a.id, 'name', a.name, 'unit', a.unit, 'sortOrder', a.sort_order) order by a.sort_order)
        from hms.analyte a where a.test_id = ${labTests.id}
      ), '[]'::json)`,
    })
    .from(labTests)
    .where(search ? sql<boolean>`(${labTests.name} ilike ${`%${search}%`} or ${labTests.code} ilike ${`%${search}%`})` : undefined)
    .orderBy(asc(labTests.name))
    .limit(200);

export const analyteBands = async (testId: string) => {
  const rows = await db
    .select({
      analyteId: analytes.id,
      analyte: analytes.name,
      unit: analytes.unit,
      sex: analyteRanges.sex,
      ageMinYears: analyteRanges.ageMinYears,
      ageMaxYears: analyteRanges.ageMaxYears,
      low: analyteRanges.low,
      high: analyteRanges.high,
      criticalLow: analyteRanges.criticalLow,
      criticalHigh: analyteRanges.criticalHigh,
    })
    .from(analytes)
    .leftJoin(analyteRanges, eq(analyteRanges.analyteId, analytes.id))
    .where(eq(analytes.testId, testId))
    .orderBy(asc(analytes.sortOrder));
  return rows;
};

/* -------------------------------------------------------------------------- */
/* Radiology                                                                  */
/* -------------------------------------------------------------------------- */

export const listRadiologyOrders = async (query: {
  page: number;
  pageSize: number;
  status?: string | undefined;
  search?: string | undefined;
}) => {
  const filters = [];
  if (query.status) filters.push(eq(radiologyOrders.status, query.status as "ORDERED"));
  if (query.search) {
    filters.push(sql<boolean>`(${patientName} ilike ${`%${query.search}%`} or ${radiologyOrders.studyType} ilike ${`%${query.search}%`})`);
  }
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: radiologyOrders.id,
        patientId: radiologyOrders.patientId,
        patientName,
        mrn: patients.mrn,
        dateOfBirth: patients.dateOfBirth,
        studyType: radiologyOrders.studyType,
        bodyPart: radiologyOrders.bodyPart,
        priority: radiologyOrders.priority,
        status: radiologyOrders.status,
        scheduledAt: radiologyOrders.scheduledAt,
        performedAt: radiologyOrders.performedAt,
        orderedAt: radiologyOrders.createdAt,
        orderingDoctor: users.name,
        reportId: radiologyReports.id,
        reportSignedAt: radiologyReports.signedAt,
        impression: radiologyReports.impression,
      })
      .from(radiologyOrders)
      .innerJoin(patients, eq(radiologyOrders.patientId, patients.id))
      .leftJoin(doctors, eq(radiologyOrders.orderingDoctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .leftJoin(radiologyReports, eq(radiologyReports.orderId, radiologyOrders.id))
      .where(where)
      .orderBy(desc(radiologyOrders.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(radiologyOrders).innerJoin(patients, eq(radiologyOrders.patientId, patients.id)).where(where),
  ]);

  return {
    rows: rows.map((row) => ({ ...row, age: ageFromDob(row.dateOfBirth) })),
    total: Number(totals?.value ?? 0),
  };
};

export const createRadiologyOrder = async (
  actor: Actor,
  input: {
    patientId: string;
    studyType: string;
    bodyPart: string;
    priority?: "ROUTINE" | "URGENT" | "STAT" | undefined;
    scheduledAt?: string | undefined;
    notes?: string | undefined;
  },
) => {
  const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, input.patientId)).limit(1);
  if (!patient) throw notFound("Patient not found");

  const [row] = await db
    .insert(radiologyOrders)
    .values({
      patientId: input.patientId,
      orderingDoctorId: actor.doctorId,
      studyType: input.studyType,
      bodyPart: input.bodyPart,
      priority: input.priority ?? "ROUTINE",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      notes: input.notes ?? null,
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "radiology.order",
    module: "laboratory",
    entityType: "radiology_order",
    entityId: row?.id ?? null,
    detail: { patientId: input.patientId, studyType: input.studyType },
  });
  return row;
};

export const updateRadiologyStatus = async (
  actor: Actor,
  id: string,
  status: "SCHEDULED" | "IN_PROGRESS" | "PENDING_READ" | "COMPLETED" | "CANCELLED",
) => {
  const [existing] = await db.select({ id: radiologyOrders.id, status: radiologyOrders.status }).from(radiologyOrders).where(eq(radiologyOrders.id, id)).limit(1);
  if (!existing) throw notFound("Radiology order not found");
  const [row] = await db
    .update(radiologyOrders)
    .set({
      status,
      performedAt: status === "COMPLETED" || status === "PENDING_READ" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(radiologyOrders.id, id))
    .returning();
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "radiology.status",
    module: "laboratory",
    entityType: "radiology_order",
    entityId: id,
    detail: { from: existing.status, to: status },
  });
  return { id: row?.id, status: row?.status };
};

export const signRadiologyReport = async (
  actor: Actor,
  orderId: string,
  input: { body: string; impression?: string | undefined },
) => {
  const [order] = await db.select({ id: radiologyOrders.id, patientId: radiologyOrders.patientId }).from(radiologyOrders).where(eq(radiologyOrders.id, orderId)).limit(1);
  if (!order) throw notFound("Radiology order not found");

  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: radiologyReports.version })
      .from(radiologyReports)
      .where(eq(radiologyReports.orderId, orderId))
      .orderBy(desc(radiologyReports.version))
      .limit(1);

    const [report] = await tx
      .insert(radiologyReports)
      .values({
        orderId,
        body: input.body,
        impression: input.impression ?? null,
        signedBy: actor.id,
        signedAt: new Date(),
        version: (latest?.version ?? 0) + 1,
        images: [],
      })
      .returning();
    if (!report) throw new AppError("INTERNAL_ERROR", "Radiology report insert failed");

    await tx
      .update(radiologyOrders)
      .set({ status: "COMPLETED", performedAt: new Date(), updatedAt: new Date() })
      .where(eq(radiologyOrders.id, orderId));

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "radiology.report",
        module: "laboratory",
        entityType: "radiology_report",
        entityId: report.id,
        detail: { orderId, version: report.version },
      },
      tx,
    );
    return report;
  });
};

/* -------------------------------------------------------------------------- */
/* Equipment                                                                  */
/* -------------------------------------------------------------------------- */

export const listEquipment = async () => {
  const rows = await db
    .select({
      id: equipment.id,
      name: equipment.name,
      model: equipment.model,
      serial: equipment.serial,
      location: equipment.location,
      lastCalibrationAt: equipment.lastCalibrationAt,
      nextDueAt: equipment.nextDueAt,
      maintenanceIntervalDays: equipment.maintenanceIntervalDays,
      outOfService: equipment.outOfService,
      outOfServiceReason: equipment.outOfServiceReason,
      statusOverride: equipment.statusOverride,
      maintenanceCount: sql<number>`(
        select count(*)::int from hms.equipment_maintenance em where em.equipment_id = ${equipment.id}
      )`,
      lastMaintenanceAt: sql<Date | null>`(
        select max(em.performed_at) from hms.equipment_maintenance em where em.equipment_id = ${equipment.id}
      )`,
    })
    .from(equipment)
    .orderBy(asc(equipment.name));

  return rows.map((row) => {
    const daysUntilDue = row.nextDueAt ? daysBetween(new Date(), row.nextDueAt) : null;
    const overdue = row.nextDueAt ? row.nextDueAt.getTime() < Date.now() : false;
    return {
      ...row,
      daysUntilDue,
      status:
        row.statusOverride ??
        (row.outOfService ? "OUT_OF_SERVICE" : overdue ? "MAINTENANCE_DUE" : "OPERATIONAL"),
    };
  });
};

export const listMaintenance = async (equipmentId?: string) =>
  db
    .select({
      id: equipmentMaintenance.id,
      equipmentId: equipmentMaintenance.equipmentId,
      equipmentName: equipment.name,
      type: equipmentMaintenance.type,
      technician: equipmentMaintenance.technician,
      performedAt: equipmentMaintenance.performedAt,
      notes: equipmentMaintenance.notes,
      result: equipmentMaintenance.result,
      nextDueAt: equipmentMaintenance.nextDueAt,
    })
    .from(equipmentMaintenance)
    .innerJoin(equipment, eq(equipmentMaintenance.equipmentId, equipment.id))
    .where(equipmentId ? eq(equipmentMaintenance.equipmentId, equipmentId) : undefined)
    .orderBy(desc(equipmentMaintenance.performedAt))
    .limit(200);

export const logMaintenance = async (
  actor: Actor,
  equipmentId: string,
  input: {
    type: string;
    technician?: string | undefined;
    notes?: string | undefined;
    result?: string | undefined;
    nextDueAt?: string | undefined;
  },
) => {
  const [row] = await db.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, equipmentId)).limit(1);
  if (!row) throw notFound("Equipment not found");

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(equipmentMaintenance)
      .values({
        equipmentId,
        type: input.type,
        technician: input.technician ?? null,
        notes: input.notes ?? null,
        result: input.result ?? null,
        nextDueAt: input.nextDueAt ? new Date(input.nextDueAt) : null,
      })
      .returning();

    await tx
      .update(equipment)
      .set({
        lastCalibrationAt: input.type.toUpperCase().includes("CALIBRATION") ? new Date() : undefined,
        nextDueAt: input.nextDueAt ? new Date(input.nextDueAt) : undefined,
        outOfService: input.result === "OUT_OF_SERVICE",
        updatedAt: new Date(),
      })
      .where(eq(equipment.id, equipmentId));

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "equipment.maintenance",
        module: "laboratory",
        entityType: "equipment",
        entityId: equipmentId,
        detail: { type: input.type, result: input.result ?? null },
      },
      tx,
    );
    return entry;
  });
};

export const setEquipmentServiceState = async (actor: Actor, equipmentId: string, outOfService: boolean, reason?: string) => {
  const [row] = await db
    .update(equipment)
    .set({ outOfService, outOfServiceReason: reason ?? null, updatedAt: new Date() })
    .where(eq(equipment.id, equipmentId))
    .returning({ id: equipment.id, outOfService: equipment.outOfService });
  if (!row) throw notFound("Equipment not found");
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "equipment.status",
    module: "laboratory",
    entityType: "equipment",
    entityId: equipmentId,
    detail: { outOfService, reason: reason ?? null },
  });
  return row;
};
