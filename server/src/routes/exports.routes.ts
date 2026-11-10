import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getExportAppointments,
  getExportAuditLogs,
  getExportInvoices,
  getExportLabResults,
  getExportPatients,
} from "../controllers/exports.controller.js";

export const exportsRouter = Router();

exportsRouter.get("/exports/patients", authenticate, getExportPatients);
exportsRouter.get("/exports/appointments", authenticate, getExportAppointments);
exportsRouter.get("/exports/invoices", authenticate, getExportInvoices);
exportsRouter.get("/exports/lab-results", authenticate, getExportLabResults);
exportsRouter.get("/exports/audit-logs", authenticate, getExportAuditLogs);
