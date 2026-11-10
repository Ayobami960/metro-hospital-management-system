import {
  boolean,
  index,
  integer,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { hms, idColumn, timestamps } from "./namespace.js";
import {
  equipmentStatus,
  interactionSeverity,
  roomType,
  bedStatus,
  sexAtBirth,
  staffStatus,
} from "./enums.js";
import { users } from "./identity.js";

export const departments = hms.table(
  "department",
  {
    id: idColumn(),
    name: text("name").notNull(),
    code: text("code"),
    floor: text("floor"),
    location: text("location"),
    headDoctorId: uuid("head_doctor_id"),
    bedCapacity: integer("bed_capacity").default(0).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("department_name_uq").on(t.name)],
);

export const specialties = hms.table(
  "specialty",
  {
    id: idColumn(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [uniqueIndex("specialty_name_uq").on(t.name)],
);

export const rooms = hms.table(
  "room",
  {
    id: idColumn(),
    number: text("number").notNull(),
    floor: text("floor").notNull(),
    type: roomType("type").default("STANDARD").notNull(),
    departmentId: uuid("department_id").references(() => departments.id),
    ...timestamps,
  },
  (t) => [uniqueIndex("room_number_uq").on(t.number), index("room_floor_idx").on(t.floor)],
);

export const beds = hms.table(
  "bed",
  {
    id: idColumn(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    status: bedStatus("status").default("AVAILABLE").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("bed_room_label_uq").on(t.roomId, t.label)],
);

export const doctors = hms.table(
  "doctor",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id),
    specialtyId: uuid("specialty_id").references(() => specialties.id),
    licenseNumber: text("license_number").notNull(),
    licenseExpiry: timestamp("license_expiry", { withTimezone: true }),
    consultationFeeMinor: integer("consultation_fee_minor").default(0).notNull(),
    status: staffStatus("status").default("ACTIVE").notNull(),
    /** Post-nominals shown by the roster, e.g. "MD, FACC". */
    credentials: text("credentials"),
    bio: text("bio"),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count").default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("doctor_user_uq").on(t.userId),
    uniqueIndex("doctor_license_uq").on(t.licenseNumber),
    index("doctor_department_idx").on(t.departmentId),
  ],
);

export const insurers = hms.table(
  "insurer",
  {
    id: idColumn(),
    name: text("name").notNull(),
    code: text("code"),
    phone: text("phone"),
    email: text("email"),
    ...timestamps,
  },
  (t) => [uniqueIndex("insurer_name_uq").on(t.name)],
);

export const insurancePlans = hms.table(
  "insurance_plan",
  {
    id: idColumn(),
    insurerId: uuid("insurer_id")
      .notNull()
      .references(() => insurers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    planType: text("plan_type"),
    copayMinor: integer("copay_minor").default(0).notNull(),
    deductibleMinor: integer("deductible_minor").default(0).notNull(),
    oopMaxMinor: integer("oop_max_minor").default(0).notNull(),
    coveragePercent: integer("coverage_percent").default(80).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (t) => [index("insurance_plan_insurer_idx").on(t.insurerId)],
);

export const drugs = hms.table(
  "drug",
  {
    id: idColumn(),
    name: text("name").notNull(),
    genericName: text("generic_name"),
    strength: text("strength"),
    form: text("form"),
    unit: text("unit").default("tablet").notNull(),
    category: text("category"),
    ndc: varchar("ndc", { length: 32 }),
    controlled: boolean("controlled").default(false).notNull(),
    ...timestamps,
  },
  (t) => [
    index("drug_name_idx").on(t.name),
    uniqueIndex("drug_ndc_uq").on(t.ndc),
  ],
);

export const drugInteractions = hms.table(
  "drug_interaction",
  {
    id: idColumn(),
    drugAId: uuid("drug_a_id")
      .notNull()
      .references(() => drugs.id, { onDelete: "cascade" }),
    drugBId: uuid("drug_b_id")
      .notNull()
      .references(() => drugs.id, { onDelete: "cascade" }),
    severity: interactionSeverity("severity").notNull(),
    mechanism: text("mechanism"),
    management: text("management"),
    significance: text("significance"),
    ...timestamps,
  },
  (t) => [uniqueIndex("drug_interaction_pair_uq").on(t.drugAId, t.drugBId)],
);

export const labTests = hms.table(
  "lab_test",
  {
    id: idColumn(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    department: text("department"),
    specimenType: text("specimen_type").default("Blood").notNull(),
    turnaroundHours: integer("turnaround_hours").default(24).notNull(),
    isPanel: boolean("is_panel").default(false).notNull(),
    priceMinor: integer("price_minor").default(0).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("lab_test_code_uq").on(t.code), index("lab_test_name_idx").on(t.name)],
);

export const analytes = hms.table(
  "analyte",
  {
    id: idColumn(),
    testId: uuid("test_id")
      .notNull()
      .references(() => labTests.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit"),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("analyte_test_name_uq").on(t.testId, t.name)],
);

/** Sex- and age-specific reference bands, plus critical thresholds. */
export const analyteRanges = hms.table(
  "analyte_range",
  {
    id: idColumn(),
    analyteId: uuid("analyte_id")
      .notNull()
      .references(() => analytes.id, { onDelete: "cascade" }),
    sex: sexAtBirth("sex"),
    ageMinYears: integer("age_min_years").default(0).notNull(),
    ageMaxYears: integer("age_max_years").default(150).notNull(),
    low: numeric("low", { precision: 12, scale: 4 }),
    high: numeric("high", { precision: 12, scale: 4 }),
    criticalLow: numeric("critical_low", { precision: 12, scale: 4 }),
    criticalHigh: numeric("critical_high", { precision: 12, scale: 4 }),
    ...timestamps,
  },
  (t) => [index("analyte_range_analyte_idx").on(t.analyteId)],
);

export const icd10Codes = hms.table(
  "icd10_code",
  {
    id: idColumn(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    category: text("category"),
    ...timestamps,
  },
  (t) => [uniqueIndex("icd10_code_uq").on(t.code), index("icd10_desc_idx").on(t.description)],
);

export const cptCodes = hms.table(
  "cpt_code",
  {
    id: idColumn(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    priceMinor: integer("price_minor").default(0).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("cpt_code_uq").on(t.code)],
);

export const suppliers = hms.table(
  "supplier",
  {
    id: idColumn(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    ...timestamps,
  },
  (t) => [uniqueIndex("supplier_name_uq").on(t.name)],
);

export const pharmacies = hms.table("pharmacy", {
  id: idColumn(),
  name: text("name").notNull(),
  location: text("location"),
  phone: text("phone"),
  ...timestamps,
});

export const equipment = hms.table(
  "equipment",
  {
    id: idColumn(),
    name: text("name").notNull(),
    model: text("model"),
    serial: text("serial").notNull(),
    location: text("location"),
    departmentId: uuid("department_id").references(() => departments.id),
    lastCalibrationAt: timestamp("last_calibration_at", { withTimezone: true }),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    maintenanceIntervalDays: integer("maintenance_interval_days").default(180).notNull(),
    outOfService: boolean("out_of_service").default(false).notNull(),
    outOfServiceReason: text("out_of_service_reason"),
    statusOverride: equipmentStatus("status_override"),
    ...timestamps,
  },
  (t) => [uniqueIndex("equipment_serial_uq").on(t.serial)],
);

