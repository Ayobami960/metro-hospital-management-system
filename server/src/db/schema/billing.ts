import {
  boolean,
  date,
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
  claimStatus,
  installStatus,
  invoiceStatus,
  paymentKind,
  paymentMethod,
  paymentStatus,
  planStatus,
} from "./enums.js";
import { cptCodes, insurers, insurancePlans } from "./reference.js";
import { patients } from "./patients.js";

export const invoices = hms.table(
  "invoice",
  {
    id: idColumn(),
    invoiceNumber: text("invoice_number").notNull(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    encounterId: uuid("encounter_id"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    currency: text("currency").default("USD").notNull(),
    status: invoiceStatus("status").default("ISSUED").notNull(),
    subtotalMinor: integer("subtotal_minor").default(0).notNull(),
    taxMinor: integer("tax_minor").default(0).notNull(),
    totalMinor: integer("total_minor").default(0).notNull(),
    /** Maintained transactionally for indexable A/R, recomputable from allocations. */
    amountPaidMinor: integer("amount_paid_minor").default(0).notNull(),
    notes: text("notes"),
    voidReason: text("void_reason"),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("invoice_number_uq").on(t.invoiceNumber),
    index("invoice_patient_idx").on(t.patientId, t.issuedAt),
    index("invoice_status_idx").on(t.status, t.dueAt),
  ],
);

export const invoiceItems = hms.table(
  "invoice_item",
  {
    id: idColumn(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    cptId: uuid("cpt_id").references(() => cptCodes.id),
    quantity: integer("quantity").default(1).notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    totalMinor: integer("total_minor").notNull(),
    serviceDate: date("service_date"),
    ...timestamps,
  },
  (t) => [index("invoice_item_invoice_idx").on(t.invoiceId)],
);

/** Immutable payment ledger: reversals are new negative rows. */
export const payments = hms.table(
  "payment",
  {
    id: idColumn(),
    paymentNumber: text("payment_number").notNull(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").default("USD").notNull(),
    method: paymentMethod("method").notNull(),
    kind: paymentKind("kind").default("PAYMENT").notNull(),
    status: paymentStatus("status").default("CLEARED").notNull(),
    provider: text("provider").default("MANUAL").notNull(),
    providerRef: text("provider_ref"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    receivedBy: text("received_by"),
    reference: text("reference"),
    reversesPaymentId: uuid("reverses_payment_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("payment_number_uq").on(t.paymentNumber),
    index("payment_patient_idx").on(t.patientId, t.receivedAt),
  ],
);

export const paymentAllocations = hms.table(
  "payment_allocation",
  {
    id: idColumn(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payment_allocation_invoice_idx").on(t.invoiceId),
    uniqueIndex("payment_allocation_uq").on(t.paymentId, t.invoiceId),
  ],
);

export const paymentEvents = hms.table(
  "payment_event",
  {
    id: idColumn(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorId: text("actor_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("payment_event_payment_idx").on(t.paymentId)],
);

export const insuranceClaims = hms.table(
  "insurance_claim",
  {
    id: idColumn(),
    claimNumber: text("claim_number").notNull(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    insurerId: uuid("insurer_id")
      .notNull()
      .references(() => insurers.id),
    planId: uuid("plan_id").references(() => insurancePlans.id),
    status: claimStatus("status").default("DRAFT").notNull(),
    claimedMinor: integer("claimed_minor").notNull(),
    approvedMinor: integer("approved_minor").default(0).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    denialReason: text("denial_reason"),
    appealDeadline: date("appeal_deadline"),
    externalRef: text("external_ref"),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("claim_number_uq").on(t.claimNumber),
    index("claim_status_idx").on(t.status, t.submittedAt),
  ],
);

export const claimEvents = hms.table(
  "claim_event",
  {
    id: idColumn(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => insuranceClaims.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("claim_event_claim_idx").on(t.claimId)],
);

export const paymentPlans = hms.table(
  "payment_plan",
  {
    id: idColumn(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    installmentCount: integer("installment_count").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    status: planStatus("status").default("ACTIVE").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by"),
    ...timestamps,
  },
  (t) => [index("payment_plan_patient_idx").on(t.patientId)],
);

export const planInstallments = hms.table(
  "plan_installment",
  {
    id: idColumn(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => paymentPlans.id, { onDelete: "cascade" }),
    dueDate: date("due_date").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    paidMinor: integer("paid_minor").default(0).notNull(),
    status: installStatus("status").default("PENDING").notNull(),
    active: boolean("active").default(true).notNull(),
    runningBalanceMinor: numeric("running_balance_minor", { precision: 14, scale: 2 }),
  },
  (t) => [index("plan_installment_plan_idx").on(t.planId)],
);
