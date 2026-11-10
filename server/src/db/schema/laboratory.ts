import {
  boolean,
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
import { labFlag, labOrderStatus, priority, radiologyStatus, specimenStatus } from "./enums.js";
import { analytes, equipment, labTests, doctors } from "./reference.js";
import { patients } from "./patients.js";
import { users } from "./identity.js";

export const labOrders = hms.table(
  "lab_order",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    orderingDoctorId: uuid("ordering_doctor_id").references(() => doctors.id),
    encounterId: uuid("encounter_id"),
    priority: priority("priority").default("ROUTINE").notNull(),
    status: labOrderStatus("status").default("PENDING").notNull(),
    clinicalNotes: text("clinical_notes"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).defaultNow().notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    resultedAt: timestamp("resulted_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),
    ...timestamps,
  },
  (t) => [index("lab_order_patient_idx").on(t.patientId, t.orderedAt), index("lab_order_status_idx").on(t.status)],
);

export const labOrderItems = hms.table(
  "lab_order_item",
  {
    id: idColumn(),
    labOrderId: uuid("lab_order_id")
      .notNull()
      .references(() => labOrders.id, { onDelete: "cascade" }),
    testId: uuid("test_id")
      .notNull()
      .references(() => labTests.id),
    status: labOrderStatus("status").default("PENDING").notNull(),
    assignedTechnicianId: text("assigned_technician_id").references(() => users.id),
    specimenId: uuid("specimen_id"),
    priceMinor: integer("price_minor").default(0).notNull(),
    ...timestamps,
  },
  (t) => [index("lab_order_item_order_idx").on(t.labOrderId)],
);

export const specimens = hms.table(
  "specimen",
  {
    id: idColumn(),
    barcode: text("barcode").notNull(),
    labOrderId: uuid("lab_order_id")
      .notNull()
      .references(() => labOrders.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    specimenType: text("specimen_type").default("Blood").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
    collectedBy: text("collected_by"),
    status: specimenStatus("status").default("COLLECTED").notNull(),
    location: text("location"),
    ...timestamps,
  },
  (t) => [uniqueIndex("specimen_barcode_uq").on(t.barcode)],
);

/** Append-only chain of custody. Every status transition writes one row. */
export const specimenCustody = hms.table(
  "specimen_custody",
  {
    id: idColumn(),
    specimenId: uuid("specimen_id")
      .notNull()
      .references(() => specimens.id, { onDelete: "cascade" }),
    status: specimenStatus("status").notNull(),
    location: text("location"),
    actorId: text("actor_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("specimen_custody_specimen_idx").on(t.specimenId)],
);

export const labResults = hms.table(
  "lab_result",
  {
    id: idColumn(),
    labOrderItemId: uuid("lab_order_item_id")
      .notNull()
      .references(() => labOrderItems.id, { onDelete: "cascade" }),
    analyteId: uuid("analyte_id")
      .notNull()
      .references(() => analytes.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    valueText: text("value_text").notNull(),
    valueNumeric: numeric("value_numeric", { precision: 14, scale: 4 }),
    unit: text("unit"),
    flag: labFlag("flag").default("NORMAL").notNull(),
    critical: boolean("critical").default(false).notNull(),
    enteredBy: text("entered_by"),
    enteredAt: timestamp("entered_at", { withTimezone: true }).defaultNow().notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: text("released_by"),
    version: integer("version").default(1).notNull(),
    amendedFromId: uuid("amended_from_id"),
    ...timestamps,
  },
  (t) => [index("lab_result_item_idx").on(t.labOrderItemId), index("lab_result_patient_idx").on(t.patientId)],
);

/** Append-only signed result snapshots. */
export const labResultVersions = hms.table(
  "lab_result_version",
  {
    id: idColumn(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => labResults.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    valueText: text("value_text").notNull(),
    valueNumeric: numeric("value_numeric", { precision: 14, scale: 4 }),
    flag: labFlag("flag").notNull(),
    contentHash: text("content_hash").notNull(),
    signedBy: text("signed_by").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull(),
    reason: text("reason"),
  },
  (t) => [uniqueIndex("lab_result_version_uq").on(t.resultId, t.version)],
);

export const criticalValueNotifications = hms.table(
  "critical_value_notification",
  {
    id: idColumn(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => labResults.id, { onDelete: "cascade" }),
    notifiedUserId: text("notified_user_id")
      .notNull()
      .references(() => users.id),
    notifiedBy: text("notified_by").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }).defaultNow().notNull(),
    method: text("method").default("PHONE").notNull(),
    note: text("note"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgementNote: text("acknowledgement_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("critical_notification_result_idx").on(t.resultId)],
);

export const radiologyOrders = hms.table(
  "radiology_order",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    orderingDoctorId: uuid("ordering_doctor_id").references(() => doctors.id),
    studyType: text("study_type").notNull(),
    bodyPart: text("body_part").notNull(),
    priority: priority("priority").default("ROUTINE").notNull(),
    status: radiologyStatus("status").default("ORDERED").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    performedAt: timestamp("performed_at", { withTimezone: true }),
    notes: text("notes"),
    radiologistId: uuid("radiologist_id").references(() => doctors.id),
    ...timestamps,
  },
  (t) => [index("radiology_patient_idx").on(t.patientId)],
);

export const radiologyReports = hms.table(
  "radiology_report",
  {
    id: idColumn(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => radiologyOrders.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    impression: text("impression"),
    signedBy: text("signed_by"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    amendedFromId: uuid("amended_from_id"),
    images: jsonb("images").$type<Array<{ fileId: string; caption?: string }>>().default([]).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("radiology_report_order_version_uq").on(t.orderId, t.version)],
);

export const equipmentMaintenance = hms.table(
  "equipment_maintenance",
  {
    id: idColumn(),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    technician: text("technician"),
    performedAt: timestamp("performed_at", { withTimezone: true }).defaultNow().notNull(),
    notes: text("notes"),
    result: text("result"),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("equipment_maintenance_equipment_idx").on(t.equipmentId)],
);

