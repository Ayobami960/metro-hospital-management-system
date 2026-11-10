import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { AppError, handle, ok } from "../lib/http.js";
import {
  adminDashboard,
  doctorDashboard,
  nurseDashboard,
  operationCounts,
  patientDashboard,
  patientTimeline,
  receptionDashboard,
  systemHealth,
  wardOverview,
} from "../services/dashboard.service.js";

/**
 * Dashboards are read-only projections: the controller resolves the caller's
 * scope from the session, never from the query string, so one role cannot read
 * another role's aggregate.
 */

export const getAdminDashboard = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "dashboard:admin");
  ok(res, await adminDashboard());
});

export const getDoctorDashboard = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "dashboard:doctor");
  const doctorId = actor.doctorId ?? (typeof req.query.doctorId === "string" ? req.query.doctorId : null);
  if (!doctorId) throw new AppError("PRECONDITION_FAILED", "No doctor profile linked to this account");
  ok(res, await doctorDashboard(doctorId));
});

export const getNurseDashboard = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "dashboard:nurse");
  ok(res, await nurseDashboard(actor.id));
});

export const getPatientDashboard = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "dashboard:patient");
  const patientId = actor.patientId ?? (typeof req.query.patientId === "string" ? req.query.patientId : null);
  if (!patientId) throw new AppError("PRECONDITION_FAILED", "No patient record linked to this account");
  ok(res, await patientDashboard(patientId));
});

export const getReceptionDashboard = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "dashboard:reception");
  ok(res, await receptionDashboard());
});

export const getWardOverview = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "dashboard:nurse");
  const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
  ok(res, await wardOverview(departmentId));
});

export const getPatientTimeline = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:read");
  const patientId = String(req.params.id);
  if (actor.role === "PATIENT" && actor.patientId !== patientId) {
    throw new AppError("NOT_FOUND", "Patient not found");
  }
  ok(res, await patientTimeline(patientId));
});

export const getOperationCounts = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "dashboard:admin");
  ok(res, await operationCounts());
});

export const getSystemHealth = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "dashboard:admin");
  ok(res, await systemHealth());
});
