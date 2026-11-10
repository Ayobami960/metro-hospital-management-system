import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";

import {
  listLaboratoryOrders,
  getLaboratoryOrder,
  createLaboratoryOrder,
  cancelLaboratoryOrder,
  assignOrderTechnician,
  collectSpecimen,
  listSpecimens,
  type SpecimenFilters,
  lookupSpecimen,
  updateSpecimenStatus,
  specimenCustodyLog,
  enterResults,
  releaseResults,
  amendResult,
  listResults,
  criticalResults,
  notifyCritical,
  acknowledgeCriticalNotification,
  patientLabResults,
  laboratoryDashboard,
} from "../services/laboratory.service.js";

export const getLaboratoryOrders = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query as any, ["orderedAt", "priority"], "orderedAt");
  const result = await listLaboratoryOrders(actor, query, {
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
  });
  paginated(res, result.rows as any[], result.total, query.page, query.pageSize);
});

export const getLaboratoryOrderDetail = handle(async (req: Request, res: Response) => {
  const order = await getLaboratoryOrder(currentActor(req), String(req.params.id));
  ok(res, order as Record<string, unknown>);
});

export const postLaboratoryOrder = handle(async (req: Request, res: Response) => {
  const body = req.body as any;
  const createdOrder = await createLaboratoryOrder(currentActor(req), body, req.ip);
  created(res, { ...createdOrder, id: (createdOrder as any)?.id });
});

export const patchCancelLaboratoryOrder = handle(async (req: Request, res: Response) => {
  const body = req.body as { reason: string };
  const canceledOrder = await cancelLaboratoryOrder(currentActor(req), String(req.params.id), body.reason, req.ip);
  ok(res, canceledOrder as Record<string, unknown>);
});

export const patchLaboratoryOrdersAssign = handle(async (req: Request, res: Response) => {
  const body = req.body as { technicianId: string };
  const assignedOrder = await assignOrderTechnician(currentActor(req), String(req.params.id), body.technicianId, req.ip);
  ok(res, assignedOrder as Record<string, unknown>);
});

export const postLaboratoryOrderSpecimens = handle(async (req: Request, res: Response) => {
  const body = req.body as { specimenType?: string; barcode?: string; collectedAt?: string; location?: string };
  const createdSpecimen = await collectSpecimen(currentActor(req), String(req.params.id), body, req.ip);
  created(res, createdSpecimen as Record<string, unknown>);
});

export const getSpecimens = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query as any, ["collectedAt"], "collectedAt");
  const result = await listSpecimens(actor, query, {
    status: typeof req.query.status === "string" ? req.query.status as SpecimenFilters["status"] : undefined,
  });
  paginated(res, result.rows as any[], result.total, query.page, query.pageSize);
});

export const getSpecimensLookup = handle(async (req: Request, res: Response) => {
  const specimen = await lookupSpecimen(currentActor(req), String((req.query as any).barcode));
  ok(res, specimen ?? { id: null, barcode: "not-found", status: "UNKNOWN" });
});

export const patchSpecimensStatus = handle(async (req: Request, res: Response) => {
  const body = req.body as { status: string; location?: string; notes?: string };
  const result = await updateSpecimenStatus(currentActor(req), String(req.params.id), body, req.ip);
  ok(res, result as Record<string, unknown>);
});

export const getSpecimenCustody = handle(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query as any, ["createdAt"], "createdAt");
  const result = await specimenCustodyLog(currentActor(req), String(req.params.id), query);
  paginated(res, result.rows as any[], result.total, query.page, query.pageSize);
});

export const postLaboratoryOrderResults = handle(async (req: Request, res: Response) => {
  const body = req.body as { itemId: string; values: Array<{ analyteId: string; valueNumeric?: number; valueText?: string; unit?: string }>; flag?: string; critical?: boolean };
  const result = await enterResults(currentActor(req), String(req.params.id), body, req.ip);
  created(res, {
    inserted: result.inserted,
    critical: result.critical,
  });
});

export const postLaboratoryOrderRelease = handle(async (req: Request, res: Response) => {
  const body = req.body as { itemIds?: string[]; acknowledgedCriticalIds?: string[] };
  const result = await releaseResults(currentActor(req), String(req.params.id), body, req.ip);
  ok(res, {
    order: result.updatedOrder,
    releasedAt: result.releasedAt,
    releasedResultIds: result.releasedResultIds,
  });
});

export const postLaboratoryResultsAmend = handle(async (req: Request, res: Response) => {
  const body = req.body as { valueNumeric?: number; valueText?: string; reason?: string; flag?: string; critical?: boolean };
  const result = await amendResult(currentActor(req), String(req.params.id), body, req.ip);
  created(res, { result });
});

export const getLaboratoryResults = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query as any, ["enteredAt"], "enteredAt");
  const patientId =
    (typeof req.query.patientId === "string" ? req.query.patientId : undefined) ?? (actor.patientId ?? undefined);
  const critical = req.query.critical === "true" ? true : undefined;
  const flag = typeof req.query.flag === "string" ? req.query.flag : undefined;
  const releasedOnly = req.query.releasedOnly === "true" || actor.role === "PATIENT" ? true : undefined;
  const result = await listResults(actor, query, { patientId, critical, flag, releasedOnly });
  paginated(res, result.rows as any[], result.total, query.page, query.pageSize);
});

export const getLaboratoryResultsCritical = handle(async (req: Request, res: Response) => {
  ok(res, await criticalResults(currentActor(req)));
});

export const postCriticalNotifications = handle(async (req: Request, res: Response) => {
  const body = req.body as { labResultId: string; notifiedUserId: string; method?: string; note?: string };
  const result = await notifyCritical(currentActor(req), body, req.ip);
  created(res, result as Record<string, unknown>);
});

export const postCriticalNotificationsAcknowledge = handle(async (req: Request, res: Response) => {
  const body = req.body as { notes?: string };
  const result = await acknowledgeCriticalNotification(currentActor(req), String(req.params.id), body.notes, req.ip);
  ok(res, result as Record<string, unknown>);
});

export const getPatientLabResults = handle(async (req: Request, res: Response) => {
  const results = await patientLabResults(currentActor(req), String(req.params.id));
  ok(res, Array.isArray(results) ? results : []);
});

export const getLaboratoryDashboard = handle(async (_req: Request, res: Response) => {
  const dashboard = await laboratoryDashboard(currentActor(_req));
  ok(res, { panels: dashboard.panels, trends: dashboard.trends });
});
