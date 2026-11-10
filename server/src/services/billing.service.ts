import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  claimEvents,
  insuranceClaims,
  invoiceItems,
  invoices,
  paymentAllocations,
  paymentEvents,
  payments,
} from "../db/schema/billing.js";
import { patients } from "../db/schema/patients.js";
import { insurers } from "../db/schema/reference.js";
import { assertPatientScope, requirePermission, type Actor } from "../lib/authorize.js";
import { writeAudit } from "../lib/audit.js";
import { AppError, notFound } from "../lib/http.js";
import { referenceNumber } from "../lib/refs.js";
import { addDays, clinicDayRange, daysBetween } from "../lib/time.js";

/**
 * Billing: invoices, payments/allocations, insurance claims, ageing and the
 * billing dashboard. Totals and invoice status are always derived from the
 * rows that were actually written; the client never supplies them.
 */

export type PaymentMethod = "CASH" | "CHECK" | "CARD" | "INSURANCE" | "TRANSFER";
export type ClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PARTIALLY_APPROVED"
  | "DENIED"
  | "APPEALED";

/** Invoice status is recomputed from paid totals, never set by the client. */
const statusFor = (totalMinor: number, paidMinor: number): "ISSUED" | "PARTIALLY_PAID" | "PAID" => {
  if (paidMinor >= totalMinor && totalMinor > 0) return "PAID";
  if (paidMinor > 0) return "PARTIALLY_PAID";
  return "ISSUED";
};

const balanceOf = (totalMinor: number, paidMinor: number): number => Math.max(0, totalMinor - paidMinor);

const guardPatient = (actor: Actor, patientId: string): void => {
  if (actor.role === "PATIENT") assertPatientScope(actor.patientId === patientId);
};

export interface ListQuery {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
  order: "asc" | "desc";
}

export interface InvoiceListFilters {
  status?: string | undefined;
  patientId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

const scopedPatientId = (actor: Actor, requested?: string): string | null =>
  actor.role === "PATIENT" ? (actor.patientId ?? "00000000-0000-0000-0000-000000000000") : (requested ?? null);

export const listInvoices = async (actor: Actor, query: ListQuery, filters: InvoiceListFilters) => {
  requirePermission(actor, "invoice:read");
  const patientId = scopedPatientId(actor, filters.patientId);
  const conditions = [];
  if (filters.status) conditions.push(eq(invoices.status, filters.status as "ISSUED"));
  if (patientId) conditions.push(eq(invoices.patientId, patientId));
  if (filters.from && !Number.isNaN(filters.from.getTime())) {
    conditions.push(sql`${invoices.issuedAt} >= ${filters.from}`);
  }
  if (filters.to && !Number.isNaN(filters.to.getTime())) {
    conditions.push(sql`${invoices.issuedAt} <= ${filters.to}`);
  }
  if (query.search) {
    conditions.push(
      sql<boolean>`(${invoices.invoiceNumber} ilike ${`%${query.search}%`} or ${patients.lastName} ilike ${`%${query.search}%`} or ${patients.mrn} ilike ${`%${query.search}%`})`,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        patientId: invoices.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        status: invoices.status,
        issuedAt: invoices.issuedAt,
        dueAt: invoices.dueAt,
        currency: invoices.currency,
        subtotalMinor: invoices.subtotalMinor,
        taxMinor: invoices.taxMinor,
        totalMinor: invoices.totalMinor,
        amountPaidMinor: invoices.amountPaidMinor,
        notes: invoices.notes,
        itemCount: sql<number>`(select count(*)::int from hms.invoice_item i where i.invoice_id = ${invoices.id})`,
      })
      .from(invoices)
      .innerJoin(patients, eq(invoices.patientId, patients.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(invoices.issuedAt) : desc(invoices.issuedAt))
      .limit(query.pageSize)
      .offset(query.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(invoices)
      .innerJoin(patients, eq(invoices.patientId, patients.id))
      .where(where),
  ]);

  return {
    rows: rows.map((row) => ({
      ...row,
      balanceMinor: balanceOf(row.totalMinor, row.amountPaidMinor),
      overdue: row.status !== "PAID" && row.status !== "VOID" && row.dueAt.getTime() < Date.now(),
      daysOverdue: row.dueAt.getTime() < Date.now() ? daysBetween(row.dueAt) : 0,
    })),
    total: Number(totals?.value ?? 0),
  };
};

export const getInvoice = async (actor: Actor, id: string) => {
  requirePermission(actor, "invoice:read");
  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      patientId: invoices.patientId,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      mrn: patients.mrn,
      encounterId: invoices.encounterId,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      currency: invoices.currency,
      subtotalMinor: invoices.subtotalMinor,
      taxMinor: invoices.taxMinor,
      totalMinor: invoices.totalMinor,
      amountPaidMinor: invoices.amountPaidMinor,
      notes: invoices.notes,
      voidReason: invoices.voidReason,
    })
    .from(invoices)
    .innerJoin(patients, eq(invoices.patientId, patients.id))
    .where(eq(invoices.id, id))
    .limit(1);
  if (!invoice) throw notFound("Invoice not found");
  guardPatient(actor, invoice.patientId);

  const [items, allocationRows, claimRows] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)),
    db
      .select({
        paymentId: paymentAllocations.paymentId,
        amountMinor: paymentAllocations.amountMinor,
        createdAt: paymentAllocations.createdAt,
        method: payments.method,
        kind: payments.kind,
        status: payments.status,
        receivedAt: payments.receivedAt,
        paymentNumber: payments.paymentNumber,
      })
      .from(paymentAllocations)
      .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
      .where(eq(paymentAllocations.invoiceId, id))
      .orderBy(desc(payments.receivedAt)),
    db.select().from(insuranceClaims).where(eq(insuranceClaims.invoiceId, id)),
  ]);

  return {
    ...invoice,
    balanceMinor: balanceOf(invoice.totalMinor, invoice.amountPaidMinor),
    items,
    payments: allocationRows,
    claims: claimRows,
  };
};

export interface CreateInvoiceInput {
  patientId: string;
  encounterId?: string | undefined;
  dueAt?: string | undefined;
  taxMinor: number;
  notes?: string | undefined;
  items: {
    description: string;
    cptId?: string | undefined;
    quantity: number;
    unitPriceMinor: number;
    serviceDate?: string | undefined;
  }[];
}

export const createInvoice = async (actor: Actor, body: CreateInvoiceInput, ip?: string) => {
  requirePermission(actor, "invoice:create");
  const [patient] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, body.patientId))
    .limit(1);
  if (!patient) throw notFound("Patient not found");

  return db.transaction(async (tx) => {
    const lineTotals = body.items.map((item) => item.quantity * item.unitPriceMinor);
    const subtotalMinor = lineTotals.reduce((a, b) => a + b, 0);
    const totalMinor = subtotalMinor + body.taxMinor;

    const [row] = await tx
      .insert(invoices)
      .values({
        invoiceNumber: referenceNumber("INV"),
        patientId: body.patientId,
        encounterId: body.encounterId ?? null,
        dueAt: body.dueAt ? new Date(body.dueAt) : addDays(new Date(), 30),
        status: "ISSUED",
        subtotalMinor,
        taxMinor: body.taxMinor,
        totalMinor,
        notes: body.notes ?? null,
        createdBy: actor.id,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Invoice insert failed");

    const items = await tx
      .insert(invoiceItems)
      .values(
        body.items.map((item, index) => ({
          invoiceId: row.id,
          description: item.description,
          cptId: item.cptId ?? null,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          totalMinor: lineTotals[index] ?? 0,
          serviceDate: item.serviceDate ?? null,
        })),
      )
      .returning();

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "invoice.create",
        module: "billing",
        entityType: "invoice",
        entityId: row.id,
        detail: { patientId: body.patientId, totalMinor },
        ip,
      },
      tx,
    );

    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      patientId: row.patientId,
      status: row.status,
      issuedAt: row.issuedAt,
      dueAt: row.dueAt,
      subtotalMinor: row.subtotalMinor,
      taxMinor: row.taxMinor,
      totalMinor: row.totalMinor,
      amountPaidMinor: row.amountPaidMinor,
      balanceMinor: balanceOf(row.totalMinor, row.amountPaidMinor),
      items,
    };
  });
};

export const voidInvoice = async (actor: Actor, id: string, reason: string, ip?: string) => {
  requirePermission(actor, "invoice:update");
  return db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1).for("update");
    if (!invoice) throw notFound("Invoice not found");
    if (invoice.status === "VOID") throw new AppError("INVALID_TRANSITION", "Invoice is already void");
    if (invoice.amountPaidMinor > 0) {
      throw new AppError("PRECONDITION_FAILED", "Refund the payments before voiding this invoice", {
        amountPaidMinor: invoice.amountPaidMinor,
      });
    }

    const [updated] = await tx
      .update(invoices)
      .set({ status: "VOID", voidReason: reason, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "invoice.void",
        module: "billing",
        entityType: "invoice",
        entityId: id,
        level: "WARNING",
        detail: { reason },
        ip,
      },
      tx,
    );
    return { id: updated?.id, status: updated?.status, voidReason: updated?.voidReason };
  });
};

export interface PaymentListFilters {
  patientId?: string | undefined;
  method?: string | undefined;
  kind?: string | undefined;
}

export const listPayments = async (actor: Actor, query: ListQuery, filters: PaymentListFilters) => {
  requirePermission(actor, "payment:read");
  const patientId = scopedPatientId(actor, filters.patientId);
  const conditions = [];
  if (patientId) conditions.push(eq(payments.patientId, patientId));
  if (filters.method) conditions.push(eq(payments.method, filters.method as "CASH"));
  if (filters.kind) conditions.push(eq(payments.kind, filters.kind as "PAYMENT"));
  if (query.search) conditions.push(sql<boolean>`${payments.paymentNumber} ilike ${`%${query.search}%`}`);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: payments.id,
        paymentNumber: payments.paymentNumber,
        patientId: payments.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        method: payments.method,
        kind: payments.kind,
        status: payments.status,
        provider: payments.provider,
        receivedAt: payments.receivedAt,
        receivedBy: payments.receivedBy,
        reference: payments.reference,
        reversesPaymentId: payments.reversesPaymentId,
        allocatedMinor: sql<number>`coalesce((select sum(a.amount_minor)::int from hms.payment_allocation a where a.payment_id = ${payments.id}), 0)`,
      })
      .from(payments)
      .innerJoin(patients, eq(payments.patientId, patients.id))
      .where(where)
      .orderBy(desc(payments.receivedAt))
      .limit(query.pageSize)
      .offset(query.offset),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(payments)
      .innerJoin(patients, eq(payments.patientId, patients.id))
      .where(where),
  ]);

  return { rows, total: Number(totals?.value ?? 0) };
};

export interface RecordPaymentInput {
  patientId?: string | undefined;
  amountMinor: number;
  method: PaymentMethod;
  reference?: string | undefined;
  provider: string;
  providerRef?: string | undefined;
  notes?: string | undefined;
  allocations?: { invoiceId: string; amountMinor: number }[] | undefined;
}

export const recordPayment = async (actor: Actor, body: RecordPaymentInput, ip?: string) => {
  const patientId = actor.role === "PATIENT" ? (actor.patientId ?? "") : body.patientId;
  if (!patientId) throw new AppError("VALIDATION_ERROR", "patientId is required");
  requirePermission(actor, actor.role === "PATIENT" ? "payment:pay_own" : "payment:record");
  guardPatient(actor, patientId);

  const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!patient) throw notFound("Patient not found");

  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(payments)
      .values({
        paymentNumber: referenceNumber("PMT"),
        patientId,
        amountMinor: body.amountMinor,
        method: body.method,
        kind: "PAYMENT",
        status: body.provider === "STRIPE" ? "PENDING" : "CLEARED",
        provider: body.provider,
        providerRef: body.providerRef ?? null,
        receivedBy: actor.id,
        reference: body.reference ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    if (!payment) throw new AppError("INTERNAL_ERROR", "Payment insert failed");

    // Explicit allocations first; otherwise settle the oldest open invoices FIFO.
    const requested = body.allocations ?? [];
    let remaining = body.amountMinor;
    const planned: Array<{ invoiceId: string; amountMinor: number }> = [];

    for (const allocation of requested) {
      if (allocation.amountMinor > remaining) {
        throw new AppError("PRECONDITION_FAILED", "Allocations exceed the payment amount", {
          amountMinor: body.amountMinor,
        });
      }
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, allocation.invoiceId))
        .limit(1)
        .for("update");
      if (!invoice) throw notFound("Invoice not found");
      if (invoice.patientId !== patientId) {
        throw new AppError("PRECONDITION_FAILED", "Invoice belongs to another patient");
      }
      if (invoice.status === "VOID") throw new AppError("PRECONDITION_FAILED", "Cannot allocate to a void invoice");
      const balance = balanceOf(invoice.totalMinor, invoice.amountPaidMinor);
      if (allocation.amountMinor > balance) {
        throw new AppError("PRECONDITION_FAILED", "Allocation exceeds the invoice balance", {
          invoiceId: invoice.id,
          balanceMinor: balance,
        });
      }
      planned.push(allocation);
      remaining -= allocation.amountMinor;
    }

    if (planned.length === 0) {
      const open = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.patientId, patientId), inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"])))
        .orderBy(asc(invoices.dueAt))
        .limit(25);
      for (const invoice of open) {
        if (remaining <= 0) break;
        const balance = balanceOf(invoice.totalMinor, invoice.amountPaidMinor);
        const take = Math.min(balance, remaining);
        if (take <= 0) continue;
        planned.push({ invoiceId: invoice.id, amountMinor: take });
        remaining -= take;
      }
    }

    const allocations: Array<Record<string, unknown>> = [];
    for (const allocation of planned) {
      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        invoiceId: allocation.invoiceId,
        amountMinor: allocation.amountMinor,
      });
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, allocation.invoiceId))
        .limit(1)
        .for("update");
      if (!invoice) continue;
      const paid = invoice.amountPaidMinor + allocation.amountMinor;
      const [updated] = await tx
        .update(invoices)
        .set({ amountPaidMinor: paid, status: statusFor(invoice.totalMinor, paid), updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id))
        .returning();
      allocations.push({
        invoiceId: allocation.invoiceId,
        invoiceNumber: updated?.invoiceNumber,
        amountMinor: allocation.amountMinor,
        invoiceStatus: updated?.status,
        invoiceBalanceMinor: updated ? balanceOf(updated.totalMinor, updated.amountPaidMinor) : null,
      });
    }

    await tx.insert(paymentEvents).values({
      paymentId: payment.id,
      eventType: "RECORDED",
      actorId: actor.id,
      detail: { allocations: planned.length, unallocatedMinor: remaining },
    });

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "payment.record",
        module: "billing",
        entityType: "payment",
        entityId: payment.id,
        level: "SUCCESS",
        detail: { amountMinor: body.amountMinor, method: body.method, unallocatedMinor: remaining },
        ip,
      },
      tx,
    );

    return { payment, allocations, unallocatedMinor: remaining };
  });

  return {
    payment: {
      id: result.payment.id,
      paymentNumber: result.payment.paymentNumber,
      patientId: result.payment.patientId,
      amountMinor: result.payment.amountMinor,
      method: result.payment.method,
      status: result.payment.status,
      provider: result.payment.provider,
      receivedAt: result.payment.receivedAt,
    },
    allocations: result.allocations,
    unallocatedMinor: result.unallocatedMinor,
  };
};

export const refundPayment = async (
  actor: Actor,
  id: string,
  amountMinor: number,
  reason: string,
  ip?: string,
) => {
  requirePermission(actor, "payment:refund");

  const result = await db.transaction(async (tx) => {
    const [original] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1).for("update");
    if (!original) throw notFound("Payment not found");
    if (original.kind !== "PAYMENT") throw new AppError("PRECONDITION_FAILED", "Only a payment can be refunded");
    if (original.amountMinor < amountMinor) {
      throw new AppError("PRECONDITION_FAILED", "Refund exceeds the original payment", {
        amountMinor: original.amountMinor,
      });
    }

    const [refund] = await tx
      .insert(payments)
      .values({
        paymentNumber: referenceNumber("RFD"),
        patientId: original.patientId,
        amountMinor: -amountMinor,
        method: original.method,
        kind: "REFUND",
        status: "REFUNDED",
        provider: original.provider,
        receivedBy: actor.id,
        reversesPaymentId: original.id,
        notes: reason,
      })
      .returning();
    if (!refund) throw new AppError("INTERNAL_ERROR", "Refund insert failed");

    const originalAllocations = await tx
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, original.id))
      .orderBy(desc(paymentAllocations.createdAt));

    let remaining = amountMinor;
    const reversed: Array<Record<string, unknown>> = [];
    for (const allocation of originalAllocations) {
      if (remaining <= 0) break;
      const take = Math.min(allocation.amountMinor, remaining);
      await tx.insert(paymentAllocations).values({
        paymentId: refund.id,
        invoiceId: allocation.invoiceId,
        amountMinor: -take,
      });
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, allocation.invoiceId))
        .limit(1)
        .for("update");
      if (invoice) {
        const paid = Math.max(0, invoice.amountPaidMinor - take);
        const [updated] = await tx
          .update(invoices)
          .set({ amountPaidMinor: paid, status: statusFor(invoice.totalMinor, paid), updatedAt: new Date() })
          .where(eq(invoices.id, invoice.id))
          .returning();
        reversed.push({
          invoiceId: invoice.id,
          invoiceNumber: updated?.invoiceNumber,
          amountMinor: -take,
          invoiceStatus: updated?.status,
        });
      }
      remaining -= take;
    }

    await tx.insert(paymentEvents).values({
      paymentId: refund.id,
      eventType: "REFUNDED",
      actorId: actor.id,
      detail: { reversesPaymentId: original.id, amountMinor, reason },
    });

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "payment.refund",
        module: "billing",
        entityType: "payment",
        entityId: refund.id,
        level: "WARNING",
        detail: { reversesPaymentId: original.id, amountMinor, reason },
        ip,
      },
      tx,
    );

    return { refund, reversed };
  });

  return {
    payment: {
      id: result.refund.id,
      paymentNumber: result.refund.paymentNumber,
      amountMinor: result.refund.amountMinor,
      kind: result.refund.kind,
      status: result.refund.status,
      reversesPaymentId: result.refund.reversesPaymentId,
    },
    allocations: result.reversed,
  };
};

/** Ageing buckets for the Outstanding page; computed in SQL from due dates. */
export const outstandingInvoices = async (actor: Actor, query: ListQuery, patientId?: string) => {
  requirePermission(actor, "invoice:read");
  const conditions = [inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"] as const)];
  if (patientId) conditions.push(eq(invoices.patientId, patientId));
  if (query.search) {
    conditions.push(
      sql<boolean>`(${invoices.invoiceNumber} ilike ${`%${query.search}%`} or ${patients.lastName} ilike ${`%${query.search}%`})`,
    );
  }
  const where = and(...conditions);

  const [rows, buckets] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        patientId: invoices.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        status: invoices.status,
        dueAt: invoices.dueAt,
        totalMinor: invoices.totalMinor,
        amountPaidMinor: invoices.amountPaidMinor,
        balanceMinor: sql<number>`(${invoices.totalMinor} - ${invoices.amountPaidMinor})`,
      })
      .from(invoices)
      .innerJoin(patients, eq(invoices.patientId, patients.id))
      .where(where)
      .orderBy(asc(invoices.dueAt))
      .limit(query.pageSize)
      .offset(query.offset),
    db
      .select({
        current: sql<number>`coalesce(sum(case when ${invoices.dueAt} >= now() then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        d1to30: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() and ${invoices.dueAt} >= now() - interval '30 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        d31to60: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() - interval '30 days' and ${invoices.dueAt} >= now() - interval '60 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        d61to90: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() - interval '60 days' and ${invoices.dueAt} >= now() - interval '90 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        over90: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() - interval '90 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        total: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)::int`,
      })
      .from(invoices)
      .innerJoin(patients, eq(invoices.patientId, patients.id))
      .where(where),
  ]);

  return {
    rows: rows.map((row) => ({
      ...row,
      daysOverdue: row.dueAt.getTime() < Date.now() ? daysBetween(row.dueAt) : 0,
    })),
    total: rows.length,
    buckets: buckets[0] ?? { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0 },
  };
};

export interface ClaimListFilters {
  status?: string | undefined;
  insurerId?: string | undefined;
}

export const listClaims = async (actor: Actor, query: ListQuery, filters: ClaimListFilters) => {
  requirePermission(actor, "claim:read");
  const conditions = [];
  if (filters.status) conditions.push(eq(insuranceClaims.status, filters.status as "DRAFT"));
  if (filters.insurerId) conditions.push(eq(insuranceClaims.insurerId, filters.insurerId));
  if (query.search) conditions.push(sql<boolean>`${insuranceClaims.claimNumber} ilike ${`%${query.search}%`}`);
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: insuranceClaims.id,
        claimNumber: insuranceClaims.claimNumber,
        invoiceId: insuranceClaims.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        patientId: insuranceClaims.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        insurerId: insuranceClaims.insurerId,
        insurer: insurers.name,
        status: insuranceClaims.status,
        claimedMinor: insuranceClaims.claimedMinor,
        approvedMinor: insuranceClaims.approvedMinor,
        submittedAt: insuranceClaims.submittedAt,
        decidedAt: insuranceClaims.decidedAt,
        denialReason: insuranceClaims.denialReason,
        appealDeadline: insuranceClaims.appealDeadline,
      })
      .from(insuranceClaims)
      .innerJoin(invoices, eq(insuranceClaims.invoiceId, invoices.id))
      .innerJoin(patients, eq(insuranceClaims.patientId, patients.id))
      .innerJoin(insurers, eq(insuranceClaims.insurerId, insurers.id))
      .where(where)
      .orderBy(desc(insuranceClaims.submittedAt))
      .limit(query.pageSize)
      .offset(query.offset),
    db.select({ value: sql<number>`count(*)::int` }).from(insuranceClaims).where(where),
  ]);

  return { rows, total: Number(totals?.value ?? 0) };
};

export interface CreateClaimInput {
  invoiceId: string;
  insurerId: string;
  planId?: string | undefined;
  claimedMinor: number;
}

export const createClaim = async (actor: Actor, body: CreateClaimInput, ip?: string) => {
  requirePermission(actor, "claim:manage");

  const claim = await db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, body.invoiceId)).limit(1);
    if (!invoice) throw notFound("Invoice not found");
    if (invoice.status === "VOID") throw new AppError("PRECONDITION_FAILED", "Cannot claim a void invoice");
    const [insurer] = await tx.select().from(insurers).where(eq(insurers.id, body.insurerId)).limit(1);
    if (!insurer) throw notFound("Insurer not found");

    const [existing] = await tx
      .select({ id: insuranceClaims.id })
      .from(insuranceClaims)
      .where(
        and(
          eq(insuranceClaims.invoiceId, body.invoiceId),
          inArray(insuranceClaims.status, ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED"]),
        ),
      )
      .limit(1);
    if (existing) {
      throw new AppError("CONFLICT", "An open claim already exists for this invoice", { claimId: existing.id });
    }

    const [row] = await tx
      .insert(insuranceClaims)
      .values({
        claimNumber: referenceNumber("CLM"),
        invoiceId: body.invoiceId,
        patientId: invoice.patientId,
        insurerId: body.insurerId,
        planId: body.planId ?? null,
        claimedMinor: body.claimedMinor,
        createdBy: actor.id,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Claim insert failed");

    await tx.insert(claimEvents).values({
      claimId: row.id,
      eventType: "CREATED",
      actorId: actor.id,
      detail: { claimedMinor: body.claimedMinor },
    });

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "claim.create",
        module: "billing",
        entityType: "insurance_claim",
        entityId: row.id,
        detail: { invoiceId: body.invoiceId, claimedMinor: body.claimedMinor },
        ip,
      },
      tx,
    );
    return row;
  });

  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    invoiceId: claim.invoiceId,
    status: claim.status,
    claimedMinor: claim.claimedMinor,
    approvedMinor: claim.approvedMinor,
  };
};

export interface UpdateClaimInput {
  status: ClaimStatus;
  approvedMinor?: number | undefined;
  denialReason?: string | undefined;
  externalRef?: string | undefined;
}

export const updateClaimStatus = async (actor: Actor, id: string, body: UpdateClaimInput, ip?: string) => {
  requirePermission(actor, "claim:manage");

  const row = await db.transaction(async (tx) => {
    const [claim] = await tx.select().from(insuranceClaims).where(eq(insuranceClaims.id, id)).limit(1).for("update");
    if (!claim) throw notFound("Claim not found");
    if (claim.status === body.status) throw new AppError("CONFLICT", "Claim is already in that status");
    if (body.status === "APPROVED" || body.status === "PARTIALLY_APPROVED") {
      if (body.approvedMinor === undefined) {
        throw new AppError("VALIDATION_ERROR", "approvedMinor is required for this status");
      }
      if (body.approvedMinor > claim.claimedMinor) {
        throw new AppError("VALIDATION_ERROR", "approvedMinor cannot exceed claimedMinor");
      }
    }
    if (body.status === "DENIED" && !body.denialReason) {
      throw new AppError("VALIDATION_ERROR", "denialReason is required when denying a claim");
    }

    const decided = ["APPROVED", "PARTIALLY_APPROVED", "DENIED"].includes(body.status);
    const [updated] = await tx
      .update(insuranceClaims)
      .set({
        status: body.status,
        approvedMinor: body.approvedMinor ?? claim.approvedMinor,
        denialReason: body.denialReason ?? claim.denialReason,
        externalRef: body.externalRef ?? claim.externalRef,
        submittedAt: body.status === "SUBMITTED" ? new Date() : claim.submittedAt,
        decidedAt: decided ? new Date() : claim.decidedAt,
        appealDeadline:
          body.status === "DENIED" ? addDays(new Date(), 30).toISOString().slice(0, 10) : claim.appealDeadline,
        updatedAt: new Date(),
      })
      .where(eq(insuranceClaims.id, id))
      .returning();

    await tx.insert(claimEvents).values({
      claimId: id,
      eventType: body.status,
      actorId: actor.id,
      detail: { from: claim.status, approvedMinor: body.approvedMinor ?? null, denialReason: body.denialReason ?? null },
    });

    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "claim.status",
        module: "billing",
        entityType: "insurance_claim",
        entityId: id,
        detail: { from: claim.status, to: body.status },
        ip,
      },
      tx,
    );
    return updated;
  });

  return {
    id: row?.id,
    claimNumber: row?.claimNumber,
    status: row?.status,
    claimedMinor: row?.claimedMinor,
    approvedMinor: row?.approvedMinor,
    denialReason: row?.denialReason,
    decidedAt: row?.decidedAt,
    appealDeadline: row?.appealDeadline,
  };
};

export const billingDashboard = async (actor: Actor) => {
  requirePermission(actor, "dashboard:billing");
  const { start, end } = clinicDayRange();
  const inToday = and(sql`${payments.receivedAt} >= ${start}`, sql`${payments.receivedAt} < ${end}`);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [collectedToday, outstanding, overdue, claimsPending, recentPayments, revenueSeries, invoiceStats] =
    await Promise.all([
      db
        .select({ value: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int` })
        .from(payments)
        .where(and(inToday, eq(payments.status, "CLEARED"))),
      db
        .select({ value: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)::int` })
        .from(invoices)
        .where(inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"])),
      db
        .select({ value: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)::int` })
        .from(invoices)
        .where(and(inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"]), sql`${invoices.dueAt} < now()`)),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(insuranceClaims)
        .where(inArray(insuranceClaims.status, ["SUBMITTED", "UNDER_REVIEW", "APPEALED"])),
      db
        .select({
          id: payments.id,
          paymentNumber: payments.paymentNumber,
          patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
          amountMinor: payments.amountMinor,
          method: payments.method,
          kind: payments.kind,
          receivedAt: payments.receivedAt,
        })
        .from(payments)
        .innerJoin(patients, eq(payments.patientId, patients.id))
        .orderBy(desc(payments.receivedAt))
        .limit(8),
      db
        .select({
          day: sql<string>`to_char(${payments.receivedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          amountMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
        })
        .from(payments)
        .where(and(sql`${payments.receivedAt} >= now() - interval '30 days'`, eq(payments.status, "CLEARED")))
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      db
        .select({
          issuedThisMonth: sql<number>`count(*)::int`,
          billedThisMonth: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::int`,
          paidThisMonth: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)::int`,
        })
        .from(invoices)
        .where(sql`${invoices.issuedAt} >= ${monthStart}`),
    ]);

  return {
    stats: {
      collectedTodayMinor: Number(collectedToday[0]?.value ?? 0),
      outstandingMinor: Number(outstanding[0]?.value ?? 0),
      overdueMinor: Number(overdue[0]?.value ?? 0),
      claimsPending: Number(claimsPending[0]?.value ?? 0),
      invoicedThisMonthMinor: Number(invoiceStats[0]?.billedThisMonth ?? 0),
      collectedThisMonthMinor: Number(invoiceStats[0]?.paidThisMonth ?? 0),
    },
    recentPayments,
    revenueSeries,
  };
};

export const billingReports = async (actor: Actor, fromArg?: string, toArg?: string) => {
  requirePermission(actor, "report:billing");
  const from = fromArg ? new Date(fromArg) : addDays(new Date(), -30);
  const to = toArg ? new Date(toArg) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("VALIDATION_ERROR", "from and to must be ISO dates");
  }

  const [revenueByDay, revenueByMethod, claimOutcomes, ageing] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${payments.receivedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        amountMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(
        and(sql`${payments.receivedAt} >= ${from}`, sql`${payments.receivedAt} <= ${to}`, eq(payments.status, "CLEARED")),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({
        method: payments.method,
        amountMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(and(sql`${payments.receivedAt} >= ${from}`, sql`${payments.receivedAt} <= ${to}`))
      .groupBy(payments.method),
    db
      .select({
        status: insuranceClaims.status,
        count: sql<number>`count(*)::int`,
        claimedMinor: sql<number>`coalesce(sum(${insuranceClaims.claimedMinor}), 0)::int`,
        approvedMinor: sql<number>`coalesce(sum(${insuranceClaims.approvedMinor}), 0)::int`,
      })
      .from(insuranceClaims)
      .groupBy(insuranceClaims.status),
    db
      .select({
        current: sql<number>`coalesce(sum(case when ${invoices.dueAt} >= now() then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        d1to30: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() and ${invoices.dueAt} >= now() - interval '30 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        d31to60: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() - interval '30 days' and ${invoices.dueAt} >= now() - interval '60 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        d61to90: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() - interval '60 days' and ${invoices.dueAt} >= now() - interval '90 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
        over90: sql<number>`coalesce(sum(case when ${invoices.dueAt} < now() - interval '90 days' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)::int`,
      })
      .from(invoices)
      .where(inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"])),
  ]);

  return {
    range: { from, to },
    revenueByDay,
    revenueByMethod,
    claimOutcomes,
    ageing: ageing[0] ?? { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0 },
    collectedMinor: revenueByDay.reduce((sum, row) => sum + Number(row.amountMinor), 0),
  };
};
