import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { patients, staffProfiles, users } from "../db/schema/index.js";
import type { UserRole } from "../db/schema/enums.js";
import { AppError, badRequest, notFound } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";

/**
 * Mandatory first-login profile completion.
 *
 * The account gate refuses every dashboard endpoint until this has been
 * submitted, so a freshly verified patient or invited staff member cannot skip
 * onboarding by navigating directly.
 */

export type SexAtBirth = "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN";

export interface OnboardingInput {
  name: string;
  phone: string;
  image?: string | null | undefined;
  patient?:
    | {
        firstName: string;
        lastName: string;
        middleName?: string | null | undefined;
        dateOfBirth: string;
        sexAtBirth: SexAtBirth;
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
        addressLine1: string;
        addressLine2?: string | null | undefined;
        city: string;
        state: string;
        postalCode: string;
      }
    | undefined;
  staff?:
    | {
        title: string;
        licenseNumber?: string | null | undefined;
        employeeId?: string | null | undefined;
        ward?: string | null | undefined;
        departmentId?: string | null | undefined;
      }
    | undefined;
}

export const getOnboarding = async (userId: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Account not found");

  const [patient] = await db
    .select({
      firstName: patients.firstName,
      lastName: patients.lastName,
      middleName: patients.middleName,
      dateOfBirth: patients.dateOfBirth,
      sexAtBirth: patients.sexAtBirth,
      bloodType: patients.bloodType,
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

  const [staff] = await db
    .select({
      title: staffProfiles.title,
      licenseNumber: staffProfiles.licenseNumber,
      employeeId: staffProfiles.employeeId,
      ward: staffProfiles.ward,
      departmentId: staffProfiles.departmentId,
    })
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, userId))
    .limit(1);

  return {
    completed: Boolean(user.onboardingCompletedAt),
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    image: user.image,
    patient: patient ?? null,
    staff: staff ?? null,
    required: {
      patient: user.role === "PATIENT",
      staff: user.role !== "PATIENT",
      license: user.role === "DOCTOR" || user.role === "NURSE",
    },
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

  if (!input.name.trim() || !input.phone.trim()) {
    throw badRequest("Your name and phone number are required.");
  }

  if (user.role === "PATIENT") {
    const patient = input.patient;
    if (!patient) throw badRequest("Patient profile details are required.");
    if (!patient.firstName.trim() || !patient.lastName.trim()) {
      throw badRequest("Enter your first and last name.");
    }
    if (!patient.dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(patient.dateOfBirth)) {
      throw badRequest("Enter a valid date of birth.");
    }
    if (!patient.addressLine1.trim() || !patient.city.trim() || !patient.state.trim() || !patient.postalCode.trim()) {
      throw badRequest("Your address is required.");
    }

    const [existing] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    const now = new Date();
    if (existing) {
      await db
        .update(patients)
        .set({
          firstName: patient.firstName.trim(),
          lastName: patient.lastName.trim(),
          middleName: patient.middleName?.trim() || null,
          dateOfBirth: patient.dateOfBirth,
          sexAtBirth: patient.sexAtBirth,
          ...(patient.bloodType ? { bloodType: patient.bloodType } : {}),
          addressLine1: patient.addressLine1.trim(),
          addressLine2: patient.addressLine2?.trim() || null,
          city: patient.city.trim(),
          state: patient.state.trim(),
          postalCode: patient.postalCode.trim(),
          phone: input.phone.trim(),
          email: user.email,
          updatedAt: now,
        })
        .where(eq(patients.id, existing.id));
    } else {
      const mrn = await nextMrn();
      await db.insert(patients).values({
        mrn,
        firstName: patient.firstName.trim(),
        lastName: patient.lastName.trim(),
        middleName: patient.middleName?.trim() || null,
        dateOfBirth: patient.dateOfBirth,
        sexAtBirth: patient.sexAtBirth,
        bloodType: patient.bloodType ?? "UNKNOWN",
        phone: input.phone.trim(),
        email: user.email,
        addressLine1: patient.addressLine1.trim(),
        addressLine2: patient.addressLine2?.trim() || null,
        city: patient.city.trim(),
        state: patient.state.trim(),
        postalCode: patient.postalCode.trim(),
        status: "ACTIVE",
        userId,
        createdBy: userId,
      });
    }
  } else {
    const staff = input.staff;
    if (!staff?.title?.trim()) throw badRequest("Your job title is required.");
    if (
      (user.role === "DOCTOR" || user.role === "NURSE") &&
      !staff.licenseNumber?.trim()
    ) {
      throw badRequest("Your professional license number is required.");
    }

    const [existing] = await db
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
    };
    if (existing) {
      await db
        .update(staffProfiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(staffProfiles.id, existing.id));
    } else {
      await db.insert(staffProfiles).values({ userId, ...values });
    }
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      name: input.name.trim(),
      phone: input.phone.trim(),
      ...(input.image !== undefined ? { image: input.image } : {}),
      onboardingCompletedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

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
