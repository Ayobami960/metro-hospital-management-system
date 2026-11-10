import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  departments,
  doctors,
  hospitalSettings,
  notificationPreferences,
  patients,
  sessions,
  specialties,
  staffProfiles,
  users,
} from "../db/schema/index.js";
import { AppError, notFound } from "../lib/http.js";
import { initials } from "../lib/crypto.js";
import { ageFromDob } from "../lib/time.js";

/**
 * Self-service account settings: the signed-in user's profile, their
 * notification preferences, the list of live sessions (the "devices" card) and
 * the hospital-wide settings block the administration console edits.
 */

export const getProfile = async (userId: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Account not found");

  const [doctorRow] = await db
    .select({
      id: doctors.id,
      licenseNumber: doctors.licenseNumber,
      licenseExpiry: doctors.licenseExpiry,
      credentials: doctors.credentials,
      bio: doctors.bio,
      status: doctors.status,
      department: departments.name,
      specialty: specialties.name,
      consultationFeeMinor: doctors.consultationFeeMinor,
    })
    .from(doctors)
    .leftJoin(departments, eq(doctors.departmentId, departments.id))
    .leftJoin(specialties, eq(doctors.specialtyId, specialties.id))
    .where(eq(doctors.userId, userId))
    .limit(1);

  const [patientRow] = await db
    .select({
      id: patients.id,
      mrn: patients.mrn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      sexAtBirth: patients.sexAtBirth,
      bloodType: patients.bloodType,
      phone: patients.phone,
      email: patients.email,
      addressLine1: patients.addressLine1,
      city: patients.city,
      state: patients.state,
      postalCode: patients.postalCode,
      status: patients.status,
    })
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  const [staffRow] = await db
    .select({
      title: staffProfiles.title,
      employeeId: staffProfiles.employeeId,
      ward: staffProfiles.ward,
      department: departments.name,
    })
    .from(staffProfiles)
    .leftJoin(departments, eq(staffProfiles.departmentId, departments.id))
    .where(eq(staffProfiles.userId, userId))
    .limit(1);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    image: user.image,
    role: user.role,
    status: user.status,
    twoFactorEnabled: user.twoFactorEnabled,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    memberSince: user.createdAt,
    avatarInitials: initials(user.name),
    doctor: doctorRow ?? null,
    patient: patientRow
      ? { ...patientRow, age: ageFromDob(patientRow.dateOfBirth), name: `${patientRow.firstName} ${patientRow.lastName}` }
      : null,
    staff: staffRow ?? null,
  };
};

export const updateProfile = async (
  userId: string,
  input: { name?: string | undefined; phone?: string | null | undefined; image?: string | null | undefined },
) => {
  const [row] = await db
    .update(users)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  if (!row) throw notFound("Account not found");
  return { id: row.id, name: row.name, phone: row.phone, image: row.image, avatarInitials: initials(row.name) };
};

export const getNotificationPreferences = async (userId: string) => {
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (row) return row;

  // First read creates the defaults the schema declares, so the settings screen
  // always has a row to edit without any seeded data.
  const [createdRow] = await db.insert(notificationPreferences).values({ userId }).returning();
  if (!createdRow) throw new AppError("INTERNAL_ERROR", "Could not create notification preferences");
  return createdRow;
};

export const updateNotificationPreferences = async (
  userId: string,
  input: {
    appointments?: boolean | undefined;
    labResults?: boolean | undefined;
    prescriptions?: boolean | undefined;
    bills?: boolean | undefined;
    messages?: boolean | undefined;
    emailChannel?: boolean | undefined;
    smsChannel?: boolean | undefined;
    pushChannel?: boolean | undefined;
    privacyShareForResearch?: boolean | undefined;
    privacyShareWithFamily?: boolean | undefined;
    privacyAnalytics?: boolean | undefined;
  },
) => {
  await getNotificationPreferences(userId);
  const [row] = await db
    .update(notificationPreferences)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(notificationPreferences.userId, userId))
    .returning();
  if (!row) throw notFound("Notification preferences not found");
  return row;
};

export const listSessions = async (userId: string) => {
  const rows = await db
    .select({
      id: sessions.id,
      deviceName: sessions.deviceName,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .orderBy(desc(sessions.lastSeenAt));
  return rows;
};

export const revokeSession = async (userId: string, sessionId: string) => {
  const [row] = await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokeReason: "User revoked from settings" })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({ id: sessions.id, revokedAt: sessions.revokedAt });
  if (!row) throw notFound("Session not found");
  return row;
};

export const revokeOtherSessions = async (userId: string, keepSessionId?: string) => {
  const rows = await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokeReason: "Signed out of other devices" })
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        keepSessionId ? ne(sessions.id, keepSessionId) : sql`true`,
      ),
    )
    .returning({ id: sessions.id });
  return { revoked: rows.length };
};

export const getHospitalSettings = async () => {
  const [row] = await db.select().from(hospitalSettings).where(eq(hospitalSettings.id, 1)).limit(1);
  if (!row) {
    return {
      id: 1,
      name: "Metro General Hospital",
      addressLine1: null,
      city: null,
      state: null,
      postalCode: null,
      phone: null,
      email: null,
      timezone: "America/New_York",
      currency: "USD",
      mrnPrefix: "MRN",
      invoiceDueDays: 30,
      nearExpiryDays: 90,
      auditRetentionYears: 7,
      settings: {},
    };
  }
  return row;
};

export const updateHospitalSettings = async (
  input: {
    name?: string | undefined;
    addressLine1?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    postalCode?: string | null | undefined;
    phone?: string | null | undefined;
    email?: string | null | undefined;
    timezone?: string | undefined;
    currency?: string | undefined;
    mrnPrefix?: string | undefined;
    invoiceDueDays?: number | undefined;
    nearExpiryDays?: number | undefined;
    auditRetentionYears?: number | undefined;
    settings?: Record<string, unknown> | undefined;
  },
) => {
  const [existing] = await db.select({ id: hospitalSettings.id }).from(hospitalSettings).where(eq(hospitalSettings.id, 1)).limit(1);
  if (!existing) {
    const [row] = await db
      .insert(hospitalSettings)
      .values({
        name: input.name ?? "Metro General Hospital",
        timezone: input.timezone ?? "America/New_York",
        currency: input.currency ?? "USD",
        addressLine1: input.addressLine1 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        mrnPrefix: input.mrnPrefix ?? "MRN",
        invoiceDueDays: input.invoiceDueDays ?? 30,
        nearExpiryDays: input.nearExpiryDays ?? 90,
        auditRetentionYears: input.auditRetentionYears ?? 7,
        settings: input.settings ?? {},
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Settings insert failed");
    return row;
  }

  const [row] = await db
    .update(hospitalSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(hospitalSettings.id, 1))
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Settings update failed");
  return row;
};
