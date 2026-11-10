import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { hms, idColumn, timestamps } from "./namespace.js";
import {
  allergenSource,
  allergySeverity,
  allergyStatus,
  bloodType,
  metricType,
  patientStatus,
  problemSource,
  problemStatus,
  relationship,
  sexAtBirth,
} from "./enums.js";
import { doctors, icd10Codes, insurancePlans, insurers } from "./reference.js";
import { users } from "./identity.js";

/**
 * One patient = one row with one server-generated MRN. Every other table
 * references `patients.id`; `mrn` is display/lookup only.
 */
export const patients = hms.table(
  "patient",
  {
    id: idColumn(),
    mrn: text("mrn").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    middleName: text("middle_name"),
    dateOfBirth: date("date_of_birth").notNull(),
    /** Patient-facing gender identity from self-registration; clinical sex remains below. */
    gender: text("gender"),
    sexAtBirth: sexAtBirth("sex_at_birth").default("UNKNOWN").notNull(),
    bloodType: bloodType("blood_type").default("UNKNOWN").notNull(),
    phone: text("phone"),
    email: text("email"),
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    city: text("city"),
    state: text("state"),
    postalCode: varchar("postal_code", { length: 16 }),
    country: text("country").default("US"),
    heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
    weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
    /** Only the last 4 digits are stored, AES-256-GCM encrypted (decision 14). */
    ssnLast4Enc: text("ssn_last4_enc"),
    primaryDoctorId: uuid("primary_doctor_id").references(() => doctors.id),
    status: patientStatus("status").default("ACTIVE").notNull(),
    /** NKDA flag shown on the chart; cleared automatically when an allergy is added. */
    noKnownAllergies: boolean("no_known_allergies").default(false).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    mergedIntoId: uuid("merged_into_id"),
    notes: text("notes"),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("patient_mrn_uq").on(t.mrn),
    index("patient_name_idx").on(t.lastName, t.firstName),
    index("patient_dob_idx").on(t.dateOfBirth),
    index("patient_phone_idx").on(t.phone),
    index("patient_doctor_idx").on(t.primaryDoctorId),
  ],
);

export const emergencyContacts = hms.table("emergency_contact", {
  id: idColumn(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relationship: relationship("relationship_kind").notNull(),
  phone: text("phone").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  ...timestamps,
});

export const patientAllergies = hms.table(
  "patient_allergy",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    allergen: text("allergen").notNull(),
    reaction: text("reaction"),
    severity: allergySeverity("severity").default("MODERATE").notNull(),
    status: allergyStatus("status").default("ACTIVE").notNull(),
    source: allergenSource("source").default("CLINICIAN").notNull(),
    /** Kept in sync with `status` for callers written before the lifecycle enum. */
    active: boolean("active").default(true).notNull(),
    onsetDate: date("onset_date"),
    notes: text("notes"),
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    recordedBy: text("recorded_by"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [
    index("allergy_patient_idx").on(t.patientId),
    index("allergy_patient_status_idx").on(t.patientId, t.status),
  ],
);

/** Append-only history: every clinical edit leaves the prior snapshot behind. */
export const patientAllergyHistory = hms.table(
  "patient_allergy_history",
  {
    id: idColumn(),
    allergyId: uuid("allergy_id")
      .notNull()
      .references(() => patientAllergies.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    actorId: text("actor_id"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("allergy_history_idx").on(t.allergyId, t.createdAt)],
);

export const patientProblems = hms.table(
  "patient_problem",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    icd10Id: uuid("icd10_id").references(() => icd10Codes.id),
    diagnosis: text("diagnosis").notNull(),
    onsetDate: date("onset_date"),
    status: problemStatus("status").default("ACTIVE").notNull(),
    source: problemSource("source").default("CLINICIAN").notNull(),
    /** Clinician responsible for monitoring the problem. */
    managedBy: text("managed_by"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    recordedBy: text("recorded_by"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("problem_patient_idx").on(t.patientId),
    index("problem_patient_status_idx").on(t.patientId, t.status),
  ],
);

export const patientProblemHistory = hms.table(
  "patient_problem_history",
  {
    id: idColumn(),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => patientProblems.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    actorId: text("actor_id"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("problem_history_idx").on(t.problemId, t.createdAt)],
);

export const patientInsurance = hms.table(
  "patient_insurance",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    /** Null for self-reported policies until an administrator maps them to a plan. */
    insurerId: uuid("insurer_id").references(() => insurers.id),
    planId: uuid("plan_id").references(() => insurancePlans.id),
    providerName: text("provider_name"),
    planName: text("plan_name"),
    policyNumber: text("policy_number").notNull(),
    groupNumber: text("group_number"),
    memberId: text("member_id"),
    isPrimary: boolean("is_primary").default(true).notNull(),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    verificationStatus: text("verification_status").default("UNVERIFIED").notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    lastVerificationDetail: text("last_verification_detail"),
    ...timestamps,
  },
  (t) => [index("patient_insurance_patient_idx").on(t.patientId)],
);

/** Manual wearable/health metrics (decision 7) — no device integration. */
export const patientMetrics = hms.table(
  "patient_metric",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    type: metricType("type").notNull(),
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    secondaryValue: numeric("secondary_value", { precision: 10, scale: 2 }),
    unit: text("unit"),
    source: text("source").default("MANUAL").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    recordedBy: text("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("metric_patient_type_idx").on(t.patientId, t.type, t.recordedAt)],
);

/**
 * Cross-device progress for the mandatory patient profile wizard.
 *
 * Drafts never touch the clinical patient tables and are not part of
 * onboarding state: only a complete submission creates/updates the patient
 * record and sets `onboarding_completed_at`. The row is removed on completion.
 */
export const patientProfileDrafts = hms.table(
  "patient_profile_draft",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex("patient_profile_draft_user_uq").on(t.userId)],
);

export const patientConsents = hms.table("patient_consent", {
  id: idColumn(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  granted: boolean("granted").notNull(),
  recordedBy: text("recorded_by"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const patientMerges = hms.table("patient_merge", {
  id: idColumn(),
  sourcePatientId: uuid("source_patient_id").notNull(),
  targetPatientId: uuid("target_patient_id").notNull(),
  reason: text("reason"),
  mergedBy: text("merged_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const patientPanel = hms.table(
  "doctor_panel",
  {
    id: idColumn(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    active: boolean("active").default(true).notNull(),
  },
  (t) => [uniqueIndex("doctor_panel_uq").on(t.doctorId, t.patientId)],
);

