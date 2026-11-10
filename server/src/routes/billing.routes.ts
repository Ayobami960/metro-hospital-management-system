import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getBillingDashboard,
  getBillingReports,
  getClaims,
  getInvoiceById,
  getInvoices,
  getOutstanding,
  getPayments,
  patchClaim,
  postClaim,
  postInvoice,
  postPayment,
  postRefund,
  postVoidInvoice,
} from "../controllers/billing.controller.js";

export const billingRouter = Router();

const idObject = z.object({ id: z.string().uuid() });
const money = z.number().int().min(0);
const methodEnum = z.enum(["CASH", "CHECK", "CARD", "INSURANCE", "TRANSFER"]);

const invoiceSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
  taxMinor: money.default(0),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(200),
        cptId: z.string().uuid().optional(),
        quantity: z.number().int().positive().max(10_000).default(1),
        unitPriceMinor: money,
        serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .min(1),
});

const paymentSchema = z.object({
  patientId: z.string().uuid().optional(),
  amountMinor: z.number().int().positive().max(100_000_000),
  method: methodEnum,
  reference: z.string().max(120).optional(),
  provider: z.string().max(40).default("MANUAL"),
  providerRef: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  allocations: z
    .array(z.object({ invoiceId: z.string().uuid(), amountMinor: z.number().int().positive() }))
    .optional(),
});

const claimStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "DENIED",
  "APPEALED",
]);

/* Invoices */

billingRouter.get("/invoices", authenticate, getInvoices);
billingRouter.post("/invoices", authenticate, validate({ body: invoiceSchema }), postInvoice);
billingRouter.get("/invoices/:id", authenticate, validate({ params: idObject }), getInvoiceById);
billingRouter.post(
  "/invoices/:id/void",
  authenticate,
  validate({ params: idObject, body: z.object({ reason: z.string().trim().min(3).max(500) }) }),
  postVoidInvoice,
);

/* Payments */

billingRouter.get("/payments", authenticate, getPayments);
billingRouter.post("/payments", authenticate, validate({ body: paymentSchema }), postPayment);
billingRouter.post(
  "/payments/:id/refund",
  authenticate,
  validate({
    params: idObject,
    body: z.object({ amountMinor: z.number().int().positive(), reason: z.string().trim().min(3).max(500) }),
  }),
  postRefund,
);

/* Outstanding */

billingRouter.get("/billing/outstanding", authenticate, getOutstanding);

/* Claims */

billingRouter.get("/claims", authenticate, getClaims);
billingRouter.post(
  "/claims",
  authenticate,
  validate({
    body: z.object({
      invoiceId: z.string().uuid(),
      insurerId: z.string().uuid(),
      planId: z.string().uuid().optional(),
      claimedMinor: z.number().int().positive(),
    }),
  }),
  postClaim,
);
billingRouter.patch(
  "/claims/:id",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      status: claimStatusEnum,
      approvedMinor: z.number().int().min(0).optional(),
      denialReason: z.string().max(500).optional(),
      externalRef: z.string().max(120).optional(),
    }),
  }),
  patchClaim,
);

/* Dashboard and reports */

billingRouter.get("/billing/dashboard", authenticate, getBillingDashboard);
billingRouter.get("/billing/reports", authenticate, getBillingReports);
