import { and, asc, desc, eq, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  labOrders,
  labOrderItems,
  labResults,
  labResultVersions,
  specimens,
  specimenCustody,
  criticalValueNotifications,
} from "../db/schema/laboratory.js";
import { patients } from "../db/schema/index.js";
import { requirePermission, type Actor } from "../lib/authorize.js";
import { notFound, type ListQuery, AppError } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

export type LabFlag = "NORMAL" | "HIGH" | "LOW" | "CRITICAL_HIGH" | "CRITICAL_LOW";
export type LabSex = "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN" | null;

const LAB_FLAGS = [
  "NORMAL",
  "HIGH",
  "LOW",
  "CRITICAL_HIGH",
  "CRITICAL_LOW",
] as const;

const isLabFlag = (value: unknown): value is LabFlag =>
  typeof value === "string" && LAB_FLAGS.includes(value as LabFlag);

const getLabFlag = (value: unknown, fallback: LabFlag = "NORMAL"): LabFlag => {
  if (value === undefined || value === null || value === "") return fallback;
  if (!isLabFlag(value)) {
    throw new AppError("VALIDATION_ERROR", `Invalid laboratory flag: ${String(value)}`);
  }
  return value;
};

// The laboratory schema stores numeric result values as text-backed numeric strings.
const toNumericString = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new AppError("VALIDATION_ERROR", "Invalid numeric result value");
  }
  return String(numericValue);
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

export type LaboratoryOrderFilters = {
  status?: string | undefined;
  priority?: string | undefined;
  patientId?: string | undefined;
};

export type SpecimenFilters = {
  status?: (typeof specimens.$inferSelect)["status"] | undefined;
};

export type ResultFilters = {
  patientId?: string | undefined;
  critical?: boolean | undefined;
  flag?: string | undefined;
  releasedOnly?: boolean | undefined;
};

export type LaboratoryDashboard = {
  panels: Array<Record<string, unknown>>;
  trends: Record<string, Array<{ at: Date; value: number }>>;
};

// ---------- orders ----------

export const listLaboratoryOrders = async (
  actor: Actor,
  query: ListQuery,
  filters: LaboratoryOrderFilters,
) => {
  requirePermission(actor, "lab:result:read");

  const where = (() => {
    const parts = [];
    if (filters.status) parts.push(eq(labOrders.status, filters.status as "PENDING" | "IN_PROGRESS" | "COLLECTED" | "RESULTED" | "RELEASED" | "CANCELLED"));
    if (filters.priority) parts.push(eq(labOrders.priority, filters.priority as "ROUTINE" | "URGENT" | "STAT"));
    if (filters.patientId) parts.push(eq(labOrders.patientId, filters.patientId));
    if (actor.role === "DOCTOR" && actor.doctorId)
      parts.push(eq(labOrders.orderingDoctorId, actor.doctorId));
    if (query.search) {
      parts.push(
        sql<boolean>`(${patients.firstName} ilike ${`%${query.search}%`} or ${patients.lastName} ilike ${`%${query.search}%`} or ${patients.mrn} ilike ${`%${query.search}%`})`,
      );
    }
    return parts.length ? and(...parts) : undefined;
  })();

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: labOrders.id,
        patientId: labOrders.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        priority: labOrders.priority,
        status: labOrders.status,
        orderedAt: labOrders.orderedAt,
        specimens: sql<string>`coalesce((select array_agg(s.barcode order by s.collected_at) from hms.lab_specimen s where s.lab_order_id = ${labOrders.id}), '{}')`,
        itemCount: sql<number>`(select count(*)::int from hms.lab_order_item i where i.lab_order_id = ${labOrders.id})`,
      })
      .from(labOrders)
      .innerJoin(patients, eq(labOrders.patientId, patients.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(labOrders.orderedAt) : desc(labOrders.orderedAt))
      .limit(query.pageSize)
      .offset(query.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(labOrders)
      .innerJoin(patients, eq(labOrders.patientId, patients.id))
      .where(where),
  ]);

  return { rows: rows as any, total: Number(totals?.value ?? 0), page: query.page, pageSize: query.pageSize };
};

export const getLaboratoryOrder = async (actor: Actor, id: string) => {
  requirePermission(actor, "lab:result:read");
  const [order] = await db.select().from(labOrders).where(eq(labOrders.id, id)).limit(1);
  if (!order) throw notFound("Order not found");
  return order;
};

export const createLaboratoryOrder = async (
  actor: Actor,
  body: Record<string, unknown>,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:order");
  const patientId = String(body.patientId ?? "");
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!patient) throw notFound("Patient not found");

  const testIds = (body.testIds as string[]) ?? [];
  if (testIds.length === 0) throw new AppError("VALIDATION_ERROR", "At least one test is required");

  const now = new Date();
  const [order] = await db
    .insert(labOrders)
    .values({
      patientId,
      orderingDoctorId: actor.doctorId ?? null,
      priority: (body.priority as "ROUTINE" | "URGENT" | "STAT") ?? "ROUTINE",
      status: "PENDING",
      clinicalNotes: body.clinicalNotes as string | undefined,
      encounterId: body.encounterId as string | undefined,
      orderedAt: now,
    })
    .returning();

  if (!order) {
    throw new AppError("INTERNAL_ERROR", "Failed to create laboratory order");
  }

  const items = testIds.map((testId) => ({
    labOrderId: order.id,
    testId,
    status: "PENDING" as const,
    priceMinor: 0,
  }));
  await db.insert(labOrderItems).values(items).returning();

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.order.create",
      module: "laboratory",
      entityType: "lab_order",
      entityId: order.id,
      detail: { patientId, testCount: items.length },
      ip,
    },
    db,
  );

  return { ...order, itemsCount: items.length };
};

export const cancelLaboratoryOrder = async (
  actor: Actor,
  id: string,
  reason: string,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:order");
  const [order] = await db
    .select()
    .from(labOrders)
    .where(eq(labOrders.id, id))
    .limit(1);
  if (!order) throw notFound("Order not found");
  if (order.status === "CANCELLED") throw new AppError("INVALID_TRANSITION", "Order is already cancelled");
  if (order.status === "RELEASED") throw new AppError("INVALID_TRANSITION", "Cannot cancel a released order");

  const [updated] = await db
    .update(labOrders)
    .set({ status: "CANCELLED" as const, cancelledReason: reason ?? null, updatedAt: new Date() })
    .where(eq(labOrders.id, id))
    .returning();

  if (!updated) throw new AppError("INTERNAL_ERROR", "Failed to cancel laboratory order");

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.order.cancel",
      module: "laboratory",
      entityType: "lab_order",
      entityId: id,
      detail: { reason },
      ip,
    },
    db,
  );

  return updated;
};

export const assignOrderTechnician = async (
  actor: Actor,
  id: string,
  technicianId: string,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:result:read");
  const [order] = await db
    .select()
    .from(labOrders)
    .where(eq(labOrders.id, id))
    .limit(1);
  if (!order) throw notFound("Order not found");

  const [updated] = await db
    .update(labOrders)
    .set({ updatedAt: new Date() })
    .where(eq(labOrders.id, id))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Failed to update order");

  await db
    .update(labOrderItems)
    .set({ assignedTechnicianId: technicianId, updatedAt: new Date() })
    .where(eq(labOrderItems.labOrderId, id));

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.order.assign",
      module: "laboratory",
      entityType: "lab_order",
      entityId: id,
      detail: { technicianId },
      ip,
    },
    db,
  );

  return { ...updated, technicianId } as const;
};

// ---------- specimens ----------

export const collectSpecimen = async (
  actor: Actor,
  id: string,
  body: Record<string, unknown>,
  ip: string | undefined,
) => {
  requirePermission(actor, "specimen:update");
  const [order] = await db
    .select()
    .from(labOrders)
    .where(eq(labOrders.id, id))
    .limit(1);
  if (!order) throw notFound("Order not found");

  const now = new Date();
  const barcode = (body.barcode as string) ?? `SPEC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const [specimen] = await db
    .insert(specimens)
    .values({
      labOrderId: id,
      patientId: order.patientId,
      specimenType: (body.specimenType as string) ?? "Blood",
      barcode,
      collectedAt: body.collectedAt ? new Date(body.collectedAt as string) : now,
      collectedBy: actor.id,
      status: "COLLECTED" as const,
      location: body.location as string | undefined,
    })
    .returning();
  if (!specimen) throw new AppError("INTERNAL_ERROR", "Failed to create specimen");

  await db
    .insert(specimenCustody)
    .values({
      specimenId: specimen.id,
      status: "COLLECTED" as const,
      location: body.location as string | undefined,
      actorId: actor.id,
      notes: `Specimen collected by ${actor.name}`,
    })
    .returning();

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "specimen.collect",
      module: "laboratory",
      entityType: "specimen",
      entityId: specimen.id,
      detail: { barcode, orderId: id },
      ip,
    },
    db,
  );

  return specimen;
};

export const listSpecimens = async (
  actor: Actor,
  query: ListQuery,
  filters: SpecimenFilters,
) => {
  requirePermission(actor, "specimen:read");
  const where = (() => {
    const parts = [];
    if (filters.status) parts.push(eq(specimens.status, filters.status));
    if (query.search) {
      parts.push(
        sql<boolean>`(${specimens.barcode} ilike ${`%${query.search}%`} or ${patients.lastName} ilike ${`%${query.search}%`} or ${patients.mrn} ilike ${`%${query.search}%`})`,
      );
    }
    return parts.length ? and(...parts) : undefined;
  })();
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(specimens)
      .where(where)
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: sql<number>`count(*)::int` }).from(specimens).where(where),
  ]);
  return { rows: rows as any, total: Number(totals?.value ?? 0), page: query.page, pageSize: query.pageSize };
};

export const lookupSpecimen = async (actor: Actor, barcode: string) => {
  requirePermission(actor, "specimen:read");
  const [specimen] = await db
    .select()
    .from(specimens)
    .where(eq(specimens.barcode, barcode))
    .limit(1);
  if (!specimen) return null;
  return specimen;
};

export const updateSpecimenStatus = async (
  actor: Actor,
  id: string,
  body: Record<string, unknown>,
  ip: string | undefined,
) => {
  requirePermission(actor, "specimen:update");
  const [specimen] = await db
    .select()
    .from(specimens)
    .where(eq(specimens.id, id))
    .limit(1);
  if (!specimen) throw notFound("Specimen not found");

  const newStatus = (body.status as string) ?? specimen.status;
  const validStatuses = ["COLLECTED", "IN_TRANSIT", "RECEIVED", "PROCESSING", "ARCHIVED"];
  if (!validStatuses.includes(newStatus)) {
    throw new AppError("VALIDATION_ERROR", `Invalid status: ${newStatus}`, { allowed: validStatuses });
  }

  const [updated] = await db
    .update(specimens)
    .set({
      status: newStatus as "COLLECTED" | "IN_TRANSIT" | "RECEIVED" | "PROCESSING" | "ARCHIVED",
      location: (body.location as string) ?? specimen.location,
      updatedAt: new Date(),
    })
    .where(eq(specimens.id, id))
    .returning();
  if (!updated) throw new AppError("INTERNAL_ERROR", "Failed to update specimen");

  await db
    .insert(specimenCustody)
    .values({
      specimenId: id,
      status: newStatus as "COLLECTED" | "IN_TRANSIT" | "RECEIVED" | "PROCESSING" | "ARCHIVED",
      location: (body.location as string) ?? specimen.location,
      actorId: actor.id,
      notes: body.notes as string | undefined,
    })
    .returning();

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "specimen.status",
      module: "laboratory",
      entityType: "specimen",
      entityId: id,
      detail: { from: specimen.status, to: newStatus },
      ip,
    },
    db,
  );

  return { specimen: updated, event: { from: specimen.status, to: newStatus, at: new Date() } };
};

export const specimenCustodyLog = async (actor: Actor, id: string, query: ListQuery) => {
  requirePermission(actor, "specimen:read");
  const [specimen] = await db
    .select()
    .from(specimens)
    .where(eq(specimens.id, id))
    .limit(1);
  if (!specimen) throw notFound("Specimen not found");

  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(specimenCustody)
      .where(eq(specimenCustody.specimenId, id))
      .orderBy(desc(specimenCustody.createdAt))
      .limit(query.pageSize)
      .offset(query.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(specimenCustody)
      .where(eq(specimenCustody.specimenId, id)),
  ]);
  return { rows: rows as any, total: Number(totals?.value ?? 0), page: query.page, pageSize: query.pageSize };
};

// ---------- results ----------

export const enterResults = async (
  actor: Actor,
  id: string,
  body: Record<string, unknown>,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:result:enter");

  const [order] = await db
    .select()
    .from(labOrders)
    .where(eq(labOrders.id, id))
    .limit(1);

  if (!order) throw notFound("Order not found");
  if (order.status === "CANCELLED") {
    throw new AppError("INVALID_TRANSITION", "Cannot result a cancelled order");
  }

  const itemId = String(body.itemId ?? "").trim();
  if (!itemId) throw new AppError("VALIDATION_ERROR", "Order item ID is required");

  const [item] = await db
    .select()
    .from(labOrderItems)
    .where(and(eq(labOrderItems.id, itemId), eq(labOrderItems.labOrderId, id)))
    .limit(1);

  if (!item) throw notFound("Order item not found");

  type ResultInput = {
    analyteId: string;
    valueNumeric?: number | string | null;
    valueText?: string | null;
    unit?: string | null;
  };

  const values = Array.isArray(body.values) ? (body.values as ResultInput[]) : [];
  if (values.length === 0) {
    throw new AppError("VALIDATION_ERROR", "At least one result value is required");
  }

  const now = new Date();
  const flag = getLabFlag(body.flag);
  const critical = body.critical === true;
  const inserted: Array<typeof labResults.$inferSelect> = [];

  for (const value of values) {
    const analyteId = optionalString(value.analyteId);
    if (!analyteId) {
      throw new AppError("VALIDATION_ERROR", "Analyte ID is required");
    }

    const valueNumeric = toNumericString(value.valueNumeric);
    const valueText =
      typeof value.valueText === "string" && value.valueText.trim() !== ""
        ? value.valueText.trim()
        : valueNumeric ?? "";

    if (!valueText) {
      throw new AppError("VALIDATION_ERROR", `Missing value for analyte ${analyteId}`);
    }

    const [existing] = await db
      .select()
      .from(labResults)
      .where(and(eq(labResults.labOrderItemId, itemId), eq(labResults.analyteId, analyteId)))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(labResults)
        .set({
          valueText,
          valueNumeric,
          unit: value.unit ?? undefined,
          flag,
          critical,
          enteredBy: actor.id,
          enteredAt: now,
          updatedAt: now,
        })
        .where(eq(labResults.id, existing.id))
        .returning();

      if (!updated) {
        throw new AppError("INTERNAL_ERROR", `Failed to update result for analyte ${analyteId}`);
      }
      inserted.push(updated);
    } else {
      const [created] = await db
        .insert(labResults)
        .values({
          labOrderItemId: itemId,
          analyteId,
          patientId: order.patientId,
          valueText,
          valueNumeric,
          unit: value.unit ?? undefined,
          flag,
          critical,
          enteredBy: actor.id,
          enteredAt: now,
        })
        .returning();

      if (!created) {
        throw new AppError("INTERNAL_ERROR", `Failed to create result for analyte ${analyteId}`);
      }
      inserted.push(created);
    }
  }

  if (inserted.length > 0) {
    await db
      .update(labOrders)
      .set({ status: "RESULTED", resultedAt: now, updatedAt: now })
      .where(eq(labOrders.id, id));
  }

  const firstResultId = inserted[0]?.id ?? null;
  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.result.enter",
      module: "laboratory",
      entityType: "lab_result",
      entityId: firstResultId,
      detail: { orderId: id, itemId, resultCount: inserted.length, critical },
      ip,
    },
    db,
  );

  return { inserted, critical };
};

export const releaseResults = async (
  actor: Actor,
  id: string,
  body: Record<string, unknown>,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:result:release");

  const [order] = await db
    .select()
    .from(labOrders)
    .where(eq(labOrders.id, id))
    .limit(1);

  if (!order) throw notFound("Order not found");
  if (order.status !== "RESULTED" && order.status !== "PENDING") {
    throw new AppError("INVALID_TRANSITION", `Cannot release an order with status ${order.status}`);
  }

  const requestedItemIds = Array.isArray(body.itemIds)
    ? (body.itemIds as unknown[]).filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const acknowledgedCriticalIds = Array.isArray(body.acknowledgedCriticalIds)
    ? (body.acknowledgedCriticalIds as unknown[]).filter((value): value is string => typeof value === "string")
    : [];

  const orderItems = await db
    .select({ id: labOrderItems.id })
    .from(labOrderItems)
    .where(eq(labOrderItems.labOrderId, id));
  const validOrderItemIds = orderItems.map((item) => item.id);
  const itemIds = requestedItemIds.length > 0 ? requestedItemIds : validOrderItemIds;

  if (requestedItemIds.some((itemId) => !validOrderItemIds.includes(itemId))) {
    throw new AppError("VALIDATION_ERROR", "One or more order items do not belong to this laboratory order");
  }

  const now = new Date();
  const releasedResultIds: string[] = [];

  if (itemIds.length > 0) {
    const resultsToRelease = await db
      .select()
      .from(labResults)
      .where(inArray(labResults.labOrderItemId, itemIds))
      .limit(500);

    for (const result of resultsToRelease) {
      const [updated] = await db
        .update(labResults)
        .set({ releasedAt: now, releasedBy: actor.id, updatedAt: now })
        .where(eq(labResults.id, result.id))
        .returning();

      if (!updated) {
        throw new AppError("INTERNAL_ERROR", `Failed to release result ${result.id}`);
      }
      releasedResultIds.push(updated.id);

      const contentHash = `${updated.valueText}|${updated.valueNumeric ?? ""}|${updated.flag}`;
      await db
        .insert(labResultVersions)
        .values({
          resultId: updated.id,
          version: updated.version,
          valueText: updated.valueText,
          valueNumeric: updated.valueNumeric ?? null,
          flag: updated.flag,
          contentHash,
          signedBy: actor.id,
          signedAt: now,
        })
        .onConflictDoNothing();
    }
  }

  const [updatedOrder] = await db
    .update(labOrders)
    .set({ status: "RELEASED", releasedAt: now, updatedAt: now })
    .where(eq(labOrders.id, id))
    .returning();

  if (!updatedOrder) {
    throw new AppError("INTERNAL_ERROR", "Failed to release laboratory order");
  }

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.result.release",
      module: "laboratory",
      entityType: "lab_order",
      entityId: id,
      detail: {
        releasedResultCount: releasedResultIds.length,
        acknowledgedCriticalCount: acknowledgedCriticalIds.length,
      },
      ip,
    },
    db,
  );

  return { updatedOrder, releasedAt: now, releasedResultIds };
};

export const amendResult = async (
  actor: Actor,
  id: string,
  body: Record<string, unknown>,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:result:enter");

  const [result] = await db
    .select()
    .from(labResults)
    .where(eq(labResults.id, id))
    .limit(1);

  if (!result) throw notFound("Result not found");

  const newVersion = (result.version ?? 1) + 1;
  const now = new Date();
  const valueText =
    typeof body.valueText === "string" ? body.valueText : result.valueText;
  const valueNumeric =
    body.valueNumeric !== undefined
      ? toNumericString(body.valueNumeric)
      : result.valueNumeric;
  const flag = body.flag !== undefined ? getLabFlag(body.flag, result.flag) : result.flag;
  const critical =
    typeof body.critical === "boolean" ? body.critical : result.critical;
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  const [updated] = await db
    .update(labResults)
    .set({
      valueText,
      valueNumeric,
      flag,
      critical,
      version: newVersion,
      amendedFromId: id,
      updatedAt: now,
    })
    .where(eq(labResults.id, id))
    .returning();

  if (!updated) throw new AppError("INTERNAL_ERROR", "Failed to update result");

  const contentHash = `${updated.valueText}|${updated.valueNumeric ?? ""}|${updated.flag}`;
  await db
    .insert(labResultVersions)
    .values({
      resultId: id,
      version: newVersion,
      valueText: updated.valueText,
      valueNumeric: updated.valueNumeric ?? null,
      flag: updated.flag,
      contentHash,
      signedBy: actor.id,
      signedAt: now,
      reason,
    })
    .onConflictDoNothing();

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.result.amend",
      module: "laboratory",
      entityType: "lab_result",
      entityId: updated.id,
      detail: { newVersion, amendedFromId: id, reason: reason ?? null },
      ip,
    },
    db,
  );

  return {
    id: updated.id,
    version: updated.version,
    updatedAt: now,
    signedAt: now,
    signedBy: actor.id,
    reason: reason ?? null,
    resultId: updated.id,
    amendedFromId: id,
    flag: updated.flag,
    critical: updated.critical,
    releasedAt: updated.releasedAt ?? null,
  };
};

export const listResults = async (
  actor: Actor,
  query: ListQuery,
  filters: ResultFilters,
) => {
  requirePermission(actor, "lab:result:read");
  const where = (() => {
    const parts = [];
    if (filters.patientId) parts.push(eq(labResults.patientId, filters.patientId));
    if (filters.critical !== undefined)
      parts.push(eq(labResults.critical, filters.critical));
    if (filters.flag) {
      if (!isLabFlag(filters.flag)) {
        throw new AppError("VALIDATION_ERROR", `Invalid laboratory flag: ${filters.flag}`);
      }
      parts.push(eq(labResults.flag, filters.flag));
    }
    if (filters.releasedOnly) parts.push(isNotNull(labResults.releasedAt));
    return parts.length ? and(...parts) : undefined;
  })();
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(labResults)
      .where(where)
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: sql<number>`count(*)::int` }).from(labResults).where(where),
  ]);
  return { rows: rows as any, total: Number(totals?.value ?? 0), page: query.page, pageSize: query.pageSize };
};

export const criticalResults = async (actor: Actor) => {
  requirePermission(actor, "lab:result:read");
  const results = await db
    .select()
    .from(labResults)
    .where(and(eq(labResults.critical, true), isNotNull(labResults.releasedAt)))
    .orderBy(desc(labResults.enteredAt))
    .limit(100);
  return results;
};

export const notifyCritical = async (
  actor: Actor,
  body: Record<string, unknown>,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:result:read");
  const resultId = String(body.labResultId ?? "");
  const [result] = await db
    .select()
    .from(labResults)
    .where(eq(labResults.id, resultId))
    .limit(1);
  if (!result) throw notFound("Result not found");
  if (!result.critical) throw new AppError("BAD_REQUEST", "Result is not marked as critical");

  const notifiedUserId = String(body.notifiedUserId ?? "");
  const [notification] = await db
    .insert(criticalValueNotifications)
    .values({
      resultId,
      notifiedUserId,
      notifiedBy: actor.id,
      method: (body.method as string) ?? "PHONE",
      note: body.note as string | undefined,
    })
    .returning();

  if (!notification) {
    throw new AppError("INTERNAL_ERROR", "Failed to create critical-value notification");
  }

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.critical.notify",
      module: "laboratory",
      entityType: "critical_notification",
      entityId: notification.id,
      detail: { resultId, notifiedUserId, method: body.method },
      ip,
    },
    db,
  );

  return notification;
};

export const acknowledgeCriticalNotification = async (
  actor: Actor,
  id: string,
  notes: unknown,
  ip: string | undefined,
) => {
  requirePermission(actor, "lab:critical:ack");
  const [notification] = await db
    .select()
    .from(criticalValueNotifications)
    .where(eq(criticalValueNotifications.id, id))
    .limit(1);
  if (!notification) throw notFound("Notification not found");
  if (notification.acknowledgedAt) throw new AppError("INVALID_TRANSITION", "Notification already acknowledged");

  const ackNotes = notes !== undefined ? String(notes) : null;
  const [ack] = await db
    .update(criticalValueNotifications)
    .set({
      acknowledgedAt: new Date(),
      acknowledgedBy: actor.id,
      acknowledgementNote: ackNotes,
    })
    .where(eq(criticalValueNotifications.id, id))
    .returning();

  if (!ack) {
    throw new AppError("INTERNAL_ERROR", "Failed to acknowledge critical-value notification");
  }

  await writeAudit(
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "lab.critical.acknowledge",
      module: "laboratory",
      entityType: "critical_notification",
      entityId: id,
      detail: { notes: ackNotes },
      ip,
    },
    db,
  );

  return ack;
};

export const patientLabResults = async (actor: Actor, patientId: string) => {
  requirePermission(actor, "lab:result:read");
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) throw notFound("Patient not found");

  const results = await db
    .select()
    .from(labResults)
    .where(eq(labResults.patientId, patientId))
    .orderBy(desc(labResults.enteredAt));
  return results;
};

export const laboratoryDashboard = async (actor: Actor) => {
  requirePermission(actor, "dashboard:lab");
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [pendingCount, resultedCount, releasedCount, criticalPending, todayResults] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(labOrders).where(eq(labOrders.status, "PENDING")),
    db.select({ value: sql<number>`count(*)::int` }).from(labOrders).where(eq(labOrders.status, "RESULTED")),
    db.select({ value: sql<number>`count(*)::int` }).from(labOrders).where(eq(labOrders.status, "RELEASED")),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(labResults)
      .where(and(eq(labResults.critical, true), isNotNull(labResults.releasedAt))),
    db
      .select({
        id: labResults.id,
        patientId: labResults.patientId,
        valueText: labResults.valueText,
        flag: labResults.flag,
        critical: labResults.critical,
        enteredAt: labResults.enteredAt,
      })
      .from(labResults)
      .where(sql`${labResults.enteredAt} >= ${startOfDay}`)
      .orderBy(desc(labResults.enteredAt))
      .limit(20),
  ]);

  return {
    panels: [
      { label: "Pending Orders", value: Number(pendingCount[0]?.value ?? 0), status: "info" },
      { label: "Resulted", value: Number(resultedCount[0]?.value ?? 0), status: "warning" },
      { label: "Released", value: Number(releasedCount[0]?.value ?? 0), status: "success" },
      { label: "Critical (Unread)", value: Number(criticalPending[0]?.value ?? 0), status: criticalPending[0] ? "danger" : "normal" },
    ],
    trends: {
      recentResults: (todayResults ?? []).map((r) => ({
        at: r.enteredAt,
        value: Number(r.critical),
        patientId: r.patientId,
        flag: r.flag,
      })),
    },
  };
};
