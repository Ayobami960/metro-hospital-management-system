import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getAdminDashboard,
  getDoctorDashboard,
  getNurseDashboard,
  getOperationCounts,
  getPatientDashboard,
  getPatientTimeline,
  getReceptionDashboard,
  getSystemHealth,
  getWardOverview,
} from "../controllers/dashboard.controller.js";

/**
 * Role dashboards. Each path is guarded by the dashboard permission for that
 * role, so the aggregate a caller receives always matches their own scope.
 */
export const dashboardRouter = Router();

dashboardRouter.get("/dashboards/admin", authenticate, getAdminDashboard);
dashboardRouter.get("/dashboards/doctor", authenticate, getDoctorDashboard);
dashboardRouter.get("/dashboards/nurse", authenticate, getNurseDashboard);
dashboardRouter.get("/dashboards/patient", authenticate, getPatientDashboard);
dashboardRouter.get("/dashboards/reception", authenticate, getReceptionDashboard);

dashboardRouter.get("/ward/overview", authenticate, getWardOverview);
dashboardRouter.get("/patients/:id/timeline", authenticate, getPatientTimeline);
dashboardRouter.get("/operations/counts", authenticate, getOperationCounts);
dashboardRouter.get("/operations/health", authenticate, getSystemHealth);
