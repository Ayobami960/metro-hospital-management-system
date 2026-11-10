import { boolean, index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { hms, idColumn, timestamps } from "./namespace.js";
import { appointmentMode, appointmentStatus, priority } from "./enums.js";
import { departments, doctors, rooms } from "./reference.js";
import { patients } from "./patients.js";

export const doctorAvailability = hms.table(
  "doctor_availability",
  {
    id: idColumn(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday, clinic timezone. */
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    slotMinutes: integer("slot_minutes").default(30).notNull(),
    breakStartMinute: integer("break_start_minute"),
    breakEndMinute: integer("break_end_minute"),
    maxDailyPatients: integer("max_daily_patients").default(16).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("doctor_availability_uq").on(t.doctorId, t.weekday, t.startMinute)],
);

export const doctorTimeOff = hms.table("doctor_time_off", {
  id: idColumn(),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctors.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scheduleSettings = hms.table("schedule_settings", {
  id: integer("id").primaryKey().default(1),
  slotMinutes: integer("slot_minutes").default(30).notNull(),
  bufferMinutes: integer("buffer_minutes").default(0).notNull(),
  horizonDays: integer("horizon_days").default(90).notNull(),
  cancelCutoffHours: integer("cancel_cutoff_hours").default(4).notNull(),
  ...timestamps,
});

export const appointments = hms.table(
  "appointment",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id").references(() => departments.id),
    roomId: uuid("room_id").references(() => rooms.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    mode: appointmentMode("mode").default("IN_PERSON").notNull(),
    type: text("type").default("Consultation").notNull(),
    status: appointmentStatus("status").default("REQUESTED").notNull(),
    priority: priority("priority").default("ROUTINE").notNull(),
    reason: text("reason"),
    symptoms: text("symptoms"),
    meetingUrl: text("meeting_url"),
    requestedBy: text("requested_by"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rescheduledFromId: uuid("rescheduled_from_id"),
    encounterId: uuid("encounter_id"),
    ...timestamps,
  },
  (t) => [
    index("appointment_doctor_time_idx").on(t.doctorId, t.startsAt),
    index("appointment_patient_idx").on(t.patientId, t.startsAt),
    index("appointment_status_idx").on(t.status, t.startsAt),
  ],
);

export const appointmentHistory = hms.table(
  "appointment_history",
  {
    id: idColumn(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    fromStatus: appointmentStatus("from_status"),
    toStatus: appointmentStatus("to_status").notNull(),
    changedBy: text("changed_by"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("appointment_history_appt_idx").on(t.appointmentId)],
);

/** Patient-facing booking requests pending doctor approval. */
export const appointmentRequests = hms.table(
  "appointment_request",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    requestedFor: timestamp("requested_for", { withTimezone: true }).notNull(),
    mode: appointmentMode("mode").default("IN_PERSON").notNull(),
    reason: text("reason"),
    status: appointmentStatus("status").default("REQUESTED").notNull(),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    active: boolean("active").default(true).notNull(),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (t) => [index("appointment_request_doctor_idx").on(t.doctorId, t.status)],
);

export const doctorRatings = hms.table(
  "doctor_rating",
  {
    id: idColumn(),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    ratedBy: text("rated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("doctor_rating_doctor_idx").on(t.doctorId)],
);

