import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getClinicalReport,
  getDoctorAnalytics,
  getFinancialReport,
  getOperationalReport,
  getReportCatalogue,
  getReportsOverview,
  getStaffReport,
} from "../controllers/report.controller.js";

export const reportRouter = Router();

reportRouter.get("/reports/overview", authenticate, getReportsOverview);
reportRouter.get("/reports/financial", authenticate, getFinancialReport);
reportRouter.get("/reports/clinical", authenticate, getClinicalReport);
reportRouter.get("/reports/operational", authenticate, getOperationalReport);
reportRouter.get("/reports/staff", authenticate, getStaffReport);
reportRouter.get("/reports/catalogue", authenticate, getReportCatalogue);
reportRouter.get("/reports/doctor-analytics", authenticate, getDoctorAnalytics);
