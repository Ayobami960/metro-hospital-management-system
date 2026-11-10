import type { Request, Response } from "express";
import { z } from "zod";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { badRequest, created, handle, ok } from "../lib/http.js";
import {
  createTimeOff,
  deleteTimeOff,
  getAvailability,
  listTimeOff,
  replaceAvailability,
  schedulableDoctors,
  scheduleBoard,
} from "../services/scheduling.service.js";

const resolveDoctorId = (req: Request): string => {
  const actor = currentActor(req);
  if (actor.role === "DOCTOR" && actor.doctorId) return actor.doctorId;
  const fromQuery = typeof req.query.doctorId === "string" ? req.query.doctorId : null;
  const fromBody = typeof req.body?.doctorId === "string" ? req.body.doctorId : null;
  const id = fromBody ?? fromQuery ?? actor.doctorId;
  if (!id) throw badRequest("doctorId is required");
  return id;
};

export const getSchedulableDoctors = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "appointment:read");
  ok(res, await schedulableDoctors());
});

export const getDoctorAvailability = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "appointment:read");
  ok(res, await getAvailability(resolveDoctorId(req)));
});

const windowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  slotMinutes: z.number().int().min(5).max(120).optional(),
  breakStartMinute: z.number().int().min(0).max(1439).nullable().optional(),
  breakEndMinute: z.number().int().min(0).max(1440).nullable().optional(),
  maxDailyPatients: z.number().int().min(1).max(80).optional(),
});

export const putDoctorAvailability = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "appointment:approve");
  const parsed = z.object({ windows: z.array(windowSchema).max(50) }).safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid availability", parsed.error.issues);
  ok(res, await replaceAvailability(actor, resolveDoctorId(req), parsed.data.windows));
});

export const getDoctorTimeOff = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "appointment:read");
  ok(res, await listTimeOff(resolveDoctorId(req)));
});

const timeOffSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().max(300).optional(),
});

export const postDoctorTimeOff = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "appointment:approve");
  const parsed = timeOffSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid time off", parsed.error.issues);
  created(res, await createTimeOff(actor, resolveDoctorId(req), parsed.data));
});

export const deleteDoctorTimeOff = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "appointment:approve");
  ok(res, await deleteTimeOff(actor, resolveDoctorId(req), String(req.params.id)));
});

export const getScheduleBoard = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "appointment:read");
  const from = typeof req.query.from === "string" ? req.query.from : new Date().toISOString().slice(0, 10);
  ok(res, await scheduleBoard(resolveDoctorId(req), from));
});
