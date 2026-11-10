import { and, asc, desc, eq, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  dispenseItems,
  dispenses,
  inventoryBatches,
  inventoryItems,
  pharmacyOrders,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
} from "../db/schema/pharmacy.js";
import { patients, prescriptionItems, prescriptions } from "../db/schema/index.js";
import { doctors, drugs, drugInteractions, suppliers } from "../db/schema/reference.js";
import { users } from "../db/schema/identity.js";
import { requirePermission, type Actor } from "../lib/authorize.js";
import { writeAudit, writePhiAccess } from "../lib/audit.js";
import { blockingConflicts, findDrugAllergyConflicts, summarizeConflicts } from "./allergy-check.js";
import { AppError, notFound, type ListQuery } from "../lib/http.js";
import { referenceNumber } from "../lib/refs.js";
import { addDays, clinicDayRange } from "../lib/time.js";

/** PharmacyDashboard's three-way stock badge. */
const stockStatus = (onHand: number, reorderLevel: number): "Out of Stock" | "Critical" | "Low" | "OK" => {
  if (onHand <= 0) return "Out of Stock";
  if (onHand <= Math.max(1, Math.floor(reorderLevel * 0.25))) return "Critical";
  if (onHand <= reorderLevel) return "Low";
  return "OK";
};

const onHandByItem = () =>
  sql<number>`coalesce((select sum(b.quantity)::int from hms.inventory_batch b where b.item_id = ${inventoryItems.id}), 0)`;

const nearestExpiryByItem = () =>
  sql<Date | null>`(select min(b.expiry_date) from hms.inventory_batch b where b.item_id = ${inventoryItems.id} and b.quantity > 0)`;

/**
 * Drug interaction pairs inside one prescription. Computed on read; nothing is
 * stored, so editing a prescription can never leave a stale interaction flag.
 */
const interactionPairsFor = async (prescriptionId: string) => {
  const items = await db
    .select({ drugId: prescriptionItems.drugId, name: drugs.name })
    .from(prescriptionItems)
    .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
    .where(eq(prescriptionItems.prescriptionId, prescriptionId));
  const ids = items.map((i) => i.drugId);
  if (ids.length < 2) return { items, interactions: [] as Array<Record<string, unknown>> };
  const interactions = await db
    .select({
      drugAId: drugInteractions.drugAId,
      drugBId: drugInteractions.drugBId,
      severity: drugInteractions.severity,
      mechanism: drugInteractions.mechanism,
      management: drugInteractions.management,
    })
    .from(drugInteractions)
    .where(and(inArray(drugInteractions.drugAId, ids), inArray(drugInteractions.drugBId, ids)));
  return { items, interactions };
};

export type PharmacyOrderFilters = {
  status?: string | undefined;
  priority?: string | undefined;
};

export const listPharmacyOrders = async (actor: Actor, q: ListQuery, filters: PharmacyOrderFilters) => {
  requirePermission(actor, "prescription:read");

  const where = (() => {
    const parts = [];
    if (filters.status) parts.push(eq(pharmacyOrders.status, filters.status as "NEW"));
    if (filters.priority) parts.push(eq(pharmacyOrders.priority, filters.priority as "ROUTINE"));
    if (q.search) {
      parts.push(
        sql<boolean>`(${patients.firstName} ilike ${`%${q.search}%`} or ${patients.lastName} ilike ${`%${q.search}%`} or ${patients.mrn} ilike ${`%${q.search}%`})`,
      );
    }
    return parts.length ? and(...parts) : undefined;
  })();

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: pharmacyOrders.id,
        prescriptionId: pharmacyOrders.prescriptionId,
        patientId: pharmacyOrders.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        prescriber: sql<string | null>`${users.name}`,
        priority: pharmacyOrders.priority,
        status: pharmacyOrders.status,
        receivedAt: pharmacyOrders.receivedAt,
        readyAt: pharmacyOrders.readyAt,
        dispensedAt: pharmacyOrders.dispensedAt,
        notes: pharmacyOrders.notes,
        itemCount: sql<number>`(select count(*)::int from hms.prescription_item pi where pi.prescription_id = ${pharmacyOrders.prescriptionId})`,
        drugNames: sql<string[]>`coalesce((
          select array_agg(d.name order by d.name)
          from hms.prescription_item pi join hms.drug d on d.id = pi.drug_id
          where pi.prescription_id = ${pharmacyOrders.prescriptionId}
        ), '{}')`,
        hasInteractions: sql<boolean>`exists (
          select 1 from hms.prescription_item a
          join hms.prescription_item b on b.prescription_id = a.prescription_id and b.drug_id <> a.drug_id
          join hms.drug_interaction di
            on (di.drug_a_id = a.drug_id and di.drug_b_id = b.drug_id)
            or (di.drug_b_id = a.drug_id and di.drug_a_id = b.drug_id)
          where a.prescription_id = ${pharmacyOrders.prescriptionId}
        )`,
      })
      .from(pharmacyOrders)
      .innerJoin(patients, eq(pharmacyOrders.patientId, patients.id))
      .innerJoin(prescriptions, eq(pharmacyOrders.prescriptionId, prescriptions.id))
      .leftJoin(doctors, eq(prescriptions.doctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(where)
      .orderBy(q.order === "asc" ? asc(pharmacyOrders.receivedAt) : desc(pharmacyOrders.receivedAt))
      .limit(q.pageSize)
      .offset(q.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(pharmacyOrders)
      .innerJoin(patients, eq(pharmacyOrders.patientId, patients.id))
      .where(where),
  ]);

  return { rows, total: Number(totals?.value ?? 0) };
};

const loadOrder = async (id: string) => {
  const [order] = await db.select().from(pharmacyOrders).where(eq(pharmacyOrders.id, id)).limit(1);
  if (!order) throw notFound("Pharmacy order not found");
  return order;
};

export const advanceOrder = async (
  actor: Actor,
  id: string,
  to: "PROCESSING" | "READY",
  from: readonly string[],
  ip: string | undefined,
) => {
  requirePermission(actor, "prescription:dispense");

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(pharmacyOrders)
      .where(eq(pharmacyOrders.id, id))
      .limit(1)
      .for("update");
    if (!order) throw notFound("Pharmacy order not found");
    if (!from.includes(order.status)) {
      throw new AppError("INVALID_TRANSITION", `Cannot move from ${order.status} to ${to}`, {
        from: order.status,
        to,
      });
    }
    const now = new Date();
    const [row] = await tx
      .update(pharmacyOrders)
      .set({
        status: to,
        processedBy: order.processedBy ?? actor.id,
        readyAt: to === "READY" ? now : order.readyAt,
        updatedAt: now,
      })
      .where(and(eq(pharmacyOrders.id, id), eq(pharmacyOrders.status, order.status)))
      .returning();
    if (!row) throw new AppError("CONFLICT", "Order changed concurrently; retry");
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: `pharmacy.order.${to.toLowerCase()}`,
        module: "pharmacy",
        entityType: "pharmacy_order",
        entityId: id,
        ip,
      },
      tx,
    );
    return { id: row.id, status: row.status, readyAt: row.readyAt };
  });
};

/** Dispense-screen pre-fill: checklist, interactions, allergy conflicts, FEFO batches. */
export const verifyOrder = async (actor: Actor, id: string, ip: string | undefined) => {
  requirePermission(actor, "prescription:dispense");
  const order = await loadOrder(id);

  const { items, interactions } = await interactionPairsFor(order.prescriptionId);
  const conflicts = await findDrugAllergyConflicts(
    order.patientId,
    items.map((item) => item.drugId),
  );
  await writePhiAccess({
    actorId: actor.id,
    actorRole: actor.role,
    patientId: order.patientId,
    resourceType: "allergies",
    resourceId: order.id,
    action: "READ",
    ip,
  });
  const allergy = summarizeConflicts(conflicts);

  const batches = await db
    .select({
      id: inventoryBatches.id,
      batchNumber: inventoryBatches.batchNumber,
      expiryDate: inventoryBatches.expiryDate,
      quantity: inventoryBatches.quantity,
      itemId: inventoryBatches.itemId,
      drugId: inventoryItems.drugId,
    })
    .from(inventoryBatches)
    .innerJoin(inventoryItems, eq(inventoryBatches.itemId, inventoryItems.id))
    .where(
      and(
        inArray(
          inventoryItems.drugId,
          items.map((i) => i.drugId),
        ),
        gt(inventoryBatches.quantity, 0),
      ),
    )
    .orderBy(asc(inventoryBatches.expiryDate));

  const stockedDrugIds = new Set(batches.map((b) => b.drugId));
  const stockAvailable = items.every((item) => stockedDrugIds.has(item.drugId));

  return {
    order: { id: order.id, status: order.status, priority: order.priority },
    items: items.map((item) => ({ drugId: item.drugId, drugName: item.name })),
    interactions,
    allergyConflicts: conflicts,
    allergy: {
      ...allergy,
      blocking: blockingConflicts(conflicts),
    },
    stockAvailable,
    batches,
    checklist: {
      patientIdVerified: false,
      drugMatches: false,
      doseCorrect: false,
      counselingGiven: false,
    },
  };
};

export type DispenseChecklist = {
  patientIdVerified: boolean;
  drugMatches: boolean;
  doseCorrect: boolean;
  counselingGiven: boolean;
};

export type DispenseInput = {
  checklist: DispenseChecklist;
  quantityOverride: boolean;
  allergyOverride: boolean;
  overrideReason?: string | undefined;
  note?: string | undefined;
};

/**
 * Atomic dispense: FEFO batch decrement + ledger + dispense log + prescription
 * status, all in one transaction. Stock is never allowed to go negative.
 */
export const dispenseOrder = async (actor: Actor, id: string, body: DispenseInput, ip: string | undefined) => {
  requirePermission(actor, "prescription:dispense");

  const attested = Object.values(body.checklist).every(Boolean);
  if (!attested) {
    throw new AppError("PRECONDITION_FAILED", "All four dispense attestations are required", {
      checklist: body.checklist,
    });
  }

  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(pharmacyOrders)
      .where(eq(pharmacyOrders.id, id))
      .limit(1)
      .for("update");
    if (!order) throw notFound("Pharmacy order not found");
    if (!["NEW", "PROCESSING", "READY"].includes(order.status)) {
      throw new AppError("INVALID_TRANSITION", `Order is already ${order.status}`);
    }

    const items = await tx
      .select()
      .from(prescriptionItems)
      .where(eq(prescriptionItems.prescriptionId, order.prescriptionId));
    if (items.length === 0) throw new AppError("PRECONDITION_FAILED", "Prescription has no items");

    // Re-check allergies in the same transaction: the prescriber's check is
    // not trusted to be current, and an override must carry a reason.
    const conflicts = await findDrugAllergyConflicts(
      order.patientId,
      items.map((item) => item.drugId),
      tx,
    );
    const blocking = blockingConflicts(conflicts);
    if (blocking.length > 0 && !(body.allergyOverride && body.overrideReason)) {
      throw new AppError(
        "ALLERGY_CONFLICT",
        "A severe allergy conflict blocks this dispense; provide a documented override",
        { ...summarizeConflicts(conflicts), overrideAllowed: true },
      );
    }
    if (conflicts.length > 0) {
      await writePhiAccess(
        {
          actorId: actor.id,
          actorRole: actor.role,
          patientId: order.patientId,
          resourceType: "allergies",
          resourceId: order.id,
          action: "READ",
          ip,
        },
        tx,
      );
    }

    const now = new Date();
    const [dispense] = await tx
      .insert(dispenses)
      .values({
        pharmacyOrderId: order.id,
        prescriptionId: order.prescriptionId,
        patientId: order.patientId,
        pharmacistId: actor.id,
        checklist: body.checklist,
        quantityOverride: body.quantityOverride,
        overrideReason: body.overrideReason ?? null,
        notes: body.note ?? null,
        dispensedAt: now,
      })
      .returning();
    if (!dispense) throw new AppError("INTERNAL_ERROR", "Dispense insert failed");

    const movements: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const requested = Number(item.quantity);
      const [stockRow] = await tx
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.drugId, item.drugId))
        .limit(1);
      if (!stockRow) {
        throw new AppError("INSUFFICIENT_STOCK", "Drug is not stocked by the pharmacy", {
          drugId: item.drugId,
          required: requested,
          available: 0,
        });
      }

      const available = await tx
        .select({ total: sql<number>`coalesce(sum(${inventoryBatches.quantity}), 0)::int` })
        .from(inventoryBatches)
        .where(eq(inventoryBatches.itemId, stockRow.id));
      const onHand = Number(available[0]?.total ?? 0);
      if (onHand < requested) {
        throw new AppError("INSUFFICIENT_STOCK", "Not enough stock to dispense", {
          drugId: item.drugId,
          required: requested,
          available: onHand,
        });
      }

      let remaining = requested;
      while (remaining > 0) {
        const [batch] = await tx
          .select()
          .from(inventoryBatches)
          .where(and(eq(inventoryBatches.itemId, stockRow.id), gt(inventoryBatches.quantity, 0)))
          .orderBy(asc(inventoryBatches.expiryDate), asc(inventoryBatches.receivedAt))
          .limit(1)
          .for("update");
        if (!batch) {
          throw new AppError("INSUFFICIENT_STOCK", "No batch available to dispense from", {
            drugId: item.drugId,
            required: requested,
            available: onHand,
          });
        }
        const take = Math.min(remaining, batch.quantity);
        await tx
          .update(inventoryBatches)
          .set({ quantity: sql`${inventoryBatches.quantity} - ${take}`, updatedAt: now })
          .where(eq(inventoryBatches.id, batch.id));

        const [movement] = await tx
          .insert(stockMovements)
          .values({
            itemId: stockRow.id,
            batchId: batch.id,
            delta: -take,
            reason: "DISPENSE",
            referenceType: "dispense",
            referenceId: dispense.id,
            actorId: actor.id,
            notes: body.note ?? null,
          })
          .returning();
        if (movement) {
          movements.push({
            id: movement.id,
            batchId: movement.batchId,
            delta: movement.delta,
            quantityOnBatch: batch.quantity - take,
          });
        }

        await tx.insert(dispenseItems).values({
          dispenseId: dispense.id,
          prescriptionItemId: item.id,
          drugId: item.drugId,
          batchId: batch.id,
          quantity: take,
          unit: item.unit,
        });
        remaining -= take;
      }
    }

    const dispensedTotals = await tx
      .select({
        prescriptionItemId: dispenseItems.prescriptionItemId,
        total: sql<number>`sum(${dispenseItems.quantity})::int`,
      })
      .from(dispenseItems)
      .innerJoin(dispenses, eq(dispenseItems.dispenseId, dispenses.id))
      .where(eq(dispenses.prescriptionId, order.prescriptionId))
      .groupBy(dispenseItems.prescriptionItemId);

    const fullyDispensed = items.every((item) => {
      const row = dispensedTotals.find((t) => t.prescriptionItemId === item.id);
      return Number(row?.total ?? 0) >= Number(item.quantity);
    });

    await tx
      .update(prescriptions)
      .set({
        status: fullyDispensed ? "DISPENSED" : "PARTIALLY_DISPENSED",
        updatedAt: now,
      })
      .where(eq(prescriptions.id, order.prescriptionId));

    await tx
      .update(pharmacyOrders)
      .set({ status: "DISPENSED", dispensedAt: now, processedBy: order.processedBy ?? actor.id, updatedAt: now })
      .where(eq(pharmacyOrders.id, order.id));

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "pharmacy.dispense",
        module: "pharmacy",
        entityType: "dispense",
        entityId: dispense.id,
        level: "SUCCESS",
        detail: {
          prescriptionId: order.prescriptionId,
          movements: movements.length,
          allergyConflicts: conflicts.length,
        },
        ip,
      },
      tx,
    );
    if (blocking.length > 0) {
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "clinical.allergy.override",
          module: "pharmacy",
          entityType: "dispense",
          entityId: dispense.id,
          level: "WARNING",
          detail: {
            patientId: order.patientId,
            reason: body.overrideReason ?? null,
            conflicts: blocking.map((c) => ({ allergen: c.allergen, severity: c.severity, drugId: c.drugId })),
          },
          ip,
        },
        tx,
      );
    }

    return { dispense, movements, prescriptionStatus: fullyDispensed ? "DISPENSED" : "PARTIALLY_DISPENSED" };
  });

  return {
    dispense: {
      id: result.dispense.id,
      patientId: result.dispense.patientId,
      prescriptionId: result.dispense.prescriptionId,
      pharmacistId: result.dispense.pharmacistId,
      checklist: result.dispense.checklist,
      dispensedAt: result.dispense.dispensedAt,
    },
    stockMovements: result.movements,
    prescriptionStatus: result.prescriptionStatus,
  };
};

export type DispenseLogFilters = {
  from?: Date | undefined;
  to?: Date | undefined;
  pharmacistId?: string | undefined;
  patientId?: string | undefined;
};

export const listDispenseLog = async (actor: Actor, q: ListQuery, filters: DispenseLogFilters) => {
  requirePermission(actor, "prescription:read");

  const parts = [];
  if (filters.from) parts.push(sql`${dispenses.dispensedAt} >= ${filters.from}`);
  if (filters.to) parts.push(sql`${dispenses.dispensedAt} <= ${filters.to}`);
  if (filters.pharmacistId) parts.push(eq(dispenses.pharmacistId, filters.pharmacistId));
  if (filters.patientId) parts.push(eq(dispenses.patientId, filters.patientId));
  if (q.search) {
    parts.push(
      sql<boolean>`(${patients.firstName} ilike ${`%${q.search}%`} or ${patients.lastName} ilike ${`%${q.search}%`} or ${patients.mrn} ilike ${`%${q.search}%`} or exists (
        select 1 from hms.dispense_item di join hms.drug d on d.id = di.drug_id
        where di.dispense_id = ${dispenses.id} and d.name ilike ${`%${q.search}%`}
      ))`,
    );
  }
  const where = parts.length ? and(...parts) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: dispenses.id,
        patientId: dispenses.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        pharmacistId: dispenses.pharmacistId,
        pharmacist: sql<string | null>`${users.name}`,
        dispensedAt: dispenses.dispensedAt,
        drugNames: sql<string[]>`coalesce((
          select array_agg(d.name order by d.name)
          from hms.dispense_item di join hms.drug d on d.id = di.drug_id
          where di.dispense_id = ${dispenses.id}
        ), '{}')`,
        quantity: sql<number>`coalesce((select sum(di.quantity)::int from hms.dispense_item di where di.dispense_id = ${dispenses.id}), 0)`,
      })
      .from(dispenses)
      .innerJoin(patients, eq(dispenses.patientId, patients.id))
      .leftJoin(users, eq(dispenses.pharmacistId, users.id))
      .where(where)
      .orderBy(desc(dispenses.dispensedAt))
      .limit(q.pageSize)
      .offset(q.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(dispenses)
      .innerJoin(patients, eq(dispenses.patientId, patients.id))
      .where(where),
  ]);

  return { rows, total: Number(totals?.value ?? 0) };
};

const inventoryView = {
  drugId: inventoryItems.drugId,
  name: drugs.name,
  genericName: drugs.genericName,
  strength: drugs.strength,
  form: drugs.form,
  category: drugs.category,
  ndc: drugs.ndc,
  unit: inventoryItems.unit,
  reorderLevel: inventoryItems.reorderLevel,
  location: inventoryItems.location,
  onHand: onHandByItem(),
  nearestExpiry: nearestExpiryByItem(),
};

const withStock = <T extends { onHand: unknown; reorderLevel: number }>(row: T) => ({
  ...row,
  onHand: Number(row.onHand ?? 0),
  nearestExpiry: (row as { nearestExpiry?: Date | null }).nearestExpiry ?? null,
  derivedStatus: stockStatus(Number(row.onHand ?? 0), row.reorderLevel),
});

export type InventoryFilters = { category?: string | undefined; derivedStatus?: string | undefined };

export const listInventory = async (actor: Actor, q: ListQuery, filters: InventoryFilters) => {
  requirePermission(actor, "inventory:read");

  const parts = [];
  if (filters.category) parts.push(eq(drugs.category, filters.category));
  if (q.search) {
    parts.push(
      sql<boolean>`(${drugs.name} ilike ${`%${q.search}%`} or ${drugs.genericName} ilike ${`%${q.search}%`} or ${drugs.ndc} ilike ${`%${q.search}%`})`,
    );
  }
  const where = parts.length ? and(...parts) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({ ...inventoryView, id: inventoryItems.id })
      .from(inventoryItems)
      .innerJoin(drugs, eq(inventoryItems.drugId, drugs.id))
      .where(where)
      .orderBy(q.sort === "onHand" ? (q.order === "asc" ? asc(onHandByItem()) : desc(onHandByItem())) : asc(drugs.name))
      .limit(q.pageSize)
      .offset(q.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(inventoryItems)
      .innerJoin(drugs, eq(inventoryItems.drugId, drugs.id))
      .where(where),
  ]);

  const data = rows
    .map((row) => withStock(row))
    .filter((row) => (filters.derivedStatus ? row.derivedStatus === filters.derivedStatus : true));

  return { rows: data, total: Number(totals?.value ?? 0) };
};

export const inventoryAlerts = async (actor: Actor) => {
  requirePermission(actor, "inventory:read");
  const horizon = addDays(new Date(), 60);
  const rows = await db
    .select({ ...inventoryView, id: inventoryItems.id })
    .from(inventoryItems)
    .innerJoin(drugs, eq(inventoryItems.drugId, drugs.id))
    .orderBy(asc(drugs.name));

  const mapped = rows.map((row) => withStock(row));

  return {
    outOfStock: mapped.filter((r) => r.onHand <= 0),
    lowStock: mapped.filter((r) => r.onHand > 0 && r.onHand <= r.reorderLevel),
    nearExpiry: mapped.filter((r) => r.nearestExpiry !== null && new Date(r.nearestExpiry) <= horizon),
    expired: mapped.filter((r) => r.nearestExpiry !== null && new Date(r.nearestExpiry) < new Date()),
  };
};

export const listDrugBatches = async (actor: Actor, drugId: string) => {
  requirePermission(actor, "inventory:read");
  return db
    .select({
      id: inventoryBatches.id,
      batchNumber: inventoryBatches.batchNumber,
      lotNumber: inventoryBatches.lotNumber,
      expiryDate: inventoryBatches.expiryDate,
      quantity: inventoryBatches.quantity,
      receivedAt: inventoryBatches.receivedAt,
      supplierId: inventoryBatches.supplierId,
      supplier: sql<string | null>`${suppliers.name}`,
    })
    .from(inventoryBatches)
    .innerJoin(inventoryItems, eq(inventoryBatches.itemId, inventoryItems.id))
    .leftJoin(suppliers, eq(inventoryBatches.supplierId, suppliers.id))
    .where(eq(inventoryItems.drugId, drugId))
    .orderBy(asc(inventoryBatches.expiryDate));
};

export const updateInventorySettings = async (
  actor: Actor,
  drugId: string,
  body: { reorderLevel: number; location?: string | undefined },
  ip: string | undefined,
) => {
  requirePermission(actor, "inventory:write");

  const [row] = await db
    .update(inventoryItems)
    .set({ reorderLevel: body.reorderLevel, location: body.location ?? null, updatedAt: new Date() })
    .where(eq(inventoryItems.drugId, drugId))
    .returning();
  if (!row) throw notFound("Inventory item not found for that drug");

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "inventory.settings",
    module: "pharmacy",
    entityType: "inventory_item",
    entityId: row.id,
    detail: { reorderLevel: body.reorderLevel },
    ip,
  });

  return { drugId: row.drugId, reorderLevel: row.reorderLevel, unit: row.unit, location: row.location };
};

export type ReceiptInput = {
  drugId: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  supplierId?: string | undefined;
  unit?: string | undefined;
  reorderLevel?: number | undefined;
};

export const recordReceipt = async (actor: Actor, body: ReceiptInput, ip: string | undefined) => {
  requirePermission(actor, "inventory:write");

  const result = await db.transaction(async (tx) => {
    let [item] = await tx.select().from(inventoryItems).where(eq(inventoryItems.drugId, body.drugId)).limit(1);
    if (!item) {
      const [drugRow] = await tx.select().from(drugs).where(eq(drugs.id, body.drugId)).limit(1);
      if (!drugRow) throw notFound("Drug not found");
      [item] = await tx
        .insert(inventoryItems)
        .values({
          drugId: body.drugId,
          unit: body.unit ?? drugRow.unit,
          reorderLevel: body.reorderLevel ?? 50,
        })
        .returning();
      if (!item) throw new AppError("INTERNAL_ERROR", "Inventory item insert failed");
    }

    const [batch] = await tx
      .insert(inventoryBatches)
      .values({
        itemId: item.id,
        batchNumber: body.batchNumber,
        expiryDate: body.expiryDate,
        quantity: body.quantity,
        supplierId: body.supplierId ?? null,
      })
      .onConflictDoUpdate({
        target: [inventoryBatches.itemId, inventoryBatches.batchNumber, inventoryBatches.expiryDate],
        set: { quantity: sql`${inventoryBatches.quantity} + ${body.quantity}`, updatedAt: new Date() },
      })
      .returning();
    if (!batch) throw new AppError("INTERNAL_ERROR", "Batch insert failed");

    const [movement] = await tx
      .insert(stockMovements)
      .values({
        itemId: item.id,
        batchId: batch.id,
        delta: body.quantity,
        reason: "RECEIPT",
        referenceType: "inventory_receipt",
        actorId: actor.id,
      })
      .returning();

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "inventory.receipt",
        module: "pharmacy",
        entityType: "inventory_batch",
        entityId: batch.id,
        detail: { drugId: body.drugId, quantity: body.quantity },
        ip,
      },
      tx,
    );
    return { batch, movement };
  });

  return {
    batch: {
      id: result.batch.id,
      batchNumber: result.batch.batchNumber,
      expiryDate: result.batch.expiryDate,
      quantity: result.batch.quantity,
    },
    movement: result.movement
      ? { id: result.movement.id, delta: result.movement.delta, reason: result.movement.reason }
      : null,
  };
};

export type AdjustmentInput = {
  batchId: string;
  delta: number;
  reason: "ADJUSTMENT" | "COUNT_CORRECTION" | "EXPIRY" | "RETURN" | "TRANSFER";
  note?: string | undefined;
};

export const recordAdjustment = async (actor: Actor, body: AdjustmentInput, ip: string | undefined) => {
  requirePermission(actor, "inventory:write");

  const movement = await db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.id, body.batchId))
      .limit(1)
      .for("update");
    if (!batch) throw notFound("Batch not found");
    if (batch.quantity + body.delta < 0) {
      throw new AppError("PRECONDITION_FAILED", "Adjustment would make the batch negative", {
        current: batch.quantity,
        delta: body.delta,
      });
    }

    await tx
      .update(inventoryBatches)
      .set({ quantity: batch.quantity + body.delta, updatedAt: new Date() })
      .where(eq(inventoryBatches.id, batch.id));

    const [row] = await tx
      .insert(stockMovements)
      .values({
        itemId: batch.itemId,
        batchId: batch.id,
        delta: body.delta,
        reason: body.reason,
        referenceType: "inventory_adjustment",
        actorId: actor.id,
        notes: body.note ?? null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Movement insert failed");

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "inventory.adjust",
        module: "pharmacy",
        entityType: "stock_movement",
        entityId: row.id,
        level: "WARNING",
        detail: { batchId: batch.id, delta: body.delta, reason: body.reason },
        ip,
      },
      tx,
    );
    return row;
  });

  return {
    movement: {
      id: movement.id,
      batchId: movement.batchId,
      delta: movement.delta,
      reason: movement.reason,
      createdAt: movement.createdAt,
    },
  };
};

export type PurchaseOrderFilters = { status?: string | undefined; supplierId?: string | undefined };

export const listPurchaseOrders = async (actor: Actor, q: ListQuery, filters: PurchaseOrderFilters) => {
  requirePermission(actor, "purchase_order:read");

  const parts = [];
  if (filters.status) parts.push(eq(purchaseOrders.status, filters.status as "DRAFT"));
  if (filters.supplierId) parts.push(eq(purchaseOrders.supplierId, filters.supplierId));
  if (q.search) parts.push(sql<boolean>`${purchaseOrders.poNumber} ilike ${`%${q.search}%`}`);
  const where = parts.length ? and(...parts) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierId: purchaseOrders.supplierId,
        supplier: suppliers.name,
        status: purchaseOrders.status,
        orderedAt: purchaseOrders.orderedAt,
        expectedDeliveryAt: purchaseOrders.expectedDeliveryAt,
        receivedAt: purchaseOrders.receivedAt,
        totalMinor: purchaseOrders.totalMinor,
        currency: purchaseOrders.currency,
        itemCount: sql<number>`(select count(*)::int from hms.purchase_order_item i where i.purchase_order_id = ${purchaseOrders.id})`,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(where)
      .orderBy(desc(purchaseOrders.orderedAt))
      .limit(q.pageSize)
      .offset(q.offset),
    db.select({ value: sql<number>`count(*)::int` }).from(purchaseOrders).where(where),
  ]);

  return { rows, total: Number(totals?.value ?? 0) };
};

export type PurchaseOrderInput = {
  supplierId: string;
  expectedDeliveryAt?: string | undefined;
  notes?: string | undefined;
  items: Array<{ drugId: string; quantity: number; unitCostMinor: number }>;
};

export const createPurchaseOrder = async (actor: Actor, body: PurchaseOrderInput, ip: string | undefined) => {
  requirePermission(actor, "purchase_order:write");

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, body.supplierId)).limit(1);
  if (!supplier) throw notFound("Supplier not found");

  const po = await db.transaction(async (tx) => {
    const totalMinor = body.items.reduce((sum, i) => sum + i.quantity * i.unitCostMinor, 0);
    const [order] = await tx
      .insert(purchaseOrders)
      .values({
        poNumber: referenceNumber("PO"),
        supplierId: body.supplierId,
        status: "DRAFT",
        expectedDeliveryAt: body.expectedDeliveryAt ? new Date(body.expectedDeliveryAt) : null,
        totalMinor,
        createdBy: actor.id,
        notes: body.notes ?? null,
      })
      .returning();
    if (!order) throw new AppError("INTERNAL_ERROR", "Purchase order insert failed");

    const items = await tx
      .insert(purchaseOrderItems)
      .values(
        body.items.map((item) => ({
          purchaseOrderId: order.id,
          drugId: item.drugId,
          quantity: item.quantity,
          unitCostMinor: item.unitCostMinor,
        })),
      )
      .returning();

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "purchase_order.create",
        module: "pharmacy",
        entityType: "purchase_order",
        entityId: order.id,
        detail: { totalMinor },
        ip,
      },
      tx,
    );
    return { order, items };
  });

  return {
    id: po.order.id,
    poNumber: po.order.poNumber,
    status: po.order.status,
    totalMinor: po.order.totalMinor,
    currency: po.order.currency,
    items: po.items.map((i) => ({
      id: i.id,
      drugId: i.drugId,
      quantity: i.quantity,
      unitCostMinor: i.unitCostMinor,
      receivedQuantity: i.receivedQuantity,
    })),
  };
};

export const transitionPurchaseOrder = async (
  actor: Actor,
  id: string,
  to: "SUBMITTED" | "SHIPPED" | "CANCELLED",
  from: readonly string[],
  event: string,
  ip: string | undefined,
) => {
  requirePermission(actor, "purchase_order:write");

  return db.transaction(async (tx) => {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1).for("update");
    if (!po) throw notFound("Purchase order not found");
    if (!from.includes(po.status)) {
      throw new AppError("INVALID_TRANSITION", `Cannot move from ${po.status} to ${to}`, { from: po.status, to });
    }
    const now = new Date();
    const [updated] = await tx
      .update(purchaseOrders)
      .set({
        status: to,
        receivedAt: to === "CANCELLED" ? po.receivedAt : po.receivedAt,
        updatedAt: now,
      })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.status, po.status)))
      .returning();
    if (!updated) throw new AppError("CONFLICT", "Purchase order changed concurrently; retry");
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: `purchase_order.${event}`,
        module: "pharmacy",
        entityType: "purchase_order",
        entityId: id,
        ip,
      },
      tx,
    );
    return { id: updated.id, status: updated.status };
  });
};

export type ReceiveInput = {
  items: Array<{ itemId: string; quantityReceived: number; batchNumber: string; expiryDate: string }>;
};

export const receivePurchaseOrder = async (actor: Actor, id: string, body: ReceiveInput, ip: string | undefined) => {
  requirePermission(actor, "purchase_order:write");

  const result = await db.transaction(async (tx) => {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1).for("update");
    if (!po) throw notFound("Purchase order not found");
    if (!["SUBMITTED", "SHIPPED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      throw new AppError("INVALID_TRANSITION", `Cannot receive a ${po.status} purchase order`);
    }

    const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    const batches: Array<Record<string, unknown>> = [];
    const movements: Array<Record<string, unknown>> = [];

    for (const received of body.items) {
      const item = items.find((i) => i.id === received.itemId);
      if (!item) throw notFound("Purchase order item not found");
      if (item.receivedQuantity + received.quantityReceived > item.quantity) {
        throw new AppError("PRECONDITION_FAILED", "Received quantity exceeds the ordered quantity", {
          itemId: item.id,
          ordered: item.quantity,
          alreadyReceived: item.receivedQuantity,
        });
      }

      let [inventoryItem] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.drugId, item.drugId))
        .limit(1);
      if (!inventoryItem) {
        [inventoryItem] = await tx
          .insert(inventoryItems)
          .values({ drugId: item.drugId, unit: item.unit ?? "tablet" })
          .returning();
        if (!inventoryItem) throw new AppError("INTERNAL_ERROR", "Inventory item insert failed");
      }

      const [batch] = await tx
        .insert(inventoryBatches)
        .values({
          itemId: inventoryItem.id,
          batchNumber: received.batchNumber,
          expiryDate: received.expiryDate,
          quantity: received.quantityReceived,
          supplierId: po.supplierId,
        })
        .onConflictDoUpdate({
          target: [inventoryBatches.itemId, inventoryBatches.batchNumber, inventoryBatches.expiryDate],
          set: {
            quantity: sql`${inventoryBatches.quantity} + ${received.quantityReceived}`,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!batch) throw new AppError("INTERNAL_ERROR", "Batch insert failed");

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          itemId: inventoryItem.id,
          batchId: batch.id,
          delta: received.quantityReceived,
          reason: "RECEIPT",
          referenceType: "purchase_order",
          referenceId: po.id,
          actorId: actor.id,
        })
        .returning();

      await tx
        .update(purchaseOrderItems)
        .set({ receivedQuantity: item.receivedQuantity + received.quantityReceived })
        .where(eq(purchaseOrderItems.id, item.id));

      batches.push({
        id: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantity: batch.quantity,
      });
      movements.push({ id: movement?.id, delta: movement?.delta });
    }

    const refreshed = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    const complete = refreshed.every((i) => i.receivedQuantity >= i.quantity);
    const [updated] = await tx
      .update(purchaseOrders)
      .set({
        status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED",
        receivedAt: complete ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "purchase_order.receive",
        module: "pharmacy",
        entityType: "purchase_order",
        entityId: id,
        detail: { complete, lines: body.items.length },
        ip,
      },
      tx,
    );

    return { po: updated, batches, movements };
  });

  return {
    po: { id: result.po?.id, status: result.po?.status, receivedAt: result.po?.receivedAt },
    batches: result.batches,
    movements: result.movements,
  };
};

export const pharmacyDashboard = async (actor: Actor) => {
  requirePermission(actor, "dashboard:pharmacy");
  const { start, end } = clinicDayRange();

  const [pending, dispensedToday, lowStockRows, expiring, recent, weekly] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(pharmacyOrders)
      .where(inArray(pharmacyOrders.status, ["NEW", "PROCESSING", "READY"])),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(dispenses)
      .where(and(sql`${dispenses.dispensedAt} >= ${start}`, sql`${dispenses.dispensedAt} < ${end}`)),
    db
      .select({ ...inventoryView, id: inventoryItems.id })
      .from(inventoryItems)
      .innerJoin(drugs, eq(inventoryItems.drugId, drugs.id)),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(inventoryBatches)
      .where(
        and(
          isNotNull(inventoryBatches.expiryDate),
          lt(inventoryBatches.expiryDate, addDays(new Date(), 60).toISOString().slice(0, 10)),
          gt(inventoryBatches.quantity, 0),
        ),
      ),
    db
      .select({
        id: pharmacyOrders.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        priority: pharmacyOrders.priority,
        status: pharmacyOrders.status,
        receivedAt: pharmacyOrders.receivedAt,
      })
      .from(pharmacyOrders)
      .innerJoin(patients, eq(pharmacyOrders.patientId, patients.id))
      .orderBy(desc(pharmacyOrders.receivedAt))
      .limit(8),
    db
      .select({
        day: sql<string>`to_char(${dispenses.dispensedAt} at time zone 'UTC', 'Dy')`,
        count: sql<number>`count(*)::int`,
      })
      .from(dispenses)
      .where(sql`${dispenses.dispensedAt} >= now() - interval '7 days'`)
      .groupBy(sql`1`),
  ]);

  const lowStock = lowStockRows
    .map((row) => withStock(row))
    .filter((row) => row.derivedStatus !== "OK")
    .sort((a, b) => a.onHand - b.onHand)
    .slice(0, 10);

  return {
    stats: {
      pendingOrders: Number(pending[0]?.value ?? 0),
      dispensedToday: Number(dispensedToday[0]?.value ?? 0),
      lowStockCount: lowStock.filter((r) => r.derivedStatus === "Low").length,
      criticalStockCount: lowStock.filter((r) => r.derivedStatus === "Critical" || r.derivedStatus === "Out of Stock")
        .length,
      expiringSoon: Number(expiring[0]?.value ?? 0),
    },
    queue: recent,
    lowStock,
    weeklyDispensed: weekly,
  };
};
