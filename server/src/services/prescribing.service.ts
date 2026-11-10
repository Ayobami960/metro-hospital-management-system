import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  doctors,
  drugInteractions,
  drugs,
  medicationAdministrations,
  patients,
  pharmacyOrders,
  prescriptionItems,
  prescriptions,
  refillRequests,
  users,
} from "../db/schema/index.js";
import { AppError, notFound } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { requirePermission, type Actor } from "../lib/authorize.js";
import { assertClinicalScope } from "../lib/patient-access.js";
import { blockingConflicts, findDrugAllergyConflicts, summarizeConflicts } from "./allergy-check.js";
import { ageFromDob } from "../lib/time.js";

/**
 * Prescription read models, refill workflow and the drug catalogue.
 *
 * Covers the prescribing write itself (with the allergy gate), everything the
 * pharmacy, nurse, doctor and patient screens need afterwards, plus the MAR
 * schedule generated from an active prescription.
 */

const patientName = sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`;

const scopeFor = (actor: Actor) => {
  if (actor.role === "PATIENT") return eq(prescriptions.patientId, actor.patientId ?? "00000000-0000-0000-0000-000000000000");
  if (actor.role === "DOCTOR") return eq(prescriptions.doctorId, actor.doctorId ?? "00000000-0000-0000-0000-000000000000");
  return undefined;
};

export interface PrescriptionListQuery {
  page: number;
  pageSize: number;
  search: string;
  status?: string | undefined;
  sort: "createdAt" | "status" | "patient";
  order: "asc" | "desc";
}

export const listPrescriptions = async (actor: Actor, query: PrescriptionListQuery) => {
  const filters = [scopeFor(actor)];
  if (query.status) filters.push(eq(prescriptions.status, query.status as "SIGNED"));
  if (query.search) {
    filters.push(
      sql<boolean>`(${patientName} ilike ${`%${query.search}%`} or ${patients.mrn} ilike ${`%${query.search}%`} or exists (
        select 1 from hms.prescription_item pi join hms.drug d on d.id = pi.drug_id
        where pi.prescription_id = ${prescriptions.id} and d.name ilike ${`%${query.search}%`}
      ))`,
    );
  }
  const where = filters.filter(Boolean).length ? and(...(filters.filter(Boolean) as [ReturnType<typeof eq>])) : undefined;
  const orderColumn =
    query.sort === "status" ? prescriptions.status : query.sort === "patient" ? patients.lastName : prescriptions.createdAt;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: prescriptions.id,
        patientId: prescriptions.patientId,
        patientName,
        mrn: patients.mrn,
        dateOfBirth: patients.dateOfBirth,
        doctorId: prescriptions.doctorId,
        doctorName: users.name,
        status: prescriptions.status,
        notes: prescriptions.notes,
        signedAt: prescriptions.signedAt,
        expiresAt: prescriptions.expiresAt,
        createdAt: prescriptions.createdAt,
        itemCount: sql<number>`(select count(*)::int from hms.prescription_item pi where pi.prescription_id = ${prescriptions.id})`,
        drugNames: sql<string[]>`coalesce((
          select array_agg(d.name order by d.name) from hms.prescription_item pi
          join hms.drug d on d.id = pi.drug_id where pi.prescription_id = ${prescriptions.id}
        ), '{}')`,
        pharmacyOrderStatus: sql<string | null>`(
          select po.status::text from hms.pharmacy_order po where po.prescription_id = ${prescriptions.id} limit 1
        )`,
        hasOpenRefill: sql<boolean>`exists (
          select 1 from hms.refill_request rr
          join hms.prescription_item pi on pi.id = rr.prescription_item_id
          where pi.prescription_id = ${prescriptions.id} and rr.status = 'REQUESTED'
        )`,
      })
      .from(prescriptions)
      .innerJoin(patients, eq(prescriptions.patientId, patients.id))
      .innerJoin(doctors, eq(prescriptions.doctorId, doctors.id))
      .innerJoin(users, eq(doctors.userId, users.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ value: count() })
      .from(prescriptions)
      .innerJoin(patients, eq(prescriptions.patientId, patients.id))
      .where(where),
  ]);

  return {
    rows: rows.map((row) => ({ ...row, age: ageFromDob(row.dateOfBirth) })),
    total: Number(totals?.value ?? 0),
  };
};

export const getPrescription = async (actor: Actor, id: string) => {
  const [row] = await db
    .select({
      id: prescriptions.id,
      patientId: prescriptions.patientId,
      patientName,
      mrn: patients.mrn,
      doctorId: prescriptions.doctorId,
      doctorName: users.name,
      status: prescriptions.status,
      notes: prescriptions.notes,
      signedAt: prescriptions.signedAt,
      expiresAt: prescriptions.expiresAt,
      createdAt: prescriptions.createdAt,
    })
    .from(prescriptions)
    .innerJoin(patients, eq(prescriptions.patientId, patients.id))
    .innerJoin(doctors, eq(prescriptions.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(
      actor.role === "PATIENT"
        ? and(eq(prescriptions.id, id), eq(prescriptions.patientId, actor.patientId ?? ""))
        : actor.role === "DOCTOR"
          ? and(eq(prescriptions.id, id), eq(prescriptions.doctorId, actor.doctorId ?? ""))
          : eq(prescriptions.id, id),
    )
    .limit(1);
  if (!row) throw notFound("Prescription not found");

  const items = await db
    .select({
      id: prescriptionItems.id,
      drugId: prescriptionItems.drugId,
      drugName: drugs.name,
      genericName: drugs.genericName,
      strength: drugs.strength,
      form: drugs.form,
      dose: prescriptionItems.dose,
      frequency: prescriptionItems.frequency,
      route: prescriptionItems.route,
      durationDays: prescriptionItems.durationDays,
      quantity: prescriptionItems.quantity,
      unit: prescriptionItems.unit,
      refillsAuthorized: prescriptionItems.refillsAuthorized,
      refillsUsed: prescriptionItems.refillsUsed,
      instructions: prescriptionItems.instructions,
      startDate: prescriptionItems.startDate,
      endDate: prescriptionItems.endDate,
      discontinuedAt: prescriptionItems.discontinuedAt,
    })
    .from(prescriptionItems)
    .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
    .where(eq(prescriptionItems.prescriptionId, id))
    .orderBy(asc(drugs.name));

  const interactions =
    items.length < 2
      ? []
      : await db
          .select({
            drugA: sql<string>`(select d.name from hms.drug d where d.id = ${drugInteractions.drugAId})`,
            drugB: sql<string>`(select d.name from hms.drug d where d.id = ${drugInteractions.drugBId})`,
            severity: drugInteractions.severity,
            mechanism: drugInteractions.mechanism,
            management: drugInteractions.management,
          })
          .from(drugInteractions)
          .where(
            and(
              inArray(drugInteractions.drugAId, items.map((item) => item.drugId)),
              inArray(drugInteractions.drugBId, items.map((item) => item.drugId)),
            ),
          );

  return { ...row, items, interactions };
};

export const cancelPrescription = async (actor: Actor, id: string, reason: string | null) => {
  const [existing] = await db
    .select({ id: prescriptions.id, status: prescriptions.status, patientId: prescriptions.patientId, doctorId: prescriptions.doctorId })
    .from(prescriptions)
    .where(eq(prescriptions.id, id))
    .limit(1);
  if (!existing) throw notFound("Prescription not found");
  if (actor.role === "DOCTOR" && existing.doctorId !== actor.doctorId) throw notFound("Prescription not found");
  if (actor.role === "PATIENT") throw new AppError("FORBIDDEN", "Patients cannot cancel a prescription");
  if (["CANCELLED", "EXPIRED", "DISPENSED"].includes(existing.status)) {
    throw new AppError("INVALID_TRANSITION", `Cannot cancel a ${existing.status.toLowerCase()} prescription`);
  }

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(prescriptions)
      .set({ status: "CANCELLED", notes: reason ?? undefined, updatedAt: new Date() })
      .where(eq(prescriptions.id, id))
      .returning();
    await tx
      .update(pharmacyOrders)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(and(eq(pharmacyOrders.prescriptionId, id), inArray(pharmacyOrders.status, ["NEW", "PROCESSING", "READY"])));
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "prescription.cancel",
        module: "clinical",
        entityType: "prescription",
        entityId: id,
        level: "WARNING",
        detail: { reason },
      },
      tx,
    );
    return updated;
  });
  return { id: row?.id, status: row?.status };
};

/**
 * Frequency → interval hours. Only scheduled regimens generate MAR rows; PRN,
 * STAT and "as needed" orders are administered on demand and never scheduled.
 */
const intervalHours = (frequency: string): number | null => {
  const value = frequency.trim().toUpperCase();
  const every = /^Q(\d{1,2})H$/.exec(value);
  if (every) return Number(every[1]);
  const table: Record<string, number> = {
    QD: 24,
    DAILY: 24,
    ONCE: 24,
    BID: 12,
    TID: 8,
    QID: 6,
    QHS: 24,
    BIDAMPM: 12,
    WEEKLY: 168,
  };
  if (table[value]) return table[value];
  if (value.includes("PRN") || value.includes("STAT") || value.includes("AS NEEDED")) return null;
  const daily = /^(\d)\s*X\s*DAILY$/.exec(value);
  if (daily) return Math.round(24 / Math.max(1, Number(daily[1])));
  return null;
};

/** Idempotently materialises the next `days` of MAR rows for a prescription. */
export const ensureMarSchedule = async (prescriptionId: string, days = 7) => {
  const [prescription] = await db
    .select({ id: prescriptions.id, patientId: prescriptions.patientId, status: prescriptions.status })
    .from(prescriptions)
    .where(eq(prescriptions.id, prescriptionId))
    .limit(1);
  if (!prescription) throw notFound("Prescription not found");
  if (!["SIGNED", "SENT", "PARTIALLY_DISPENSED", "DISPENSED"].includes(prescription.status)) {
    return { created: 0, skipped: 0 };
  }

  const items = await db
    .select({
      id: prescriptionItems.id,
      frequency: prescriptionItems.frequency,
      startDate: prescriptionItems.startDate,
      durationDays: prescriptionItems.durationDays,
      discontinuedAt: prescriptionItems.discontinuedAt,
    })
    .from(prescriptionItems)
    .where(eq(prescriptionItems.prescriptionId, prescriptionId));

  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const existing = await db
    .select({ itemId: medicationAdministrations.prescriptionItemId, scheduledFor: medicationAdministrations.scheduledFor })
    .from(medicationAdministrations)
    .where(
      and(
        eq(medicationAdministrations.patientId, prescription.patientId),
        inArray(
          medicationAdministrations.prescriptionItemId,
          items.map((item) => item.id),
        ),
      ),
    );
  const seen = new Set(existing.map((row) => `${row.itemId}:${row.scheduledFor.toISOString()}`));

  const values: Array<{ prescriptionItemId: string; patientId: string; scheduledFor: Date; status: "DUE" }> = [];
  for (const item of items) {
    if (item.discontinuedAt) continue;
    const interval = intervalHours(item.frequency);
    if (!interval) continue;

    const start = item.startDate ? new Date(`${item.startDate}T08:00:00Z`) : now;
    const end = item.durationDays
      ? new Date(start.getTime() + item.durationDays * 24 * 60 * 60 * 1000)
      : horizon;
    const limit = end < horizon ? end : horizon;

    for (let at = new Date(Math.max(start.getTime(), now.getTime() - 12 * 60 * 60 * 1000)); at <= limit; at = new Date(at.getTime() + interval * 60 * 60 * 1000)) {
      const key = `${item.id}:${at.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      values.push({ prescriptionItemId: item.id, patientId: prescription.patientId, scheduledFor: at, status: "DUE" });
    }
  }

  if (values.length === 0) return { created: 0, skipped: existing.length };
  await db.insert(medicationAdministrations).values(values);
  return { created: values.length, skipped: existing.length };
};

/** MAR board for a nurse: every DUE/GIVEN row for their assigned patients today. */
export const marBoard = async (actor: Actor, patientId?: string) => {
  const filters = [];
  if (patientId) filters.push(eq(medicationAdministrations.patientId, patientId));
  if (actor.role === "PATIENT") {
    filters.push(eq(medicationAdministrations.patientId, actor.patientId ?? ""));
  }

  const rows = await db
    .select({
      id: medicationAdministrations.id,
      patientId: medicationAdministrations.patientId,
      patientName,
      mrn: patients.mrn,
      drug: drugs.name,
      dose: prescriptionItems.dose,
      frequency: prescriptionItems.frequency,
      route: prescriptionItems.route,
      scheduledFor: medicationAdministrations.scheduledFor,
      status: medicationAdministrations.status,
      administeredAt: medicationAdministrations.administeredAt,
      administeredBy: sql<string | null>`(
        select u.name from hms."user" u where u.id = ${medicationAdministrations.administeredBy}
      )`,
      holdReason: medicationAdministrations.holdReason,
      notes: medicationAdministrations.notes,
    })
    .from(medicationAdministrations)
    .innerJoin(patients, eq(medicationAdministrations.patientId, patients.id))
    .innerJoin(prescriptionItems, eq(medicationAdministrations.prescriptionItemId, prescriptionItems.id))
    .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(medicationAdministrations.scheduledFor))
    .limit(400);

  return rows;
};

export const listRefillRequests = async (actor: Actor, status?: string) => {
  return db
      .select({
        id: refillRequests.id,
        prescriptionItemId: refillRequests.prescriptionItemId,
        patientId: refillRequests.patientId,
        patientName,
        drug: drugs.name,
        dose: prescriptionItems.dose,
        refillsAuthorized: prescriptionItems.refillsAuthorized,
        refillsUsed: prescriptionItems.refillsUsed,
        status: refillRequests.status,
        reason: refillRequests.reason,
        decisionNote: refillRequests.decisionNote,
        decidedAt: refillRequests.decidedAt,
        createdAt: refillRequests.createdAt,
      })
      .from(refillRequests)
      .innerJoin(patients, eq(refillRequests.patientId, patients.id))
      .innerJoin(prescriptionItems, eq(refillRequests.prescriptionItemId, prescriptionItems.id))
      .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
      .where(
        and(
          status ? eq(refillRequests.status, status as "REQUESTED") : undefined,
          actor.role === "PATIENT" ? eq(refillRequests.patientId, actor.patientId ?? "") : undefined,
        ),
      )
      .orderBy(desc(refillRequests.createdAt))
      .limit(200);
};

export const requestRefill = async (actor: Actor, prescriptionItemId: string, reason?: string) => {
  const [item] = await db
    .select({
      id: prescriptionItems.id,
      patientId: prescriptions.patientId,
      refillsAuthorized: prescriptionItems.refillsAuthorized,
      refillsUsed: prescriptionItems.refillsUsed,
      drugId: prescriptionItems.drugId,
    })
    .from(prescriptionItems)
    .innerJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
    .where(eq(prescriptionItems.id, prescriptionItemId))
    .limit(1);
  if (!item) throw notFound("Prescription item not found");
  if (actor.role === "PATIENT" && item.patientId !== actor.patientId) throw notFound("Prescription item not found");
  if (item.refillsUsed >= item.refillsAuthorized) {
    throw new AppError("PRECONDITION_FAILED", "No refills remain for this medication");
  }

  const [row] = await db
    .insert(refillRequests)
    .values({ prescriptionItemId, patientId: item.patientId, reason: reason ?? null })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Refill request failed");
  return row;
};

export const decideRefill = async (actor: Actor, id: string, decision: "APPROVED" | "DENIED", note?: string) => {
  const [existing] = await db
    .select({ id: refillRequests.id, status: refillRequests.status, prescriptionItemId: refillRequests.prescriptionItemId, patientId: refillRequests.patientId })
    .from(refillRequests)
    .where(eq(refillRequests.id, id))
    .limit(1);
  if (!existing) throw notFound("Refill request not found");
  if (existing.status !== "REQUESTED") {
    throw new AppError("INVALID_TRANSITION", `Refill request is already ${existing.status.toLowerCase()}`);
  }

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(refillRequests)
      .set({
        status: decision,
        decidedBy: actor.id,
        decidedAt: new Date(),
        decisionNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(refillRequests.id, id))
      .returning();

    if (decision === "APPROVED") {
      await tx
        .update(prescriptionItems)
        .set({ refillsUsed: sql`${prescriptionItems.refillsUsed} + 1`, updatedAt: new Date() })
        .where(eq(prescriptionItems.id, existing.prescriptionItemId));
      const [prescription] = await tx
        .select({ id: prescriptions.id })
        .from(prescriptions)
        .innerJoin(prescriptionItems, eq(prescriptionItems.prescriptionId, prescriptions.id))
        .where(eq(prescriptionItems.id, existing.prescriptionItemId))
        .limit(1);
      if (prescription) {
        await tx.insert(pharmacyOrders).values({
          prescriptionId: prescription.id,
          patientId: existing.patientId,
          status: "NEW",
          priority: "ROUTINE",
          notes: "Refill approved",
        });
      }
    }

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: `refill.${decision.toLowerCase()}`,
        module: "pharmacy",
        entityType: "refill_request",
        entityId: id,
        detail: { note: note ?? null },
      },
      tx,
    );
    return updated;
  });

  return { id: row?.id, status: row?.status };
};

export const listDrugs = async (search: string, category?: string, limit = 100) => {
  const filters = [];
  if (search) {
    filters.push(
      sql<boolean>`(${drugs.name} ilike ${`%${search}%`} or ${drugs.genericName} ilike ${`%${search}%`} or ${drugs.ndc} ilike ${`%${search}%`})`,
    );
  }
  if (category) filters.push(eq(drugs.category, category));
  return db
    .select({
      id: drugs.id,
      name: drugs.name,
      genericName: drugs.genericName,
      strength: drugs.strength,
      form: drugs.form,
      unit: drugs.unit,
      category: drugs.category,
      ndc: drugs.ndc,
      controlled: drugs.controlled,
    })
    .from(drugs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(drugs.name))
    .limit(limit);
};

export const listInteractions = async (search?: string) => {
  const rows = await db
    .select({
      id: drugInteractions.id,
      drugAId: drugInteractions.drugAId,
      drugBId: drugInteractions.drugBId,
      drugA: sql<string>`(select d.name from hms.drug d where d.id = ${drugInteractions.drugAId})`,
      drugB: sql<string>`(select d.name from hms.drug d where d.id = ${drugInteractions.drugBId})`,
      severity: drugInteractions.severity,
      mechanism: drugInteractions.mechanism,
      management: drugInteractions.management,
      significance: drugInteractions.significance,
    })
    .from(drugInteractions)
    .where(
      search
        ? sql<boolean>`(
            exists (select 1 from hms.drug d where d.id = ${drugInteractions.drugAId} and d.name ilike ${`%${search}%`})
            or exists (select 1 from hms.drug d where d.id = ${drugInteractions.drugBId} and d.name ilike ${`%${search}%`})
          )`
        : undefined,
    )
    .orderBy(asc(drugInteractions.severity))
    .limit(300);
  return rows;
};

/** Pairwise check used by the prescribing and dispensing screens. */
export const checkInteractions = async (drugIds: string[]) => {
  if (drugIds.length < 2) return [];
  return db
    .select({
      drugAId: drugInteractions.drugAId,
      drugBId: drugInteractions.drugBId,
      drugA: sql<string>`(select d.name from hms.drug d where d.id = ${drugInteractions.drugAId})`,
      drugB: sql<string>`(select d.name from hms.drug d where d.id = ${drugInteractions.drugBId})`,
      severity: drugInteractions.severity,
      mechanism: drugInteractions.mechanism,
      management: drugInteractions.management,
    })
    .from(drugInteractions)
    .where(and(inArray(drugInteractions.drugAId, drugIds), inArray(drugInteractions.drugBId, drugIds)));
};

export interface CreatePrescriptionItem {
  drugId: string;
  dose: string;
  frequency: string;
  route: "PO" | "IV" | "SQ" | "IM" | "TOPICAL" | "INHALED" | "RECTAL" | "OPHTHALMIC";
  durationDays?: number | undefined;
  quantity: number;
  unit: string;
  refillsAuthorized: number;
  instructions?: string | undefined;
  startDate?: string | undefined;
}

export interface CreatePrescriptionInput {
  patientId: string;
  encounterId?: string | undefined;
  notes?: string | undefined;
  priority: "ROUTINE" | "URGENT" | "STAT";
  allergyOverride: boolean;
  overrideReason?: string | undefined;
  items: CreatePrescriptionItem[];
}

export interface CreatedPrescription {
  id: string;
  patientId: string;
  status: string;
  signedAt: Date | null;
}

/**
 * Prescribing gate. A SEVERE/LIFE_THREATENING allergy match refuses the order
 * unless the prescriber explicitly overrides with a reason; the override is
 * stored in the audit trail, and the dispense gate checks again.
 */
export const createPrescription = async (
  actor: Actor,
  body: CreatePrescriptionInput,
  ip?: string,
): Promise<{ prescription: CreatedPrescription; conflicts: ReturnType<typeof summarizeConflicts>; overrideUsed: boolean }> => {
  requirePermission(actor, "prescription:write");
  if (actor.role !== "DOCTOR" || !actor.doctorId) {
    throw new AppError("FORBIDDEN", "Only a physician can prescribe");
  }
  await assertClinicalScope(actor, body.patientId);

  const conflicts = await findDrugAllergyConflicts(
    body.patientId,
    body.items.map((item) => item.drugId),
  );
  const blocking = blockingConflicts(conflicts);
  if (blocking.length > 0 && !(body.allergyOverride && body.overrideReason)) {
    throw new AppError(
      "ALLERGY_CONFLICT",
      "A severe allergy conflict blocks this prescription; provide a documented override",
      { ...summarizeConflicts(conflicts), overrideAllowed: true },
    );
  }

  const result = await db.transaction(async (tx) => {
    const [rx] = await tx
      .insert(prescriptions)
      .values({
        patientId: body.patientId,
        doctorId: actor.doctorId as string,
        encounterId: body.encounterId ?? null,
        status: "SIGNED",
        notes: body.notes ?? null,
        signedAt: new Date(),
        signedBy: actor.id,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .returning();
    if (!rx) throw new AppError("INTERNAL_ERROR", "Prescription insert failed");

    for (const item of body.items) {
      await tx.insert(prescriptionItems).values({
        prescriptionId: rx.id,
        drugId: item.drugId,
        dose: item.dose,
        frequency: item.frequency,
        route: item.route,
        durationDays: item.durationDays ?? null,
        quantity: String(item.quantity),
        unit: item.unit,
        refillsAuthorized: item.refillsAuthorized,
        instructions: item.instructions ?? null,
        startDate: item.startDate ?? null,
      });
    }
    await tx.insert(pharmacyOrders).values({
      prescriptionId: rx.id,
      patientId: body.patientId,
      status: "NEW",
      priority: body.priority,
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "prescription.create",
        module: "clinical",
        entityType: "prescription",
        entityId: rx.id,
        level: "SUCCESS",
        detail: { patientId: body.patientId, itemCount: body.items.length, allergyConflicts: conflicts.length },
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
          module: "clinical",
          entityType: "prescription",
          entityId: rx.id,
          level: "WARNING",
          detail: {
            patientId: body.patientId,
            reason: body.overrideReason ?? null,
            conflicts: blocking.map((c) => ({ allergen: c.allergen, severity: c.severity, drugId: c.drugId })),
          },
          ip,
        },
        tx,
      );
    }
    return rx;
  });

  return {
    prescription: { id: result.id, patientId: result.patientId, status: result.status, signedAt: result.signedAt },
    conflicts: summarizeConflicts(conflicts),
    overrideUsed: blocking.length > 0,
  };
};
