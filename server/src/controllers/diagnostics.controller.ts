import type { Request, Response } from "express";
import { z } from "zod";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { badRequest, created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  analyteBands,
  createRadiologyOrder,
  listEquipment,
  listMaintenance,
  listRadiologyOrders,
  logMaintenance,
  setEquipmentServiceState,
  signRadiologyReport,
  testCatalogue,
  updateRadiologyStatus,
} from "../services/diagnostics.service.js";

export const getTestCatalogue = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  ok(res, await testCatalogue(search));
});

export const getTestRanges = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  ok(res, await analyteBands(String(req.params.id)));
});

export const getRadiologyOrders = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "radiology:order");
  const q = parseListQuery(req.query as Record<string, unknown>, ["createdAt"], "createdAt");
  const result = await listRadiologyOrders({
    page: q.page,
    pageSize: q.pageSize,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    search: q.search || undefined,
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

const createSchema = z.object({
  patientId: z.string().uuid(),
  studyType: z.string().trim().min(2).max(80),
  bodyPart: z.string().trim().min(1).max(80),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const postRadiologyOrder = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "radiology:order");
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid radiology order", parsed.error.issues);
  created(res, await createRadiologyOrder(actor, parsed.data));
});

export const patchRadiologyStatus = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "radiology:report");
  const parsed = z
    .object({ status: z.enum(["SCHEDULED", "IN_PROGRESS", "PENDING_READ", "COMPLETED", "CANCELLED"]) })
    .safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid status", parsed.error.issues);
  ok(res, await updateRadiologyStatus(actor, String(req.params.id), parsed.data.status));
});

export const postRadiologyReport = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "radiology:report");
  const parsed = z
    .object({ body: z.string().trim().min(1).max(20000), impression: z.string().trim().max(4000).optional() })
    .safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid radiology report", parsed.error.issues);
  created(res, await signRadiologyReport(actor, String(req.params.id), parsed.data));
});

export const getEquipment = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "equipment:read");
  ok(res, await listEquipment());
});

export const getMaintenanceLog = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "equipment:read");
  const equipmentId = typeof req.query.equipmentId === "string" ? req.query.equipmentId : undefined;
  ok(res, await listMaintenance(equipmentId));
});

const maintenanceSchema = z.object({
  type: z.string().trim().min(2).max(80),
  technician: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  result: z.string().trim().max(40).optional(),
  nextDueAt: z.string().datetime().optional(),
});

export const postMaintenance = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "equipment:write");
  const parsed = maintenanceSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid maintenance entry", parsed.error.issues);
  created(res, await logMaintenance(actor, String(req.params.id), parsed.data));
});

export const patchEquipmentStatus = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "equipment:write");
  const parsed = z
    .object({ outOfService: z.boolean(), reason: z.string().trim().max(300).optional() })
    .safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid equipment status", parsed.error.issues);
  ok(res, await setEquipmentServiceState(actor, String(req.params.id), parsed.data.outOfService, parsed.data.reason));
});
