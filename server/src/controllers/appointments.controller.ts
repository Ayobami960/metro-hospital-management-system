import type { Request, Response } from "express";
import type { Actor } from "../lib/authorize.js";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  availableSlots,
  bookAppointment,
  decideAppointment,
  listAppointments,
  type BookingInput,
} from "../services/appointments.service.js";

export const getAppointments = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "appointment:read");
  const q = parseListQuery(req.query as Record<string, unknown>, ["startsAt", "createdAt"], "startsAt");
  const result = await listAppointments(actor, {
    page: q.page,
    pageSize: q.pageSize,
    offset: q.offset,
    search: q.search,
    sort: q.sort,
    order: q.order,
    patientId: typeof req.query.patientId === "string" ? req.query.patientId : undefined,
    doctorId: typeof req.query.doctorId === "string" ? req.query.doctorId : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    date: typeof req.query.date === "string" ? req.query.date : undefined,
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

export const getAvailability = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "appointment:read");
  ok(res, await availableSlots(String(req.query.doctorId), String(req.query.date)));
});

export const postAppointment = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "appointment:create");
  const appointment = await bookAppointment(actor, req.body as BookingInput, req.ip);
  created(res, { id: appointment.id, status: appointment.status, startsAt: appointment.startsAt, endsAt: appointment.endsAt });
});

const decide =
  (to: "CONFIRMED" | "CANCELLED", allowedFrom: Array<"REQUESTED" | "SCHEDULED" | "CONFIRMED" | "CHECKED_IN">) =>
  handle(async (req: Request, res: Response) => {
    const actor: Actor = currentActor(req);
    requirePermission(actor, to === "CONFIRMED" ? "appointment:approve" : "appointment:cancel");
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    const row = await decideAppointment(actor, String(req.params.id), to, reason, allowedFrom, req.ip);
    ok(res, { id: row.id, status: row.status });
  });

export const postApproveAppointment = decide("CONFIRMED", ["REQUESTED", "SCHEDULED"]);
export const postCancelAppointment = decide("CANCELLED", ["REQUESTED", "SCHEDULED", "CONFIRMED", "CHECKED_IN"]);
