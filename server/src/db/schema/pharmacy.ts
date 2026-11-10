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
import { pharmacyOrderStatus, poStatus, priority, stockMovementReason } from "./enums.js";
import { drugs, suppliers } from "./reference.js";
import { patients } from "./patients.js";
import { prescriptions, prescriptionItems } from "./clinical.js";

export const pharmacyOrders = hms.table(
  "pharmacy_order",
  {
    id: idColumn(),
    prescriptionId: uuid("prescription_id")
      .notNull()
      .references(() => prescriptions.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    status: pharmacyOrderStatus("status").default("NEW").notNull(),
    priority: priority("priority").default("ROUTINE").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedBy: text("processed_by"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    dispensedAt: timestamp("dispensed_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("pharmacy_order_status_idx").on(t.status, t.receivedAt)],
);

export const inventoryItems = hms.table(
  "inventory_item",
  {
    id: idColumn(),
    drugId: uuid("drug_id")
      .notNull()
      .references(() => drugs.id, { onDelete: "cascade" }),
    unit: text("unit").default("tablet").notNull(),
    reorderLevel: integer("reorder_level").default(50).notNull(),
    location: text("location"),
    ...timestamps,
  },
  (t) => [uniqueIndex("inventory_drug_uq").on(t.drugId)],
);

export const inventoryBatches = hms.table(
  "inventory_batch",
  {
    id: idColumn(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(),
    lotNumber: text("lot_number"),
    expiryDate: date("expiry_date").notNull(),
    quantity: integer("quantity").default(0).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("inventory_batch_uq").on(t.itemId, t.batchNumber, t.expiryDate),
    index("inventory_batch_expiry_idx").on(t.expiryDate),
  ],
);

/** Append-only stock ledger: every quantity change is a row. */
export const stockMovements = hms.table(
  "stock_movement",
  {
    id: idColumn(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id").references(() => inventoryBatches.id, { onDelete: "set null" }),
    delta: integer("delta").notNull(),
    reason: stockMovementReason("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    actorId: text("actor_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("stock_movement_item_idx").on(t.itemId, t.createdAt)],
);

export const dispenses = hms.table(
  "dispense",
  {
    id: idColumn(),
    pharmacyOrderId: uuid("pharmacy_order_id")
      .notNull()
      .references(() => pharmacyOrders.id),
    prescriptionId: uuid("prescription_id")
      .notNull()
      .references(() => prescriptions.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    pharmacistId: text("pharmacist_id").notNull(),
    /** Four attestations from the dispense checklist. */
    checklist: jsonb("checklist")
      .$type<{
        patientIdVerified: boolean;
        drugMatches: boolean;
        doseCorrect: boolean;
        counselingGiven: boolean;
      }>()
      .notNull(),
    quantityOverride: boolean("quantity_override").default(false).notNull(),
    overrideReason: text("override_reason"),
    notes: text("notes"),
    dispensedAt: timestamp("dispensed_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("dispense_patient_idx").on(t.patientId, t.dispensedAt)],
);

export const dispenseItems = hms.table(
  "dispense_item",
  {
    id: idColumn(),
    dispenseId: uuid("dispense_id")
      .notNull()
      .references(() => dispenses.id, { onDelete: "cascade" }),
    prescriptionItemId: uuid("prescription_item_id")
      .notNull()
      .references(() => prescriptionItems.id),
    drugId: uuid("drug_id")
      .notNull()
      .references(() => drugs.id),
    batchId: uuid("batch_id").references(() => inventoryBatches.id),
    quantity: integer("quantity").notNull(),
    unit: text("unit").default("tablet").notNull(),
  },
  (t) => [index("dispense_item_dispense_idx").on(t.dispenseId)],
);

export const purchaseOrders = hms.table(
  "purchase_order",
  {
    id: idColumn(),
    poNumber: text("po_number").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: poStatus("status").default("DRAFT").notNull(),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).defaultNow().notNull(),
    expectedDeliveryAt: timestamp("expected_delivery_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    totalMinor: integer("total_minor").default(0).notNull(),
    currency: text("currency").default("USD").notNull(),
    createdBy: text("created_by"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [uniqueIndex("purchase_order_number_uq").on(t.poNumber)],
);

export const purchaseOrderItems = hms.table("purchase_order_item", {
  id: idColumn(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  drugId: uuid("drug_id")
    .notNull()
    .references(() => drugs.id),
  quantity: integer("quantity").notNull(),
  unitCostMinor: integer("unit_cost_minor").notNull(),
  receivedQuantity: integer("received_quantity").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  unit: text("unit"),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }),
});

