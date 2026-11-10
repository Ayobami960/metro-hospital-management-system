import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getEquipment,
  getMaintenanceLog,
  getRadiologyOrders,
  getTestCatalogue,
  getTestRanges,
  patchEquipmentStatus,
  patchRadiologyStatus,
  postMaintenance,
  postRadiologyOrder,
  postRadiologyReport,
} from "../controllers/diagnostics.controller.js";

export const diagnosticsRouter = Router();

diagnosticsRouter.get("/lab/tests", authenticate, getTestCatalogue);
diagnosticsRouter.get("/lab/tests/:id/ranges", authenticate, getTestRanges);

diagnosticsRouter.get("/radiology/orders", authenticate, getRadiologyOrders);
diagnosticsRouter.post("/radiology/orders", authenticate, postRadiologyOrder);
diagnosticsRouter.patch("/radiology/orders/:id/status", authenticate, patchRadiologyStatus);
diagnosticsRouter.post("/radiology/orders/:id/report", authenticate, postRadiologyReport);

diagnosticsRouter.get("/equipment", authenticate, getEquipment);
diagnosticsRouter.get("/equipment/maintenance", authenticate, getMaintenanceLog);
diagnosticsRouter.post("/equipment/:id/maintenance", authenticate, postMaintenance);
diagnosticsRouter.patch("/equipment/:id/status", authenticate, patchEquipmentStatus);
