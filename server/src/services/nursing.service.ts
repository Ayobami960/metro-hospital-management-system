import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  clinicalNotes,
  medicationAdministrations,
  nursingAssignments,
  patients,
  prescriptionItems,
  prescriptions,
  vitals,
} from "../db/schema/index.js";
import { drugs } from "../db/schema/reference.js";
import type { Actor } from "../lib/authorize.js";
import { AppError, notFound } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import { ageFromDob } from "../lib/time.js";

/**
 * Nursing workflows: assigned patients, the vitals series, progress notes and
 * the medication administration record (MAR). Nurses may chart against any
 * assigned patient; every write is audited.
 */

const allowedToViewPatient = (actor: Actor, patientId: string): boolean => {
  if (actor.patientId === patientId) return true;
  return actor.role === "NURSE" || actor.role === "DOCTOR" || actor.role === "ADMIN";
};

const assertPatientAccess = (actor: Actor, patientId: string) => {
  if (!allowedToViewPatient(actor, patientId)) throw notFound("Patient not found");
};

export interface NursingListOptions {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
}

export const listAssignedPatients = async (actor: Actor, options: NursingListOptions) => {
  const [assigned, [totals]] = await Promise.all([
    db
      .select({
        id: patients.id,
        firstName: patients.firstName,
        lastName: patients.lastName,
        mrn: patients.mrn,
        dateOfBirth: patients.dateOfBirth,
        bedId: nursingAssignments.bedId,
      })
      .from(nursingAssignments)
      .innerJoin(patients, eq(nursingAssignments.patientId, patients.id))
      .where(
        and(
          eq(nursingAssignments.nurseId, actor.id),
          eq(nursingAssignments.active, true),
          options.search
            ? sql<boolean>`(${patients.lastName} ilike ${`%${options.search}%`} or ${patients.firstName} ilike ${`%${options.search}%`} or ${patients.mrn} ilike ${`%${options.search}%`})`
            : undefined,
        ),
      )
      .orderBy(asc(patients.lastName))
      .limit(options.pageSize)
      .offset(options.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(nursingAssignments)
      .innerJoin(patients, eq(nursingAssignments.patientId, patients.id))
      .where(eq(nursingAssignments.nurseId, actor.id)),
  ]);

  return {
    rows: assigned.map((row) => ({ ...row, age: ageFromDob(row.dateOfBirth) })),
    total: Number(totals?.value ?? 0),
  };
};

export interface VitalsInput {
  patientId?: string | undefined;
  encounterId?: string | undefined;
  systolic?: number | undefined;
  diastolic?: number | undefined;
  heartRate?: number | undefined;
  temperatureC?: number | undefined;
  respiratoryRate?: number | undefined;
  spo2?: number | undefined;
  weightKg?: number | undefined;
  heightCm?: number | undefined;
  painScore?: number | undefined;
  notes?: string | undefined;
}

export const recordVitals = async (actor: Actor, body: VitalsInput, ip?: string) => {
  const patientId =
    body.patientId ??
    actor.patientId ??
    (() => {
      throw new AppError("BAD_REQUEST", "No patient context");
    })();
  const now = new Date();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(vitals)
      .values({
        patientId,
        recordedBy: actor.id,
        recordedAt: now,
        systolic: body.systolic ?? null,
        diastolic: body.diastolic ?? null,
        heartRate: body.heartRate ?? null,
        temperatureC: body.temperatureC !== undefined ? body.temperatureC.toFixed(1) : null,
        respiratoryRate: body.respiratoryRate ?? null,
        spo2: body.spo2 ?? null,
        weightKg: body.weightKg !== undefined ? body.weightKg.toFixed(1) : null,
        heightCm: body.heightCm !== undefined ? body.heightCm.toFixed(1) : null,
        painScore: body.painScore ?? null,
        notes: body.notes ?? null,
        encounterId: body.encounterId ?? null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Vitals insert failed");
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "vitals.create",
        module: "nursing",
        entityType: "vital",
        entityId: row.id,
        detail: { patientId },
        ip,
      },
      tx,
    );
    return row;
  });
};

const serializeVitals = (v: typeof vitals.$inferSelect) => ({
  id: v.id,
  patientId: v.patientId,
  recordedBy: v.recordedBy,
  recordedAt: v.recordedAt,
  systolic: v.systolic,
  diastolic: v.diastolic,
  heartRate: v.heartRate,
  temperatureC: v.temperatureC !== null ? Number(v.temperatureC) : null,
  respiratoryRate: v.respiratoryRate,
  spo2: v.spo2,
  weightKg: v.weightKg !== null ? Number(v.weightKg) : null,
  heightCm: v.heightCm !== null ? Number(v.heightCm) : null,
  painScore: v.painScore,
  notes: v.notes,
});

export const listVitals = async (actor: Actor, patientId: string, options: NursingListOptions) => {
  assertPatientAccess(actor, patientId);
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(vitals)
      .where(eq(vitals.patientId, patientId))
      .orderBy(desc(vitals.recordedAt))
      .limit(options.pageSize)
      .offset(options.offset),
    db.select({ value: sql<number>`count(*)::int` }).from(vitals).where(eq(vitals.patientId, patientId)),
  ]);
  return { rows: rows.map(serializeVitals), total: Number(totals?.value ?? 0) };
};

export interface NoteInput {
  patientId?: string | undefined;
  title?: string | undefined;
  content: string;
  type?: "SOAP" | "DAR" | "NARRATIVE" | "PROGRESS" | "CONSULT" | undefined;
  encounterId?: string | undefined;
}

export const createNote = async (actor: Actor, body: NoteInput, ip?: string) => {
  const patientId =
    body.patientId ??
    actor.patientId ??
    (() => {
      throw new AppError("BAD_REQUEST", "No patient context");
    })();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(clinicalNotes)
      .values({
        patientId,
        authorId: actor.id,
        content: body.content,
        type: body.type ?? "NARRATIVE",
        status: "DRAFT",
        currentVersion: 1,
        title: body.title ?? null,
        encounterId: body.encounterId ?? null,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Note insert failed");
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "note.create",
        module: "nursing",
        entityType: "clinical_note",
        entityId: row.id,
        detail: { patientId },
        ip,
      },
      tx,
    );
    return row;
  });
};

export const listNotes = async (actor: Actor, patientId: string, options: NursingListOptions) => {
  assertPatientAccess(actor, patientId);
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(clinicalNotes)
      .where(eq(clinicalNotes.patientId, patientId))
      .orderBy(desc(clinicalNotes.createdAt))
      .limit(options.pageSize)
      .offset(options.offset),
    db.select({ value: sql<number>`count(*)::int` }).from(clinicalNotes).where(eq(clinicalNotes.patientId, patientId)),
  ]);

  return {
    rows: rows.map((n) => ({
      id: n.id,
      patientId: n.patientId,
      encounterId: n.encounterId,
      authorId: n.authorId,
      type: n.type,
      title: n.title,
      content: n.content,
      status: n.status,
      currentVersion: n.currentVersion,
      signedAt: n.signedAt,
      signedBy: n.signedBy,
      createdAt: n.createdAt,
    })),
    total: Number(totals?.value ?? 0),
  };
};

export const listMedications = async (actor: Actor, patientId: string, options: NursingListOptions) => {
  assertPatientAccess(actor, patientId);
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: medicationAdministrations.id,
        prescriptionItemId: medicationAdministrations.prescriptionItemId,
        patientId: medicationAdministrations.patientId,
        scheduledFor: medicationAdministrations.scheduledFor,
        status: medicationAdministrations.status,
        administeredAt: medicationAdministrations.administeredAt,
        administeredBy: medicationAdministrations.administeredBy,
        holdReason: medicationAdministrations.holdReason,
        notes: medicationAdministrations.notes,
        drug: sql<string>`${drugs.name}`,
        dose: prescriptionItems.dose,
        frequency: prescriptionItems.frequency,
        route: prescriptionItems.route,
      })
      .from(medicationAdministrations)
      .innerJoin(prescriptionItems, eq(medicationAdministrations.prescriptionItemId, prescriptionItems.id))
      .innerJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
      .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
      .where(eq(medicationAdministrations.patientId, patientId))
      .orderBy(asc(medicationAdministrations.scheduledFor))
      .limit(options.pageSize)
      .offset(options.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(medicationAdministrations)
      .where(eq(medicationAdministrations.patientId, patientId)),
  ]);
  return { rows, total: Number(totals?.value ?? 0) };
};

export const administerMedication = async (
  actor: Actor,
  id: string,
  body: { status: "DUE" | "GIVEN" | "HELD" | "REFUSED" | "MISSED"; holdReason?: string | undefined; notes?: string | undefined },
  ip?: string,
) => {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(medicationAdministrations)
      .where(eq(medicationAdministrations.id, id))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("MAR entry not found");
    if (body.status === "GIVEN" && existing.status !== "DUE") {
      throw new AppError("INVALID_TRANSITION", "Can only mark DUE entries as GIVEN");
    }

    const [row] = await tx
      .update(medicationAdministrations)
      .set({
        status: body.status,
        administeredAt: body.status === "GIVEN" ? now : existing.administeredAt,
        administeredBy: body.status === "GIVEN" ? actor.id : existing.administeredBy,
        holdReason: body.status === "HELD" ? (body.holdReason ?? null) : existing.holdReason,
        notes: body.notes ?? existing.notes,
      })
      .where(eq(medicationAdministrations.id, id))
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "MAR update failed");

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "mar.administer",
        module: "nursing",
        entityType: "medication_administration",
        entityId: row.id,
        detail: { status: body.status },
        ip,
      },
      tx,
    );
    return row;
  });
};
