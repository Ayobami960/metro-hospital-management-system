import type { Request, Response } from "express";
import { z } from "zod";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { badRequest, created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  cancelPrescription,
  checkInteractions,
  createPrescription,
  decideRefill,
  ensureMarSchedule,
  getPrescription,
  listDrugs,
  listInteractions,
  listPrescriptions,
  listRefillRequests,
  marBoard,
  requestRefill,
} from "../services/prescribing.service.js";

export const getPrescriptions = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "prescription:read");
  const q = parseListQuery(req.query as Record<string, unknown>, ["createdAt", "status"], "createdAt");
  const result = await listPrescriptions(actor, {
    page: q.page,
    pageSize: q.pageSize,
    search: q.search,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    sort: (q.sort === "status" || q.sort === "patient" ? q.sort : "createdAt") as "createdAt" | "status" | "patient",
    order: q.order,
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

export const postCreatePrescription = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const result = await createPrescription(actor, req.body, req.ip);
  created(res, result.prescription, { allergies: result.conflicts, overrideUsed: result.overrideUsed });
});

export const getPrescriptionDetail = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "prescription:read");
  ok(res, await getPrescription(actor, String(req.params.id)));
});

export const postCancelPrescription = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "prescription:write");
  const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
  ok(res, await cancelPrescription(actor, String(req.params.id), reason));
});

export const postPrescriptionMar = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "mar:read");
  const days = Number(req.body?.days ?? 7);
  created(res, await ensureMarSchedule(String(req.params.id), Number.isFinite(days) ? Math.min(14, Math.max(1, days)) : 7));
});

export const getMarBoard = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "mar:read");
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
  ok(res, await marBoard(actor, patientId));
});

export const getRefillRequests = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "prescription:read");
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  ok(res, await listRefillRequests(actor, status));
});

const refillSchema = z.object({
  prescriptionItemId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
});

export const postRefillRequest = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "refill:request");
  const parsed = refillSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid refill request", parsed.error.issues);
  created(res, await requestRefill(actor, parsed.data.prescriptionItemId, parsed.data.reason));
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "DENIED"]),
  note: z.string().trim().max(300).optional(),
});

export const postRefillDecision = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "refill:decide");
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid refill decision", parsed.error.issues);
  ok(res, await decideRefill(actor, String(req.params.id), parsed.data.decision, parsed.data.note));
});

export const getDrugs = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  ok(res, await listDrugs(search, category));
});

export const getDrugInteractions = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "interaction:check");
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  ok(res, await listInteractions(search));
});

const checkSchema = z.object({ drugIds: z.array(z.string().uuid()).min(2).max(30) });

export const postInteractionCheck = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "interaction:check");
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid interaction check", parsed.error.issues);
  ok(res, await checkInteractions(parsed.data.drugIds));
});
