import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  patientAllergies,
  patientAllergyHistory,
  patientProblems,
  patientProblemHistory,
  patients,
} from "../db/schema/patients.js";
import { drugs, icd10Codes } from "../db/schema/reference.js";
import { encounters, prescriptionItems, prescriptions, vitals } from "../db/schema/clinical.js";
import { auditLogs, phiAccessLogs } from "../db/schema/audit.js";
import { users } from "../db/schema/identity.js";
import { assertClinicalScope, selfPatientId } from "../lib/patient-access.js";
import { requirePermission, type Actor } from "../lib/authorize.js";
import { writeAudit, writePhiAccess } from "../lib/audit.js";
import { AppError, notFound } from "../lib/http.js";

/**
 * Clinical chart: allergies, problem list, clinical summary, the access/audit
 * log readers and the reference pick-lists those screens need.
 */

export type AllergySeverity = "MILD" | "MODERATE" | "SEVERE" | "LIFE_THREATENING";
export type AllergyStatus = "ACTIVE" | "INACTIVE" | "ENTERED_IN_ERROR";
export type ProblemStatus = "ACTIVE" | "MONITORING" | "RESOLVED";

const logClinicalRead = async (
  actor: Actor,
  patientId: string,
  resourceType: string,
  resourceId: string | null,
  ip?: string,
): Promise<void> => {
  if (actor.role === "PATIENT") return;
  await writePhiAccess({
    actorId: actor.id,
    actorRole: actor.role,
    patientId,
    resourceType,
    resourceId,
    action: "READ",
    ip,
  });
};

const verifiedByRole = (actor: Actor): boolean => actor.role === "DOCTOR" || actor.role === "SUPER_ADMIN";

export type AllergyDto = {
  id: string;
  patientId: string;
  allergen: string;
  reaction: string | null;
  severity: string;
  status: string;
  source: string;
  active: boolean;
  onsetDate: string | null;
  notes: string | null;
  recordedBy: string | null;
  recordedAt: Date;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
}

const serializeAllergy = (row: typeof patientAllergies.$inferSelect): AllergyDto => ({
  id: row.id,
  patientId: row.patientId,
  allergen: row.allergen,
  reaction: row.reaction,
  severity: row.severity,
  status: row.status,
  source: row.source,
  active: row.status === "ACTIVE",
  onsetDate: row.onsetDate,
  notes: row.notes,
  recordedBy: row.recordedBy,
  recordedAt: row.recordedAt,
  verified: Boolean(row.verifiedAt),
  verifiedBy: row.verifiedBy,
  verifiedAt: row.verifiedAt,
});

export const loadAllergies = async (patientId: string, includeInactive = false) =>
  db
    .select()
    .from(patientAllergies)
    .where(
      and(
        eq(patientAllergies.patientId, patientId),
        includeInactive ? undefined : eq(patientAllergies.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(patientAllergies.severity), desc(patientAllergies.recordedAt));

export const loadProblems = async (patientId: string, includeResolved = true) =>
  db
    .select({
      problem: patientProblems,
      icd10Code: icd10Codes.code,
      icd10Description: icd10Codes.description,
      managedByName: users.name,
    })
    .from(patientProblems)
    .leftJoin(icd10Codes, eq(patientProblems.icd10Id, icd10Codes.id))
    .leftJoin(users, eq(patientProblems.managedBy, users.id))
    .where(
      and(
        eq(patientProblems.patientId, patientId),
        includeResolved ? undefined : sql`${patientProblems.status} <> 'RESOLVED'`,
      ),
    )
    .orderBy(asc(patientProblems.status), desc(patientProblems.onsetDate));

export interface ProblemDto {
  id: string;
  patientId: string;
  diagnosis: string;
  icd10Id: string | null;
  icd10Code: string | null;
  icd10Description: string | null;
  onsetDate: string | null;
  status: string;
  source: string;
  managedBy: string | null;
  managedByName: string | null;
  lastReviewedAt: Date | null;
  resolvedAt: Date | null;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  notes: string | null;
  recordedBy: string | null;
  recordedAt: Date;
}

export const serializeProblem = (row: Awaited<ReturnType<typeof loadProblems>>[number]): ProblemDto => ({
  id: row.problem.id,
  patientId: row.problem.patientId,
  diagnosis: row.problem.diagnosis,
  icd10Id: row.problem.icd10Id,
  icd10Code: row.icd10Code,
  icd10Description: row.icd10Description,
  onsetDate: row.problem.onsetDate,
  status: row.problem.status,
  source: row.problem.source,
  managedBy: row.problem.managedBy,
  managedByName: row.managedByName,
  lastReviewedAt: row.problem.lastReviewedAt,
  resolvedAt: row.problem.resolvedAt,
  verified: Boolean(row.problem.verifiedAt),
  verifiedBy: row.problem.verifiedBy,
  verifiedAt: row.problem.verifiedAt,
  notes: row.problem.notes,
  recordedBy: row.problem.recordedBy,
  recordedAt: row.problem.createdAt,
});

const ensurePatient = async (patientId: string) => {
  const [patient] = await db
    .select({ id: patients.id, noKnownAllergies: patients.noKnownAllergies })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) throw notFound("Patient not found");
  return patient;
};

export const listAllergies = async (actor: Actor, patientId: string, includeInactive: boolean, ip?: string) => {
  requirePermission(actor, "allergy:read");
  await assertClinicalScope(actor, patientId);
  const rows = await loadAllergies(patientId, includeInactive);
  await logClinicalRead(actor, patientId, "allergies", null, ip);
  return rows.map(serializeAllergy);
};

export const listMyAllergies = async (actor: Actor, includeInactive: boolean) => {
  requirePermission(actor, "allergy:read");
  const rows = await loadAllergies(selfPatientId(actor), includeInactive);
  return rows.map(serializeAllergy);
};

/** Registration desk sees only the flag, never the allergen list. */
export const allergyFlag = async (actor: Actor, patientId: string, ip?: string) => {
  requirePermission(actor, "patient:read");
  const patient = await ensurePatient(patientId);
  const [stats] = await db
    .select({
      total: count(),
      severe: sql<number>`count(*) filter (where ${patientAllergies.severity} in ('SEVERE','LIFE_THREATENING'))::int`,
    })
    .from(patientAllergies)
    .where(and(eq(patientAllergies.patientId, patientId), eq(patientAllergies.status, "ACTIVE")));
  await logClinicalRead(actor, patientId, "allergy_flag", null, ip);
  return {
    patientId,
    noKnownAllergies: patient.noKnownAllergies,
    hasAllergies: Number(stats?.total ?? 0) > 0,
    count: Number(stats?.total ?? 0),
    hasSevere: Number(stats?.severe ?? 0) > 0,
  };
};

export interface CreateAllergyInput {
  allergen: string;
  reaction?: string | undefined;
  severity: AllergySeverity;
  status: AllergyStatus;
  onsetDate?: string | undefined;
  notes?: string | undefined;
}

export const createAllergy = async (
  actor: Actor,
  patientId: string,
  body: CreateAllergyInput,
  ip?: string,
): Promise<AllergyDto> => {
  requirePermission(actor, "allergy:write");
  await assertClinicalScope(actor, patientId);
  await ensurePatient(patientId);
  const verified = verifiedByRole(actor);

  const row = await db.transaction(async (tx) => {
    const [allergy] = await tx
      .insert(patientAllergies)
      .values({
        patientId,
        allergen: body.allergen,
        reaction: body.reaction ?? null,
        severity: body.severity,
        status: body.status,
        active: body.status === "ACTIVE",
        source: actor.role === "PATIENT" ? "PATIENT_REPORTED" : "CLINICIAN",
        onsetDate: body.onsetDate ?? null,
        notes: body.notes ?? null,
        recordedBy: actor.id,
        verifiedBy: verified ? actor.id : null,
        verifiedAt: verified ? new Date() : null,
      })
      .returning();
    if (!allergy) throw new AppError("INTERNAL_ERROR", "Allergy insert failed");

    if (body.status === "ACTIVE") {
      await tx.update(patients).set({ noKnownAllergies: false }).where(eq(patients.id, patientId));
    }
    await tx.insert(patientAllergyHistory).values({
      allergyId: allergy.id,
      patientId,
      action: "CREATE",
      snapshot: serializeAllergy(allergy),
      actorId: actor.id,
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "allergy.create",
        module: "clinical",
        entityType: "patient_allergy",
        entityId: allergy.id,
        level: verified ? "SUCCESS" : "INFO",
        detail: { patientId, severity: allergy.severity, verified, source: allergy.source },
        ip,
      },
      tx,
    );
    return allergy;
  });

  await writePhiAccess({
    actorId: actor.id,
    actorRole: actor.role,
    patientId,
    resourceType: "allergies",
    resourceId: row.id,
    action: "WRITE",
    ip,
  });
  return serializeAllergy(row);
};

export interface UpdateAllergyInput {
  allergen?: string | undefined;
  reaction?: string | null | undefined;
  severity?: AllergySeverity | undefined;
  status?: AllergyStatus | undefined;
  onsetDate?: string | null | undefined;
  notes?: string | null | undefined;
  reason?: string | undefined;
}

export const updateAllergy = async (
  actor: Actor,
  patientId: string,
  allergyId: string,
  body: UpdateAllergyInput,
  ip?: string,
): Promise<AllergyDto> => {
  requirePermission(actor, "allergy:write");
  await assertClinicalScope(actor, patientId);

  const [existing] = await db
    .select()
    .from(patientAllergies)
    .where(and(eq(patientAllergies.id, allergyId), eq(patientAllergies.patientId, patientId)))
    .limit(1);
  if (!existing) throw notFound("Allergy not found");
  if (actor.role === "PATIENT" && existing.recordedBy !== actor.id) {
    throw new AppError("FORBIDDEN", "Patients may only edit allergies they reported");
  }
  if (body.status && body.status !== "ACTIVE" && !body.reason) {
    throw new AppError("PRECONDITION_FAILED", "A reason is required to deactivate or retract an allergy");
  }

  const verified = verifiedByRole(actor) && body.status !== "ENTERED_IN_ERROR";
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(patientAllergies)
      .set({
        allergen: body.allergen ?? existing.allergen,
        reaction: body.reaction === undefined ? existing.reaction : body.reaction,
        severity: body.severity ?? existing.severity,
        status: body.status ?? existing.status,
        active: (body.status ?? existing.status) === "ACTIVE",
        onsetDate: body.onsetDate === undefined ? existing.onsetDate : body.onsetDate,
        notes: body.notes === undefined ? existing.notes : body.notes,
        source: actor.role === "PATIENT" ? "PATIENT_REPORTED" : existing.source,
        verifiedBy: verified ? actor.id : null,
        verifiedAt: verified ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(patientAllergies.id, allergyId))
      .returning();
    if (!updated) throw notFound("Allergy not found");
    await tx.insert(patientAllergyHistory).values({
      allergyId,
      patientId,
      action: body.status === "ENTERED_IN_ERROR" ? "ENTERED_IN_ERROR" : "UPDATE",
      snapshot: serializeAllergy(updated),
      actorId: actor.id,
      reason: body.reason ?? null,
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "allergy.update",
        module: "clinical",
        entityType: "patient_allergy",
        entityId: allergyId,
        detail: { patientId, from: existing.status, to: updated.status, reason: body.reason ?? null },
        ip,
      },
      tx,
    );
    return updated;
  });

  return serializeAllergy(row);
};

export const verifyAllergy = async (
  actor: Actor,
  patientId: string,
  allergyId: string,
  ip?: string,
): Promise<AllergyDto> => {
  requirePermission(actor, "allergy:verify");
  await assertClinicalScope(actor, patientId);

  const [existing] = await db
    .select()
    .from(patientAllergies)
    .where(and(eq(patientAllergies.id, allergyId), eq(patientAllergies.patientId, patientId)))
    .limit(1);
  if (!existing) throw notFound("Allergy not found");
  if (existing.status === "ENTERED_IN_ERROR") {
    throw new AppError("PRECONDITION_FAILED", "A retracted allergy cannot be verified");
  }

  const now = new Date();
  const row = await db.transaction(async (tx) => {
    // Only a clinician may verify; verification is never implied by an edit.
    const [updated] = await tx
      .update(patientAllergies)
      .set({ verifiedBy: actor.id, verifiedAt: now, updatedAt: now })
      .where(eq(patientAllergies.id, allergyId))
      .returning();
    await tx.insert(patientAllergyHistory).values({
      allergyId,
      patientId,
      action: "VERIFY",
      snapshot: updated ? serializeAllergy(updated) : { id: allergyId },
      actorId: actor.id,
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "allergy.verify",
        module: "clinical",
        entityType: "patient_allergy",
        entityId: allergyId,
        level: "SUCCESS",
        detail: { patientId },
        ip,
      },
      tx,
    );
    return updated;
  });
  if (!row) throw notFound("Allergy not found");
  return serializeAllergy(row);
};

export const setNoKnownAllergies = async (
  actor: Actor,
  patientId: string,
  noKnownAllergies: boolean,
  reason?: string,
  ip?: string,
): Promise<{ patientId: string; noKnownAllergies: boolean }> => {
  requirePermission(actor, "allergy:write");
  await assertClinicalScope(actor, patientId);

  if (noKnownAllergies) {
    const [active] = await db
      .select({ id: patientAllergies.id })
      .from(patientAllergies)
      .where(and(eq(patientAllergies.patientId, patientId), eq(patientAllergies.status, "ACTIVE")))
      .limit(1);
    if (active) {
      throw new AppError("PRECONDITION_FAILED", "Retract the active allergies before marking NKDA");
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({ noKnownAllergies, updatedAt: new Date() })
      .where(eq(patients.id, patientId));
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "allergy.nkda",
        module: "clinical",
        entityType: "patient",
        entityId: patientId,
        detail: { noKnownAllergies, reason: reason ?? null },
        ip,
      },
      tx,
    );
  });
  return { patientId, noKnownAllergies };
};

export const listProblems = async (actor: Actor, patientId: string, includeResolved: boolean, ip?: string) => {
  requirePermission(actor, "problem:read");
  await assertClinicalScope(actor, patientId);
  const rows = await loadProblems(patientId, includeResolved);
  await logClinicalRead(actor, patientId, "problems", null, ip);
  return rows.map(serializeProblem);
};

export const listMyProblems = async (actor: Actor, includeResolved: boolean) => {
  requirePermission(actor, "problem:read");
  const rows = await loadProblems(selfPatientId(actor), includeResolved);
  return rows.map(serializeProblem);
};

const resolveIcd10 = async (code?: string, id?: string) => {
  if (id) {
    const [row] = await db.select().from(icd10Codes).where(eq(icd10Codes.id, id)).limit(1);
    if (!row) throw new AppError("VALIDATION_ERROR", "Unknown ICD-10 code", { field: "icd10Id" });
    return row;
  }
  if (code) {
    const [row] = await db
      .select()
      .from(icd10Codes)
      .where(sql`lower(${icd10Codes.code}) = lower(${code})`)
      .limit(1);
    if (!row) throw new AppError("VALIDATION_ERROR", "Unknown ICD-10 code", { field: "icd10Code", code });
    return row;
  }
  return null;
};

export interface CreateProblemInput {
  diagnosis: string;
  icd10Code?: string | undefined;
  icd10Id?: string | undefined;
  onsetDate?: string | undefined;
  status: ProblemStatus;
  managedBy?: string | undefined;
  notes?: string | undefined;
}

export const createProblem = async (
  actor: Actor,
  patientId: string,
  body: CreateProblemInput,
  ip?: string,
): Promise<ProblemDto | { id: string }> => {
  requirePermission(actor, "problem:write");
  await assertClinicalScope(actor, patientId);
  const icd10 = await resolveIcd10(body.icd10Code, body.icd10Id);
  const verified = verifiedByRole(actor);

  const row = await db.transaction(async (tx) => {
    const [problem] = await tx
      .insert(patientProblems)
      .values({
        patientId,
        diagnosis: body.diagnosis,
        icd10Id: icd10?.id ?? null,
        onsetDate: body.onsetDate ?? null,
        status: body.status,
        source: actor.role === "PATIENT" ? "PATIENT_REPORTED" : "CLINICIAN",
        managedBy: body.managedBy ?? actor.id,
        lastReviewedAt: new Date(),
        notes: body.notes ?? null,
        recordedBy: actor.id,
        verifiedBy: verified ? actor.id : null,
        verifiedAt: verified ? new Date() : null,
        resolvedAt: body.status === "RESOLVED" ? new Date() : null,
      })
      .returning();
    if (!problem) throw new AppError("INTERNAL_ERROR", "Problem insert failed");
    await tx.insert(patientProblemHistory).values({
      problemId: problem.id,
      patientId,
      action: "CREATE",
      snapshot: {
        id: problem.id,
        diagnosis: problem.diagnosis,
        status: problem.status,
        icd10Code: icd10?.code ?? null,
      },
      actorId: actor.id,
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "problem.create",
        module: "clinical",
        entityType: "patient_problem",
        entityId: problem.id,
        detail: { patientId, icd10: icd10?.code ?? null, verified },
        ip,
      },
      tx,
    );
    return problem;
  });

  await writePhiAccess({
    actorId: actor.id,
    actorRole: actor.role,
    patientId,
    resourceType: "problems",
    resourceId: row.id,
    action: "WRITE",
    ip,
  });
  const rows = await loadProblems(patientId);
  const loaded = rows.find((r) => r.problem.id === row.id);
  return loaded ? serializeProblem(loaded) : { id: row.id };
};

export interface UpdateProblemInput {
  diagnosis?: string | undefined;
  icd10Code?: string | undefined;
  icd10Id?: string | null | undefined;
  onsetDate?: string | null | undefined;
  status?: ProblemStatus | undefined;
  managedBy?: string | null | undefined;
  notes?: string | null | undefined;
  reason?: string | undefined;
}

export const updateProblem = async (
  actor: Actor,
  patientId: string,
  problemId: string,
  body: UpdateProblemInput,
  ip?: string,
): Promise<ProblemDto | { id: string; status: string }> => {
  requirePermission(actor, "problem:write");
  await assertClinicalScope(actor, patientId);

  const [existing] = await db
    .select()
    .from(patientProblems)
    .where(and(eq(patientProblems.id, problemId), eq(patientProblems.patientId, patientId)))
    .limit(1);
  if (!existing) throw notFound("Problem not found");
  if (actor.role === "PATIENT" && existing.recordedBy !== actor.id) {
    throw new AppError("FORBIDDEN", "Patients may only edit problems they reported");
  }
  if (body.status === "RESOLVED" && !body.reason) {
    throw new AppError("PRECONDITION_FAILED", "A reason is required to resolve a problem");
  }
  const icd10 = body.icd10Id || body.icd10Code ? await resolveIcd10(body.icd10Code, body.icd10Id ?? undefined) : null;
  const status = body.status ?? existing.status;
  const verified = verifiedByRole(actor);
  const now = new Date();

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(patientProblems)
      .set({
        diagnosis: body.diagnosis ?? existing.diagnosis,
        icd10Id: body.icd10Id === null ? null : icd10?.id ?? existing.icd10Id,
        onsetDate: body.onsetDate === undefined ? existing.onsetDate : body.onsetDate,
        status,
        managedBy: body.managedBy === undefined ? existing.managedBy : body.managedBy,
        notes: body.notes === undefined ? existing.notes : body.notes,
        lastReviewedAt: now,
        resolvedAt: status === "RESOLVED" ? existing.resolvedAt ?? now : null,
        source: actor.role === "PATIENT" ? "PATIENT_REPORTED" : existing.source,
        verifiedBy: verified ? actor.id : null,
        verifiedAt: verified ? now : null,
        updatedAt: now,
      })
      .where(eq(patientProblems.id, problemId))
      .returning();
    if (!row) throw notFound("Problem not found");
    await tx.insert(patientProblemHistory).values({
      problemId,
      patientId,
      action: status === "RESOLVED" ? "RESOLVE" : "UPDATE",
      snapshot: { id: row.id, diagnosis: row.diagnosis, status: row.status, icd10Code: icd10?.code ?? null },
      actorId: actor.id,
      reason: body.reason ?? null,
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: status === "RESOLVED" ? "problem.resolve" : "problem.update",
        module: "clinical",
        entityType: "patient_problem",
        entityId: problemId,
        detail: { patientId, from: existing.status, to: status, reason: body.reason ?? null },
        ip,
      },
      tx,
    );
    return row;
  });

  const rows = await loadProblems(patientId);
  const loaded = rows.find((r) => r.problem.id === updated.id);
  return loaded ? serializeProblem(loaded) : { id: updated.id, status: updated.status };
};

export interface ClinicalSummary {
  patientId: string;
  noKnownAllergies: boolean;
  counts: {
    activeAllergies: number;
    severeAllergies: number;
    activeProblems: number;
    activeMedications: number;
  };
  allergies: AllergyDto[];
  problems: ProblemDto[];
  latestVitals: typeof vitals.$inferSelect | null;
  activeMedications: {
    id: string;
    prescriptionId: string;
    drugName: string;
    dose: string;
    frequency: string;
    route: string;
    quantity: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  }[];
  recentEncounters: {
    id: string;
    type: string;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
    chiefComplaint: string | null;
  }[];
}

export const buildSummary = async (patientId: string): Promise<ClinicalSummary> => {
  const [patient] = await db
    .select({ id: patients.id, noKnownAllergies: patients.noKnownAllergies })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) throw notFound("Patient not found");

  const [allergies, problems, latestVitals, activeMeds, recentEncounters] = await Promise.all([
    loadAllergies(patientId, false),
    loadProblems(patientId, false),
    db.select().from(vitals).where(eq(vitals.patientId, patientId)).orderBy(desc(vitals.recordedAt)).limit(1),
    db
      .select({
        id: prescriptionItems.id,
        prescriptionId: prescriptions.id,
        drugName: drugs.name,
        dose: prescriptionItems.dose,
        frequency: prescriptionItems.frequency,
        route: prescriptionItems.route,
        quantity: prescriptionItems.quantity,
        status: prescriptions.status,
        startDate: prescriptionItems.startDate,
        endDate: prescriptionItems.endDate,
      })
      .from(prescriptionItems)
      .innerJoin(prescriptions, eq(prescriptionItems.prescriptionId, prescriptions.id))
      .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
      .where(
        and(
          eq(prescriptions.patientId, patientId),
          sql`${prescriptions.status} in ('SIGNED','SENT','PARTIALLY_DISPENSED')`,
          sql`${prescriptionItems.discontinuedAt} is null`,
        ),
      )
      .orderBy(desc(prescriptions.createdAt)),
    db
      .select({
        id: encounters.id,
        type: encounters.type,
        status: encounters.status,
        startedAt: encounters.startedAt,
        endedAt: encounters.endedAt,
        chiefComplaint: encounters.chiefComplaint,
      })
      .from(encounters)
      .where(eq(encounters.patientId, patientId))
      .orderBy(desc(encounters.startedAt))
      .limit(5),
  ]);

  return {
    patientId,
    noKnownAllergies: patient.noKnownAllergies,
    counts: {
      activeAllergies: allergies.length,
      severeAllergies: allergies.filter((a) => a.severity === "SEVERE" || a.severity === "LIFE_THREATENING").length,
      activeProblems: problems.length,
      activeMedications: activeMeds.length,
    },
    allergies: allergies.map(serializeAllergy),
    problems: problems.map(serializeProblem),
    latestVitals: latestVitals[0] ?? null,
    activeMedications: activeMeds,
    recentEncounters,
  };
};

export const patientClinicalSummary = async (actor: Actor, patientId: string, ip?: string) => {
  requirePermission(actor, "patient:read");
  requirePermission(actor, "allergy:read");
  requirePermission(actor, "problem:read");
  await assertClinicalScope(actor, patientId);
  const summary = await buildSummary(patientId);
  await logClinicalRead(actor, patientId, "clinical_summary", null, ip);
  return summary;
};

export const myClinicalSummary = async (actor: Actor) => {
  requirePermission(actor, "allergy:read");
  return buildSummary(selfPatientId(actor));
};

export interface PagedRows<T> {
  rows: T[];
  total: number;
}

export const listAccessLog = async (
  actor: Actor,
  pageSize: number,
  offset: number,
): Promise<PagedRows<typeof phiAccessLogs.$inferSelect>> => {
  const where =
    actor.role === "PATIENT"
      ? eq(phiAccessLogs.patientId, actor.patientId ?? "00000000-0000-0000-0000-000000000000")
      : eq(phiAccessLogs.actorId, actor.id);
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(phiAccessLogs)
      .where(where)
      .orderBy(desc(phiAccessLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(phiAccessLogs).where(where),
  ]);
  return { rows, total: Number(totals?.value ?? 0) };
};

export interface AuditLogFilters {
  module?: string | undefined;
  level?: string | undefined;
  actorId?: string | undefined;
  search: string;
  pageSize: number;
  offset: number;
}

export const listAuditLogs = async (
  actor: Actor,
  filters: AuditLogFilters,
): Promise<PagedRows<typeof auditLogs.$inferSelect>> => {
  requirePermission(actor, "audit:read");
  const conditions = [];
  if (filters.module) conditions.push(eq(auditLogs.module, filters.module));
  if (filters.level) conditions.push(sql`${auditLogs.level} = ${filters.level}`);
  if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
  if (filters.search) {
    conditions.push(
      or(ilike(auditLogs.action, `%${filters.search}%`), ilike(auditLogs.entityId, `%${filters.search}%`))!,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters.pageSize)
      .offset(filters.offset),
    db.select({ value: count() }).from(auditLogs).where(where),
  ]);
  return { rows, total: Number(totals?.value ?? 0) };
};

/** Common allergen pick-list for the patient-reported allergy form. */
const COMMON_ALLERGENS = [
  "Penicillin",
  "Amoxicillin",
  "Cephalosporins",
  "Sulfa drugs",
  "Aspirin",
  "Ibuprofen",
  "Codeine",
  "Morphine",
  "Latex",
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Eggs",
  "Milk",
  "Soy",
  "Wheat",
  "Iodine contrast",
  "Bee stings",
  "Pollen",
  "Dust mites",
];

export const listAllergenReference = (search: string) =>
  COMMON_ALLERGENS.filter((a) => !search || a.toLowerCase().includes(search.toLowerCase())).map((name) => ({ name }));

export const listIcd10 = async (search: string, pageSize: number, offset: number) => {
  const where = search
    ? or(ilike(icd10Codes.code, `${search}%`), ilike(icd10Codes.description, `%${search}%`))
    : undefined;
  const limit = Math.min(pageSize, 50);
  const [rows, [totals]] = await Promise.all([
    db.select().from(icd10Codes).where(where).orderBy(asc(icd10Codes.code)).limit(limit).offset(offset),
    db.select({ value: count() }).from(icd10Codes).where(where),
  ]);
  return { rows, total: Number(totals?.value ?? 0), pageSize: limit };
};

export const listDrugReference = async (search: string, pageSize: number, offset: number) => {
  const where = search
    ? or(ilike(drugs.name, `%${search}%`), ilike(drugs.genericName, `%${search}%`))
    : undefined;
  const [rows, [totals]] = await Promise.all([
    db.select().from(drugs).where(where).orderBy(asc(drugs.name)).limit(pageSize).offset(offset),
    db.select({ value: count() }).from(drugs).where(where),
  ]);
  return { rows, total: Number(totals?.value ?? 0) };
};
