import type { Request, Response } from "express";
import { z } from "zod";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { badRequest, created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  assignableRoles,
  createUser,
  listCptCodes,
  listDepartmentsLite,
  listInsurancePlans,
  listInsurers,
  listSpecialtiesLite,
  listUsers,
  updateUser,
} from "../services/directory.service.js";

const roleEnum = z.enum(["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "PATIENT", "RECEPTION", "PHARMACY", "LABORATORY", "BILLING"]);

export const getUsers = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "user:read");
  const q = parseListQuery(req.query as Record<string, unknown>, ["name"], "name");
  const result = await listUsers({
    page: q.page,
    pageSize: q.pageSize,
    search: q.search || undefined,
    role: typeof req.query.role === "string" ? req.query.role : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize, { assignableRoles: assignableRoles() });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  role: roleEnum,
  phone: z.string().trim().max(32).optional(),
  title: z.string().trim().max(80).optional(),
  employeeId: z.string().trim().max(40).optional(),
});

export const postUser = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "user:create");
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid user payload", parsed.error.issues);
  if (["SUPER_ADMIN", "ADMIN"].includes(parsed.data.role)) requirePermission(actor, "user:role");
  created(res, await createUser(actor, parsed.data));
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  role: roleEnum.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "LOCKED", "DEACTIVATED"]).optional(),
});

export const patchUser = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "user:read");
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid user payload", parsed.error.issues);
  if (parsed.data.role !== undefined) requirePermission(actor, "user:role");
  if (parsed.data.status !== undefined) requirePermission(actor, "user:deactivate");
  ok(res, await updateUser(actor, String(req.params.id), parsed.data));
});

export const getInsurers = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  ok(res, await listInsurers());
});

export const getInsurancePlans = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  const insurerId = typeof req.query.insurerId === "string" ? req.query.insurerId : undefined;
  ok(res, await listInsurancePlans(insurerId));
});

export const getCptCodes = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  ok(res, await listCptCodes(search));
});

export const getDepartmentsLite = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  ok(res, await listDepartmentsLite());
});

export const getSpecialtiesLite = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  ok(res, await listSpecialtiesLite());
});
