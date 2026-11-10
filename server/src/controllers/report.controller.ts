import type { Request, Response } from "express";
import type { Actor } from "../lib/authorize.js";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { badRequest, handle, ok } from "../lib/http.js";
import { can } from "../config/permissions.js";
import {
  clinicalReport,
  doctorAnalytics,
  financialReport,
  operationalReport,
  reportsOverview,
  staffReport,
} from "../services/report.service.js";

const daysFrom = (req: Request, fallback: number): number => {
  const raw = req.query.days;
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > 1095) throw badRequest("days must be between 1 and 1095");
  return Math.trunc(value);
};

export const getReportsOverview = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "report:billing");
  ok(res, await reportsOverview());
});

export const getFinancialReport = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "report:billing");
  ok(res, await financialReport(daysFrom(req, 365)));
});

export const getClinicalReport = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "report:clinical");
  ok(res, await clinicalReport(daysFrom(req, 180)));
});

export const getOperationalReport = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "report:billing");
  ok(res, await operationalReport(daysFrom(req, 90)));
});

export const getStaffReport = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "report:billing");
  ok(res, await staffReport(daysFrom(req, 30)));
});

export const getDoctorAnalytics = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "report:clinical");
  const doctorId = actor.doctorId ?? (typeof req.query.doctorId === "string" ? req.query.doctorId : null);
  if (!doctorId) throw badRequest("A doctor profile is required for this report");
  ok(res, await doctorAnalytics(doctorId, daysFrom(req, 90)));
});

/** Catalogue of downloadable exports, filtered to what the caller may fetch. */
export const getReportCatalogue = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req) as Actor;
  requirePermission(actor, "report:clinical");
  const entries = [
    {
      id: "patients",
      name: "Patient register",
      category: "clinical",
      endpoint: "/exports/patients",
      format: "xlsx",
      requires: "patient:export" as const,
    },
    {
      id: "appointments",
      name: "Appointment log",
      category: "operational",
      endpoint: "/exports/appointments",
      format: "xlsx",
      requires: "appointment:read" as const,
    },
    {
      id: "invoices",
      name: "Invoice ledger",
      category: "financial",
      endpoint: "/exports/invoices",
      format: "xlsx",
      requires: "invoice:read" as const,
    },
    {
      id: "lab-results",
      name: "Laboratory results",
      category: "clinical",
      endpoint: "/exports/lab-results",
      format: "xlsx",
      requires: "lab:result:read" as const,
    },
    {
      id: "audit-logs",
      name: "Audit trail",
      category: "compliance",
      endpoint: "/exports/audit-logs",
      format: "xlsx",
      requires: "audit:export" as const,
    },
  ];
  ok(
    res,
    entries.filter((entry) => can(actor.role, entry.requires)),
  );
});
