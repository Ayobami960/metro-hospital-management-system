import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { hms, idColumn, timestamps } from "./namespace.js";
import {
  acuity,
  admissionStatus,
  encounterStatus,
  encounterType,
  medAdminStatus,
  medRoute,
  noteStatus,
  noteType,
  priority,
  prescriptionStatus,
  problemStatus,
  queueStatus,
  queueType,
  refillRequestStatus,
} from "./enums.js";
import { beds, departments, drugs, doctors, icd10Codes, rooms } from "./reference.js";
import { patients } from "./patients.js";
import { appointments } from "./scheduling.js";
import { users } from "./identity.js";

export const encounters = hms.table(
  "encounter",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id").references(() => doctors.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    type: encounterType("type").default("OUTPATIENT").notNull(),
    status: encounterStatus("status").default("PLANNED").notNull(),
    chiefComplaint: text("chief_complaint"),
    disposition: text("disposition"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("encounter_patient_idx").on(t.patientId, t.startedAt)],
);

export const admissions = hms.table(
  "admission",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    encounterId: uuid("encounter_id").references(() => encounters.id),
    departmentId: uuid("department_id").references(() => departments.id),
    attendingDoctorId: uuid("attending_doctor_id").references(() => doctors.id),
    admittedAt: timestamp("admitted_at", { withTimezone: true }).defaultNow().notNull(),
    dischargedAt: timestamp("discharged_at", { withTimezone: true }),
    acuity: acuity("acuity").default("STABLE").notNull(),
    status: admissionStatus("status").default("ACTIVE").notNull(),
    dischargeSummary: text("discharge_summary"),
    ...timestamps,
  },
  (t) => [index("admission_patient_idx").on(t.patientId, t.admittedAt)],
);

export const bedAssignments = hms.table(
  "bed_assignment",
  {
    id: idColumn(),
    bedId: uuid("bed_id")
      .notNull()
      .references(() => beds.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    admissionId: uuid("admission_id").references(() => admissions.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    assignedBy: text("assigned_by"),
  },
  (t) => [index("bed_assignment_bed_idx").on(t.bedId, t.releasedAt)],
);

export const nursingAssignments = hms.table(
  "nursing_assignment",
  {
    id: idColumn(),
    nurseId: text("nurse_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    bedId: uuid("bed_id").references(() => beds.id),
    departmentId: uuid("department_id").references(() => departments.id),
    shiftStart: timestamp("shift_start", { withTimezone: true }).notNull(),
    shiftEnd: timestamp("shift_end", { withTimezone: true }).notNull(),
    active: boolean("active").default(true).notNull(),
    assignedBy: text("assigned_by"),
    ...timestamps,
  },
  (t) => [index("nursing_assignment_nurse_idx").on(t.nurseId, t.active)],
);

export const queueEntries = hms.table(
  "queue_entry",
  {
    id: idColumn(),
    ticketNumber: text("ticket_number").notNull(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    encounterId: uuid("encounter_id").references(() => encounters.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    departmentId: uuid("department_id").references(() => departments.id),
    doctorId: uuid("doctor_id").references(() => doctors.id),
    roomId: uuid("room_id").references(() => rooms.id),
    type: queueType("type").default("WALK_IN").notNull(),
    priority: priority("priority").default("ROUTINE").notNull(),
    status: queueStatus("status").default("WAITING").notNull(),
    checkInAt: timestamp("check_in_at", { withTimezone: true }).defaultNow().notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: text("created_by"),
    version: integer("version").default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("queue_ticket_uq").on(t.ticketNumber),
    index("queue_status_idx").on(t.status, t.priority, t.checkInAt),
  ],
);

/** Append-only custody of a queue entry's lifecycle. */
export const queueEvents = hms.table(
  "queue_event",
  {
    id: idColumn(),
    queueEntryId: uuid("queue_entry_id")
      .notNull()
      .references(() => queueEntries.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    fromStatus: queueStatus("from_status"),
    toStatus: queueStatus("to_status"),
    actorId: text("actor_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("queue_event_entry_idx").on(t.queueEntryId)],
);

/** Append-only vitals series. */
export const vitals = hms.table(
  "vital",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    encounterId: uuid("encounter_id").references(() => encounters.id),
    recordedBy: text("recorded_by"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    systolic: integer("systolic"),
    diastolic: integer("diastolic"),
    heartRate: integer("heart_rate"),
    temperatureC: numeric("temperature_c", { precision: 4, scale: 1 }),
    respiratoryRate: integer("respiratory_rate"),
    spo2: integer("spo2"),
    weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
    heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
    painScore: integer("pain_score"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("vitals_patient_time_idx").on(t.patientId, t.recordedAt)],
);

export const clinicalNotes = hms.table(
  "clinical_note",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    encounterId: uuid("encounter_id").references(() => encounters.id),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    type: noteType("type").default("SOAP").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    status: noteStatus("status").default("DRAFT").notNull(),
    currentVersion: integer("current_version").default(1).notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signedBy: text("signed_by"),
    ...timestamps,
  },
  (t) => [index("note_patient_idx").on(t.patientId, t.createdAt)],
);

/** Append-only signed snapshots; amendments reference `supersedesId`. */
export const noteVersions = hms.table(
  "note_version",
  {
    id: idColumn(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => clinicalNotes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    signedBy: text("signed_by").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
    contentHash: text("content_hash").notNull(),
    supersedesId: uuid("supersedes_id"),
    amendmentReason: text("amendment_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("note_version_uq").on(t.noteId, t.version)],
);

/** Polymorphic e-signature record (decision 10). */
export const signatures = hms.table(
  "signature",
  {
    id: idColumn(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    signerId: text("signer_id").notNull(),
    signerRole: text("signer_role"),
    contentHash: text("content_hash").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
    ip: text("ip"),
  },
  (t) => [index("signature_resource_idx").on(t.resourceType, t.resourceId)],
);

export const prescriptions = hms.table(
  "prescription",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id),
    encounterId: uuid("encounter_id").references(() => encounters.id),
    status: prescriptionStatus("status").default("DRAFT").notNull(),
    notes: text("notes"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signedBy: text("signed_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("prescription_patient_idx").on(t.patientId, t.createdAt)],
);

export const prescriptionItems = hms.table(
  "prescription_item",
  {
    id: idColumn(),
    prescriptionId: uuid("prescription_id")
      .notNull()
      .references(() => prescriptions.id, { onDelete: "cascade" }),
    drugId: uuid("drug_id")
      .notNull()
      .references(() => drugs.id),
    dose: text("dose").notNull(),
    frequency: text("frequency").notNull(),
    route: medRoute("route").default("PO").notNull(),
    durationDays: integer("duration_days"),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unit: text("unit").default("tablet").notNull(),
    refillsAuthorized: integer("refills_authorized").default(0).notNull(),
    refillsUsed: integer("refills_used").default(0).notNull(),
    instructions: text("instructions"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    discontinuedAt: timestamp("discontinued_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("prescription_item_rx_idx").on(t.prescriptionId)],
);

export const refillRequests = hms.table(
  "refill_request",
  {
    id: idColumn(),
    prescriptionItemId: uuid("prescription_item_id")
      .notNull()
      .references(() => prescriptionItems.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    status: refillRequestStatus("status").default("REQUESTED").notNull(),
    reason: text("reason"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("refill_request_status_idx").on(t.status)],
);

/** Append-only MAR rows generated from active prescription items. */
export const medicationAdministrations = hms.table(
  "medication_administration",
  {
    id: idColumn(),
    prescriptionItemId: uuid("prescription_item_id").notNull(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: medAdminStatus("status").default("DUE").notNull(),
    administeredAt: timestamp("administered_at", { withTimezone: true }),
    administeredBy: text("administered_by"),
    holdReason: text("hold_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("mar_patient_time_idx").on(t.patientId, t.scheduledFor),
    foreignKey({
      columns: [t.prescriptionItemId],
      foreignColumns: [prescriptionItems.id],
      name: "med_admin_presc_item_fk",
    }).onDelete("cascade"),
  ],
);

export const encounterDiagnoses = hms.table("encounter_diagnosis", {
  id: idColumn(),
  encounterId: uuid("encounter_id")
    .notNull()
    .references(() => encounters.id, { onDelete: "cascade" }),
  icd10Id: uuid("icd10_id").references(() => icd10Codes.id),
  description: text("description").notNull(),
  primary: boolean("primary").default(false).notNull(),
  status: problemStatus("status").default("ACTIVE").notNull(),
});

