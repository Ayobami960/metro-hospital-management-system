import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  billingDashboard,
  billingReports,
  createClaim,
  createInvoice,
  getInvoice,
  listClaims,
  listInvoices,
  listPayments,
  outstandingInvoices,
  recordPayment,
  refundPayment,
  updateClaimStatus,
  voidInvoice,
} from "../services/billing.service.js";

const str = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);
const date = (value: unknown): Date | undefined =>
  typeof value === "string" && value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : undefined;

/* Invoices */

export const getInvoices = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, ["issuedAt", "dueAt", "totalMinor"], "issuedAt");
  const result = await listInvoices(actor, query, {
    status: str(req.query.status),
    patientId: str(req.query.patientId),
    from: date(req.query.from),
    to: date(req.query.to),
  });
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const getInvoiceById = handle(async (req: Request, res: Response) => {
  ok(res, await getInvoice(currentActor(req), String(req.params.id)));
});

export const postInvoice = handle(async (req: Request, res: Response) => {
  created(res, await createInvoice(currentActor(req), req.body, req.ip));
});

export const postVoidInvoice = handle(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  ok(res, await voidInvoice(currentActor(req), String(req.params.id), reason, req.ip));
});

/* Payments */

export const getPayments = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, ["receivedAt", "amountMinor"], "receivedAt");
  const result = await listPayments(actor, query, {
    patientId: str(req.query.patientId),
    method: str(req.query.method),
    kind: str(req.query.kind),
  });
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const postPayment = handle(async (req: Request, res: Response) => {
  created(res, await recordPayment(currentActor(req), req.body, req.ip));
});

export const postRefund = handle(async (req: Request, res: Response) => {
  const { amountMinor, reason } = req.body as { amountMinor: number; reason: string };
  created(res, await refundPayment(currentActor(req), String(req.params.id), amountMinor, reason, req.ip));
});

/* Outstanding */

export const getOutstanding = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, ["dueAt", "totalMinor"], "dueAt");
  const result = await outstandingInvoices(actor, query, str(req.query.patientId));
  paginated(res, result.rows, result.total, query.page, query.pageSize, { buckets: result.buckets });
});

/* Claims */

export const getClaims = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, ["submittedAt", "claimedMinor"], "submittedAt");
  const result = await listClaims(actor, query, {
    status: str(req.query.status),
    insurerId: str(req.query.insurerId),
  });
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const postClaim = handle(async (req: Request, res: Response) => {
  created(res, await createClaim(currentActor(req), req.body, req.ip));
});

export const patchClaim = handle(async (req: Request, res: Response) => {
  ok(res, await updateClaimStatus(currentActor(req), String(req.params.id), req.body, req.ip));
});

/* Dashboard and reports */

export const getBillingDashboard = handle(async (_req: Request, res: Response) => {
  ok(res, await billingDashboard(currentActor(_req)));
});

export const getBillingReports = handle(async (req: Request, res: Response) => {
  ok(res, await billingReports(currentActor(req), str(req.query.from), str(req.query.to)));
});
