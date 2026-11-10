import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { patientInsurance, patientPanel, patients } from "../db/schema/patients.js";
import { doctors, insurancePlans, insurers } from "../db/schema/reference.js";
import { writeAudit, writePhiAccess } from "../lib/audit.js";
import type { Actor } from "../lib/authorize.js";
import { AppError, notFound } from "../lib/http.js";
import { decryptField, encryptField, maskSsn } from "../lib/crypto.js";
import { ageFromDob, bmi } from "../lib/time.js";

/**
 * Patient registration and lookup.
 *
 * MRNs come from a database sequence, duplicates are matched on exact
 * case-folded name + DOB, SSN storage is encrypted/masked, and every read of a
 * patient record writes a PHI access row.
 */

export const PATIENT_SORTS = ["createdAt", "lastName", "mrn", "dateOfBirth"] as const;

export interface PatientListOptions {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

export const listPatients = async (actor: Actor, options: PatientListOptions) => {
  const filters = [];
  if (actor.role === "PATIENT") {
    filters.push(eq(patients.id, actor.patientId ?? "00000000-0000-0000-0000-000000000000"));
  }
  if (actor.role === "DOCTOR") {
    filters.push(
      or(
        eq(patients.primaryDoctorId, actor.doctorId ?? "00000000-0000-0000-0000-000000000000"),
        sql`exists (select 1 from hms.doctor_panel p where p.patient_id = ${patients.id} and p.doctor_id = ${actor.doctorId ?? "00000000-0000-0000-0000-000000000000"} and p.active)`,
      )!,
    );
  }
  if (options.search) {
    filters.push(
      or(
        ilike(patients.firstName, `%${options.search}%`),
        ilike(patients.lastName, `%${options.search}%`),
        ilike(patients.mrn, `%${options.search}%`),
        ilike(patients.phone, `%${options.search}%`),
      )!,
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const orderColumn =
    { createdAt: patients.createdAt, lastName: patients.lastName, mrn: patients.mrn, dateOfBirth: patients.dateOfBirth }[
      options.sort
    ] ?? patients.createdAt;

  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(patients)
      .where(where)
      .orderBy(options.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(options.pageSize)
      .offset(options.offset),
    db.select({ value: count() }).from(patients).where(where),
  ]);

  return {
    rows: rows.map((p) => ({
      id: p.id,
      mrn: p.mrn,
      name: `${p.firstName} ${p.lastName}`,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      age: ageFromDob(p.dateOfBirth),
      sexAtBirth: p.sexAtBirth,
      bloodType: p.bloodType,
      phone: p.phone,
      email: p.email,
      status: p.status,
      bmi: bmi(p.weightKg ? Number(p.weightKg) : null, p.heightCm ? Number(p.heightCm) : null),
      ssnLast4: maskSsn(decryptField(p.ssnLast4Enc)),
    })),
    total: Number(totals?.value ?? 0),
  };
};

const nextMrn = async (): Promise<string> => {
  const result = await db.execute<{ mrn: string }>(
    sql`select 'MRN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('hms.patient_mrn_seq')::text, 6, '0') as mrn`,
  );
  const row = result.rows[0];
  if (!row?.mrn) throw new AppError("INTERNAL_ERROR", "MRN sequence unavailable");
  return row.mrn;
};

/**
 * Exact, case-folded name + DOB match. `ilike` is avoided so `%` in user input
 * cannot act as a wildcard.
 */
export const findPatientDuplicates = async (firstName: string, lastName: string, dateOfBirth: string) =>
  db
    .select({
      id: patients.id,
      mrn: patients.mrn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(patients)
    .where(
      and(
        sql`lower(${patients.firstName}) = lower(${firstName})`,
        sql`lower(${patients.lastName}) = lower(${lastName})`,
        eq(patients.dateOfBirth, dateOfBirth),
        ne(patients.status, "MERGED"),
      ),
    )
    .limit(5);

export const getPatient = async (actor: Actor, id: string, ip?: string) => {
  const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  if (!patient || patient.status === "MERGED") throw notFound("Patient not found");
  if (actor.role === "PATIENT" && patient.id !== actor.patientId) throw notFound("Patient not found");
  if (actor.role === "DOCTOR") {
    const [panel] = await db
      .select({ id: patientPanel.id })
      .from(patientPanel)
      .where(and(eq(patientPanel.patientId, patient.id), eq(patientPanel.doctorId, actor.doctorId ?? ""), eq(patientPanel.active, true)))
      .limit(1);
    if (!panel && patient.primaryDoctorId !== actor.doctorId) throw notFound("Patient not found");
  }

  await writePhiAccess({
    actorId: actor.id,
    actorRole: actor.role,
    patientId: patient.id,
    resourceType: "patient",
    resourceId: patient.id,
    ip,
  });

  return {
    id: patient.id,
    mrn: patient.mrn,
    name: `${patient.firstName} ${patient.lastName}`,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    age: ageFromDob(patient.dateOfBirth),
    sexAtBirth: patient.sexAtBirth,
    bloodType: patient.bloodType,
    phone: patient.phone,
    email: patient.email,
    addressLine1: patient.addressLine1,
    city: patient.city,
    state: patient.state,
    postalCode: patient.postalCode,
    heightCm: patient.heightCm ? Number(patient.heightCm) : null,
    weightKg: patient.weightKg ? Number(patient.weightKg) : null,
    bmi: bmi(patient.weightKg ? Number(patient.weightKg) : null, patient.heightCm ? Number(patient.heightCm) : null),
    ssnLast4: maskSsn(decryptField(patient.ssnLast4Enc)),
    status: patient.status,
  };
};

export interface RegisterPatientInput {
  firstName: string;
  lastName: string;
  middleName?: string | undefined;
  dateOfBirth: string;
  sexAtBirth: "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN";
  bloodType: "A_POS" | "A_NEG" | "B_POS" | "B_NEG" | "AB_POS" | "AB_NEG" | "O_POS" | "O_NEG" | "UNKNOWN";
  phone?: string | undefined;
  email?: string | undefined;
  addressLine1?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
  heightCm?: number | undefined;
  weightKg?: number | undefined;
  ssnLast4?: string | undefined;
  primaryDoctorId?: string | undefined;
  insurance?:
    | {
        insurerId: string;
        planId: string;
        policyNumber: string;
        groupNumber?: string | undefined;
        memberId?: string | undefined;
      }
    | undefined;
  allowDuplicate: boolean;
}

export const registerPatient = async (actor: Actor, body: RegisterPatientInput, ip?: string) => {
  const duplicates = await findPatientDuplicates(body.firstName, body.lastName, body.dateOfBirth);
  if (duplicates.length > 0 && !body.allowDuplicate) {
    throw new AppError(
      "DUPLICATE_PATIENT_SUSPECTED",
      "A patient with the same name and date of birth already exists",
      { candidates: duplicates },
    );
  }

  const mrn = await nextMrn();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(patients)
      .values({
        mrn,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName ?? null,
        dateOfBirth: body.dateOfBirth,
        sexAtBirth: body.sexAtBirth,
        bloodType: body.bloodType,
        phone: body.phone ?? null,
        email: body.email ?? null,
        addressLine1: body.addressLine1 ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        postalCode: body.postalCode ?? null,
        heightCm: body.heightCm ? String(body.heightCm) : null,
        weightKg: body.weightKg ? String(body.weightKg) : null,
        ssnLast4Enc: body.ssnLast4 ? encryptField(body.ssnLast4) : null,
        primaryDoctorId: body.primaryDoctorId ?? null,
        createdBy: actor.id,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Patient insert failed");

    if (body.primaryDoctorId) {
      const [doctor] = await tx.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, body.primaryDoctorId)).limit(1);
      if (doctor) await tx.insert(patientPanel).values({ doctorId: doctor.id, patientId: row.id });
    }
    if (body.insurance) {
      await tx.insert(patientInsurance).values({
        patientId: row.id,
        insurerId: body.insurance.insurerId,
        planId: body.insurance.planId,
        policyNumber: body.insurance.policyNumber,
        groupNumber: body.insurance.groupNumber ?? null,
        memberId: body.insurance.memberId ?? null,
      });
    }
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "patient.register",
        module: "patients",
        entityType: "patient",
        entityId: row.id,
        level: "SUCCESS",
        detail: { mrn: row.mrn, duplicatesOverridden: body.allowDuplicate && duplicates.length > 0 },
        ip,
      },
      tx,
    );
    return row;
  });
};

/** Replaces the frontend's random eligibility check (decision 5). */
export const verifyEligibility = async (patientId: string) => {
  const [policy] = await db
    .select({
      id: patientInsurance.id,
      policyNumber: patientInsurance.policyNumber,
      insurer: insurers.name,
      plan: insurancePlans.name,
      copayMinor: insurancePlans.copayMinor,
      coveragePercent: insurancePlans.coveragePercent,
      effectiveFrom: patientInsurance.effectiveFrom,
      effectiveTo: patientInsurance.effectiveTo,
    })
    .from(patientInsurance)
    .innerJoin(insurers, eq(patientInsurance.insurerId, insurers.id))
    .innerJoin(insurancePlans, eq(patientInsurance.planId, insurancePlans.id))
    .where(eq(patientInsurance.patientId, patientId))
    .limit(1);

  if (!policy) {
    return { eligible: false, status: "UNVERIFIED", reason: "No insurance policy on file", copayMinor: 0, currency: "USD" };
  }

  const today = new Date().toISOString().slice(0, 10);
  const active =
    (!policy.effectiveFrom || policy.effectiveFrom <= today) && (!policy.effectiveTo || policy.effectiveTo >= today);

  await db
    .update(patientInsurance)
    .set({
      verificationStatus: active ? "ACTIVE" : "EXPIRED",
      lastVerifiedAt: new Date(),
      lastVerificationDetail: active ? "Policy on file is active" : "Policy is outside its effective dates",
    })
    .where(eq(patientInsurance.id, policy.id));

  return {
    eligible: active,
    status: active ? "ACTIVE" : "EXPIRED",
    insurer: policy.insurer,
    plan: policy.plan,
    policyNumber: policy.policyNumber,
    copayMinor: policy.copayMinor,
    coveragePercent: policy.coveragePercent,
    currency: "USD",
    checkedAt: new Date().toISOString(),
  };
};
