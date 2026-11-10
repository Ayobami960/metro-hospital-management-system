import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  emergencyContacts,
  patientAllergies,
  patientConsents,
  patientInsurance,
  patientProblems,
  patientProfileDrafts,
  patients,
  staffProfiles,
  users,
} from "../db/schema/index.js";
import { doctors, departments, specialties } from "../db/schema/reference.js";
import { files } from "../db/schema/audit.js";
import type { UserRole } from "../db/schema/enums.js";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
import { AppError, badRequest, conflict, notFound } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

/**
 * Patient registration + mandatory profile completion, and staff onboarding.
 *
 * Self-registration saves the supplied patient record immediately but leaves
 * `onboarding_completed_at` null. The same data is returned to the completion
 * wizard for review; only the final authenticated completion marks onboarding
 * complete. Administrator-created/invited patients go straight through the same
 * completion path, so they cannot bypass it.
 */

export type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "PREFER_NOT_TO_SAY";
export type SexAtBirth = "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN";
export type Relationship = "SPOUSE" | "PARENT" | "CHILD" | "SIBLING" | "GUARDIAN" | "OTHER";

export interface EmergencyContactInput {
  name: string;
  relationship: Relationship;
  phone: string;
}

export interface InsuranceInput {
  providerName: string;
  planName?: string | null | undefined;
  policyNumber: string;
  memberId?: string | null | undefined;
  groupNumber?: string | null | undefined;
}

export interface ConsentsInput {
  terms: boolean;
  privacy: boolean;
  hipaa: boolean;
}

export interface PatientProfileInput {
  firstName: string;
  lastName: string;
  middleName?: string | null | undefined;
  dateOfBirth: string;
  gender?: Gender | undefined;
  sexAtBirth?: SexAtBirth | undefined;
  bloodType?:
    | "A_POS"
    | "A_NEG"
    | "B_POS"
    | "B_NEG"
    | "AB_POS"
    | "AB_NEG"
    | "O_POS"
    | "O_NEG"
    | "UNKNOWN"
    | undefined;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null | undefined;
  city: string;
  state: string;
  postalCode: string;
  emergencyContact?: EmergencyContactInput | undefined;
  allergies?: string[] | undefined;
  conditions?: string[] | undefined;
  insurance?: InsuranceInput | undefined;
  consents: ConsentsInput;
}

export interface StaffProfileInput {
  title: string;
  licenseNumber?: string | null | undefined;
  employeeId?: string | null | undefined;
  ward?: string | null | undefined;
  departmentId?: string | null | undefined;
  specialtyId?: string | null | undefined;
}

export interface RegistrationInput {
  patient: PatientProfileInput;
}

export interface PatientDraftInput {
  step?: number | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  middleName?: string | undefined;
  dateOfBirth?: string | undefined;
  gender?: Gender | undefined;
  bloodType?: PatientProfileInput["bloodType"] | undefined;
  phone?: string | undefined;
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
  emergencyContact?:
    | {
        name?: string | undefined;
        relationship?: Relationship | undefined;
        phone?: string | undefined;
      }
    | undefined;
  allergies?: string[] | undefined;
  conditions?: string[] | undefined;
  insurance?:
    | {
        providerName?: string | undefined;
        planName?: string | undefined;
        policyNumber?: string | undefined;
        memberId?: string | undefined;
        groupNumber?: string | undefined;
      }
    | undefined;
  consents?:
    | {
        terms?: boolean | undefined;
        privacy?: boolean | undefined;
        hipaa?: boolean | undefined;
      }
    | undefined;
}

export interface OnboardingInput {
  name: string;
  phone: string;
  image?: string | null | undefined;
  patient?: PatientProfileInput | undefined;
  staff?: StaffProfileInput | undefined;
}

const cleanList = (values: string[] | undefined): string[] =>
  [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 50);

const dateProblem = (value: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid date of birth.";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed > new Date()) return "Enter a valid date of birth.";
  return null;
};

const deriveSexAtBirth = (input: PatientProfileInput): SexAtBirth => {
  if (input.sexAtBirth) return input.sexAtBirth;
  if (input.gender === "MALE") return "MALE";
  if (input.gender === "FEMALE") return "FEMALE";
  return "UNKNOWN";
};

const assertPatientProfile = (input: PatientProfileInput, requireConsents: boolean): void => {
  if (!input.firstName.trim() || !input.lastName.trim()) {
    throw badRequest("Enter the patient's first and last name.");
  }
  const problem = dateProblem(input.dateOfBirth);
  if (problem) throw badRequest(problem);
  if (!input.gender && !input.sexAtBirth) throw badRequest("Select a gender.");
  if (input.phone.replace(/\D/g, "").length < 7) throw badRequest("Enter a valid phone number.");
  if (!input.addressLine1.trim() || !input.city.trim() || !input.state.trim() || !input.postalCode.trim()) {
    throw badRequest("Enter the patient's full address.");
  }
  if (input.emergencyContact) {
    const contact = input.emergencyContact;
    if (!contact.name.trim() || contact.phone.replace(/\D/g, "").length < 7) {
      throw badRequest("Enter a valid emergency contact name and phone number.");
    }
  }
  if (input.insurance) {
    if (!input.insurance.providerName.trim() || !input.insurance.policyNumber.trim()) {
      throw badRequest("Enter the insurance provider and policy number, or leave insurance blank.");
    }
  }
  if (requireConsents && (!input.consents.terms || !input.consents.privacy || !input.consents.hipaa)) {
    throw badRequest("Accept the Terms, Privacy Policy and HIPAA notice to continue.");
  }
};

const nextMrn = async (tx: Tx): Promise<string> => {
  const result = await tx.execute<{ mrn: string }>(
    sql`select 'MRN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('hms.patient_mrn_seq')::text, 6, '0') as mrn`,
  );
  const row = result.rows[0];
  if (!row?.mrn) throw new AppError("INTERNAL_ERROR", "MRN sequence unavailable");
  return row.mrn;
};

const savePatientProfile = async (
  userId: string,
  input: PatientProfileInput,
  options: { complete: boolean; ip?: string | undefined },
): Promise<void> => {
  assertPatientProfile(input, true);

  const now = new Date();
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw notFound("Account not found");
    if (user.role !== "PATIENT") throw badRequest("Only patient accounts have a patient profile.");

    const [existing] = await tx
      .select({ id: patients.id, mrn: patients.mrn })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    const patientValues = {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      middleName: input.middleName?.trim() || null,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender ?? null,
      sexAtBirth: deriveSexAtBirth(input),
      ...(input.bloodType ? { bloodType: input.bloodType } : {}),
      phone: input.phone.trim(),
      email: user.email,
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      postalCode: input.postalCode.trim(),
      userId,
      updatedAt: now,
    };

    let patientId: string;
    if (existing) {
      patientId = existing.id;
      await tx.update(patients).set(patientValues).where(eq(patients.id, existing.id));
    } else {
      const mrn = await nextMrn(tx);
      const [row] = await tx
        .insert(patients)
        .values({ mrn, ...patientValues, status: "ACTIVE", createdBy: userId })
        .returning({ id: patients.id });
      if (!row) throw new AppError("INTERNAL_ERROR", "Patient profile could not be created.");
      patientId = row.id;
    }

    // A completed profile supersedes any saved wizard draft.
    await tx.delete(patientProfileDrafts).where(eq(patientProfileDrafts.userId, userId));

    // Registration uploads made before the patient row existed are attached now.
    await tx
      .update(files)
      .set({ patientId, ownerId: patientId })
      .where(
        and(
          eq(files.uploadedBy, userId),
          eq(files.ownerType, "PATIENT"),
          isNull(files.patientId),
        ),
      );

    if (input.emergencyContact) {
      await tx
        .delete(emergencyContacts)
        .where(and(eq(emergencyContacts.patientId, patientId), eq(emergencyContacts.isPrimary, true)));
      await tx.insert(emergencyContacts).values({
        patientId,
        name: input.emergencyContact.name.trim(),
        relationship: input.emergencyContact.relationship,
        phone: input.emergencyContact.phone.trim(),
        isPrimary: true,
      });
    }

    const allergyNames = cleanList(input.allergies);
    await tx
      .delete(patientAllergies)
      .where(
        and(
          eq(patientAllergies.patientId, patientId),
          eq(patientAllergies.source, "PATIENT_REPORTED"),
          eq(patientAllergies.recordedBy, userId),
        ),
      );
    if (allergyNames.length > 0) {
      await tx.insert(patientAllergies).values(
        allergyNames.map((allergen) => ({
          patientId,
          allergen,
          severity: "MODERATE" as const,
          status: "ACTIVE" as const,
          active: true,
          source: "PATIENT_REPORTED" as const,
          recordedBy: userId,
        })),
      );
    }
    await tx
      .update(patients)
      .set({ noKnownAllergies: allergyNames.length === 0, updatedAt: now })
      .where(eq(patients.id, patientId));

    const conditionNames = cleanList(input.conditions);
    await tx
      .delete(patientProblems)
      .where(
        and(
          eq(patientProblems.patientId, patientId),
          eq(patientProblems.source, "PATIENT_REPORTED"),
          eq(patientProblems.recordedBy, userId),
        ),
      );
    if (conditionNames.length > 0) {
      await tx.insert(patientProblems).values(
        conditionNames.map((diagnosis) => ({
          patientId,
          diagnosis,
          status: "ACTIVE" as const,
          source: "PATIENT_REPORTED" as const,
          recordedBy: userId,
          notes: "Self-reported during onboarding",
        })),
      );
    }

    if (input.insurance) {
      const [existingInsurance] = await tx
        .select({ id: patientInsurance.id })
        .from(patientInsurance)
        .where(and(eq(patientInsurance.patientId, patientId), isNull(patientInsurance.insurerId)))
        .limit(1);
      const values = {
        providerName: input.insurance.providerName.trim(),
        planName: input.insurance.planName?.trim() || null,
        policyNumber: input.insurance.policyNumber.trim(),
        memberId: input.insurance.memberId?.trim() || null,
        groupNumber: input.insurance.groupNumber?.trim() || null,
        verificationStatus: "UNVERIFIED",
        updatedAt: now,
      };
      if (existingInsurance) {
        await tx.update(patientInsurance).set(values).where(eq(patientInsurance.id, existingInsurance.id));
      } else {
        await tx.insert(patientInsurance).values({ patientId, ...values, isPrimary: true });
      }
    }

    await tx
      .delete(patientConsents)
      .where(
        and(
          eq(patientConsents.patientId, patientId),
          eq(patientConsents.recordedBy, userId),
          inArray(patientConsents.kind, ["TERMS", "PRIVACY", "HIPAA"]),
        ),
      );
    await tx.insert(patientConsents).values(
      (["TERMS", "PRIVACY", "HIPAA"] as const).map((kind) => ({
        patientId,
        kind,
        granted: true,
        recordedBy: userId,
      })),
    );

    await tx
      .update(users)
      .set({
        name: `${input.firstName.trim()} ${input.lastName.trim()}`,
        phone: input.phone.trim(),
        ...(options.complete ? { onboardingCompletedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  });

  await writeAudit({
    actorId: userId,
    actorRole: "PATIENT",
    action: options.complete ? "auth.onboarding.completed" : "auth.registration.profile_saved",
    module: "identity",
    entityType: "user",
    entityId: userId,
    level: "SUCCESS",
    ip: options.ip,
  });
};

export const savePatientRegistration = async (
  userId: string,
  input: PatientProfileInput,
  ip?: string,
): Promise<void> => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Account not found");
  if (user.role !== "PATIENT") throw badRequest("Only patients use patient registration.");
  if (user.emailVerified) throw conflict("This account is already verified.");
  if (user.onboardingCompletedAt) throw conflict("This profile is already complete.");

  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  if (existing) {
    throw conflict("The registration profile was already saved. Verify your email to continue.");
  }

  await savePatientProfile(userId, input, { complete: false, ip });
};

/**
 * Saves in-progress wizard data without creating a patient record and without
 * completing onboarding. One row per account, so it follows the patient to any
 * device. Clinical tables are only written by the final submission.
 */
export const savePatientDraft = async (
  userId: string,
  input: PatientDraftInput,
): Promise<{ updatedAt: Date }> => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Account not found");
  if (user.role !== "PATIENT") throw badRequest("Only patient accounts have a patient profile draft.");
  if (user.onboardingCompletedAt) {
    throw conflict("Your profile is already complete.");
  }

  const now = new Date();
  const data = input as Record<string, unknown>;
  const [row] = await db
    .insert(patientProfileDrafts)
    .values({ userId, data })
    .onConflictDoUpdate({
      target: patientProfileDrafts.userId,
      set: { data, updatedAt: now },
    })
    .returning({ updatedAt: patientProfileDrafts.updatedAt });
  if (!row) throw new AppError("INTERNAL_ERROR", "Your draft could not be saved.");
  return { updatedAt: row.updatedAt };
};

export const getOnboarding = async (userId: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Account not found");

  const [patient] = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      middleName: patients.middleName,
      dateOfBirth: patients.dateOfBirth,
      gender: patients.gender,
      sexAtBirth: patients.sexAtBirth,
      bloodType: patients.bloodType,
      phone: patients.phone,
      addressLine1: patients.addressLine1,
      addressLine2: patients.addressLine2,
      city: patients.city,
      state: patients.state,
      postalCode: patients.postalCode,
      mrn: patients.mrn,
    })
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  const patientDetails = patient
    ? await (async () => {
        const [contact] = await db
          .select({
            name: emergencyContacts.name,
            relationship: emergencyContacts.relationship,
            phone: emergencyContacts.phone,
          })
          .from(emergencyContacts)
          .where(eq(emergencyContacts.patientId, patient.id))
          .orderBy(desc(emergencyContacts.isPrimary), desc(emergencyContacts.createdAt))
          .limit(1);

        const allergies = await db
          .select({ allergen: patientAllergies.allergen })
          .from(patientAllergies)
          .where(and(eq(patientAllergies.patientId, patient.id), eq(patientAllergies.source, "PATIENT_REPORTED")));
        const conditions = await db
          .select({ diagnosis: patientProblems.diagnosis })
          .from(patientProblems)
          .where(and(eq(patientProblems.patientId, patient.id), eq(patientProblems.source, "PATIENT_REPORTED")));
        const [insurance] = await db
          .select({
            providerName: patientInsurance.providerName,
            planName: patientInsurance.planName,
            policyNumber: patientInsurance.policyNumber,
            memberId: patientInsurance.memberId,
            groupNumber: patientInsurance.groupNumber,
          })
          .from(patientInsurance)
          .where(eq(patientInsurance.patientId, patient.id))
          .orderBy(desc(patientInsurance.isPrimary), desc(patientInsurance.createdAt))
          .limit(1);
        const consents = await db
          .select({ kind: patientConsents.kind, granted: patientConsents.granted })
          .from(patientConsents)
          .where(eq(patientConsents.patientId, patient.id));
        const documents = await db
          .select({
            id: files.id,
            fileName: files.fileName,
            contentType: files.contentType,
            sizeBytes: files.sizeBytes,
            createdAt: files.createdAt,
          })
          .from(files)
          .where(and(eq(files.patientId, patient.id), isNull(files.deletedAt)))
          .orderBy(desc(files.createdAt));

        return {
          ...patient,
          emergencyContact: contact ?? null,
          allergies: allergies.map((row) => row.allergen),
          conditions: conditions.map((row) => row.diagnosis),
          insurance: insurance?.providerName ? insurance : null,
          consents: {
            terms: consents.some((row) => row.kind === "TERMS" && row.granted),
            privacy: consents.some((row) => row.kind === "PRIVACY" && row.granted),
            hipaa: consents.some((row) => row.kind === "HIPAA" && row.granted),
          },
          documents: documents.map((row) => ({
            ...row,
            downloadUrl: `/api/v1/files/${row.id}/download`,
          })),
        };
      })()
    : null;

  const [staff] = await db
    .select({
      title: staffProfiles.title,
      licenseNumber: staffProfiles.licenseNumber,
      employeeId: staffProfiles.employeeId,
      ward: staffProfiles.ward,
      departmentId: staffProfiles.departmentId,
      specialtyId: staffProfiles.specialtyId,
      departmentName: departments.name,
      specialtyName: specialties.name,
    })
    .from(staffProfiles)
    .leftJoin(departments, eq(staffProfiles.departmentId, departments.id))
    .leftJoin(specialties, eq(staffProfiles.specialtyId, specialties.id))
    .where(eq(staffProfiles.userId, userId))
    .limit(1);

  const [doctor] = user.role === "DOCTOR"
    ? await db
        .select({
          id: doctors.id,
          departmentId: doctors.departmentId,
          specialtyId: doctors.specialtyId,
          licenseNumber: doctors.licenseNumber,
        })
        .from(doctors)
        .where(eq(doctors.userId, userId))
        .limit(1)
    : [];

  const [draft] = await db
    .select({ data: patientProfileDrafts.data, updatedAt: patientProfileDrafts.updatedAt })
    .from(patientProfileDrafts)
    .where(eq(patientProfileDrafts.userId, userId))
    .limit(1);

  return {
    completed: Boolean(user.onboardingCompletedAt),
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    image: user.image,
    draft: draft ?? null,
    patient: patientDetails,
    staff: staff
      ? {
          ...staff,
          departmentId: doctor?.departmentId ?? staff.departmentId,
          specialtyId: doctor?.specialtyId ?? staff.specialtyId,
          licenseNumber: doctor?.licenseNumber ?? staff.licenseNumber,
        }
      : doctor
        ? {
            title: null,
            licenseNumber: doctor.licenseNumber,
            employeeId: null,
            ward: null,
            departmentId: doctor.departmentId,
            specialtyId: doctor.specialtyId,
            departmentName: null,
            specialtyName: null,
          }
        : null,
    required: {
      patient: user.role === "PATIENT",
      staff: user.role !== "PATIENT",
      license: user.role === "DOCTOR" || user.role === "NURSE",
    },
  };
};

export const completeOnboarding = async (
  userId: string,
  input: OnboardingInput,
  ip?: string,
): Promise<{ completed: true; role: UserRole }> => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Account not found");
  if (user.onboardingCompletedAt) {
    return { completed: true, role: user.role };
  }
  if (!user.emailVerified) {
    throw badRequest("Verify your email address before completing your profile.");
  }

  if (!input.name.trim() || input.phone.replace(/\D/g, "").length < 7) {
    throw badRequest("Your name and phone number are required.");
  }

  if (user.role === "PATIENT") {
    if (!input.patient) throw badRequest("Patient profile details are required.");
    await savePatientProfile(userId, input.patient, { complete: true, ip });
    return { completed: true, role: user.role };
  }

  const staff = input.staff;
  if (!staff?.title?.trim()) throw badRequest("Your job title is required.");
  if (
    (user.role === "DOCTOR" || user.role === "NURSE") &&
    !staff.licenseNumber?.trim()
  ) {
    throw badRequest("Your professional license number is required.");
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: staffProfiles.id })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, userId))
      .limit(1);
    const values = {
      title: staff.title.trim(),
      licenseNumber: staff.licenseNumber?.trim() || null,
      employeeId: staff.employeeId?.trim() || null,
      ward: staff.ward?.trim() || null,
      departmentId: staff.departmentId || null,
      specialtyId: staff.specialtyId || null,
    };
    if (existing) {
      await tx.update(staffProfiles).set({ ...values, updatedAt: now }).where(eq(staffProfiles.id, existing.id));
    } else {
      await tx.insert(staffProfiles).values({ userId, ...values });
    }

    if (user.role === "DOCTOR") {
      const [existingDoctor] = await tx
        .select({ id: doctors.id })
        .from(doctors)
        .where(eq(doctors.userId, userId))
        .limit(1);
      const doctorValues = {
        departmentId: staff.departmentId || null,
        specialtyId: staff.specialtyId || null,
        licenseNumber: staff.licenseNumber!.trim(),
        status: "ACTIVE" as const,
      };
      if (existingDoctor) {
        await tx.update(doctors).set({ ...doctorValues, updatedAt: now }).where(eq(doctors.id, existingDoctor.id));
      } else {
        await tx.insert(doctors).values({ userId, ...doctorValues });
      }
    }

    await tx
      .update(users)
      .set({
        name: input.name.trim(),
        phone: input.phone.trim(),
        ...(input.image !== undefined ? { image: input.image } : {}),
        onboardingCompletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  });

  await writeAudit({
    actorId: userId,
    actorRole: user.role,
    action: "auth.onboarding.completed",
    module: "identity",
    entityType: "user",
    entityId: userId,
    level: "SUCCESS",
    ip,
  });

  return { completed: true, role: user.role };
};

