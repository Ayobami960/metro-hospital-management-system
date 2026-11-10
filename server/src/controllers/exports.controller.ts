import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { handle } from "../lib/http.js";
import { buildCsv, buildXlsx, exportFileName } from "../lib/tabular.js";
import {
  exportAppointments,
  exportAuditLogs,
  exportInvoices,
  exportLabResults,
  exportPatients,
  parseExportRange,
  ROW_LIMIT,
  type ExportResult,
} from "../services/exports.service.js";

/** Turns a prepared dataset into a download response. */
const sendExport = async <T>(res: Response, result: ExportResult<T>): Promise<void> => {
  const body = result.format === "csv" ? buildCsv(result.dataset) : await buildXlsx(result.dataset);
  res.status(200);
  res.setHeader(
    "Content-Type",
    result.format === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${exportFileName(result.name, result.format)}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Export-Rows", String(result.dataset.rows.length));
  if (result.total > ROW_LIMIT) res.setHeader("X-Export-Truncated", "true");
  res.send(body);
};

export const getExportPatients = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:export");
  const range = parseExportRange(req.query.from, req.query.to, req.query.format);
  await sendExport(res, await exportPatients(actor, range, req.ip));
});

export const getExportAppointments = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "appointment:read");
  const range = parseExportRange(req.query.from, req.query.to, req.query.format);
  await sendExport(res, await exportAppointments(actor, range, req.ip));
});

export const getExportInvoices = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "invoice:read");
  const range = parseExportRange(req.query.from, req.query.to, req.query.format);
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
  await sendExport(res, await exportInvoices(actor, range, patientId, req.ip));
});

export const getExportLabResults = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "lab:result:read");
  const range = parseExportRange(req.query.from, req.query.to, req.query.format);
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
  await sendExport(res, await exportLabResults(actor, range, patientId, req.ip));
});

export const getExportAuditLogs = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "audit:export");
  const range = parseExportRange(req.query.from, req.query.to, req.query.format);
  await sendExport(res, await exportAuditLogs(actor, range, req.ip));
});
