import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { nursingAssignments } from "../db/schema/clinical.js";
import { patients } from "../db/schema/patients.js";
import type { Actor } from "./authorize.js";
import { assertPatientScope } from "./authorize.js";

/**
 * Clinical-record scope. This is deliberately stricter than "any staff member":
 * a clinician only reaches a chart they are actually responsible for. Roles
 * whose workflow is keyed by an order (pharmacy, laboratory, billing) never use
 * these endpoints; their handlers resolve the patient from the order itself.
 */
export const canReadClinicalPatient = async (actor: Actor, patientId: string): Promise<boolean> => {
  if (actor.role === "PATIENT") return actor.patientId === patientId;
  if (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN") return true;
  if (actor.role === "DOCTOR") {
    if (!actor.doctorId) return false;
    const [row] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          sql`(
            ${patients.primaryDoctorId} = ${actor.doctorId}
            or exists (select 1 from hms.doctor_panel p where p.patient_id = ${patients.id} and p.doctor_id = ${actor.doctorId} and p.active)
            or exists (select 1 from hms.encounter e where e.patient_id = ${patients.id} and e.doctor_id = ${actor.doctorId})
            or exists (select 1 from hms.appointment a where a.patient_id = ${patients.id} and a.doctor_id = ${actor.doctorId})
            or exists (select 1 from hms.admission ad where ad.patient_id = ${patients.id} and ad.attending_doctor_id = ${actor.doctorId})
          )`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  if (actor.role === "NURSE") {
    const [row] = await db
      .select({ id: nursingAssignments.id })
      .from(nursingAssignments)
      .where(
        and(
          eq(nursingAssignments.nurseId, actor.id),
          eq(nursingAssignments.patientId, patientId),
          eq(nursingAssignments.active, true),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  return false;
};

export const assertClinicalScope = async (actor: Actor, patientId: string): Promise<void> => {
  assertPatientScope(await canReadClinicalPatient(actor, patientId));
};

/** Resolve the caller's own patient id or fail closed. */
export const selfPatientId = (actor: Actor): string => {
  assertPatientScope(Boolean(actor.patientId) && actor.role === "PATIENT");
  return actor.patientId as string;
};

export const patientExists = async (patientId: string): Promise<boolean> => {
  const [row] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return Boolean(row);
};
