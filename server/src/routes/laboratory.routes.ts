import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getLaboratoryOrders,
  getLaboratoryOrderDetail,
  postLaboratoryOrder,
  patchCancelLaboratoryOrder,
  patchLaboratoryOrdersAssign,
  postLaboratoryOrderSpecimens,
  getSpecimens,
  getSpecimensLookup,
  patchSpecimensStatus,
  getSpecimenCustody,
  postLaboratoryOrderResults,
  postLaboratoryOrderRelease,
  postLaboratoryResultsAmend,
  getLaboratoryResults,
  getLaboratoryResultsCritical,
  postCriticalNotifications,
  postCriticalNotificationsAcknowledge,
  getPatientLabResults,
  getLaboratoryDashboard,
} from "../controllers/laboratory.controller.js";

export const laboratoryRouter = Router();

const idObject = z.object({ id: z.string().uuid() });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
void dateOnly;
const priorityEnum = z.enum(["ROUTINE", "URGENT", "STAT"]);
const specimenStatusEnum = z.enum(["COLLECTED", "IN_TRANSIT", "RECEIVED", "PROCESSING", "ARCHIVED"]);

/* Lab orders */

laboratoryRouter.get("/lab/orders", authenticate, getLaboratoryOrders);
laboratoryRouter.post(
  "/lab/orders",
  authenticate,
  validate({
    body: z.object({
      patientId: z.string().uuid(),
      testIds: z.array(z.string().uuid()).min(1).max(50),
      priority: priorityEnum.default("ROUTINE"),
      clinicalNotes: z.string().max(2000).optional(),
      encounterId: z.string().uuid().optional(),
    }),
  }),
  postLaboratoryOrder,
);
laboratoryRouter.get("/lab/orders/:id", authenticate, validate({ params: idObject }), getLaboratoryOrderDetail);
laboratoryRouter.post(
  "/lab/orders/:id/cancel",
  authenticate,
  validate({ params: idObject, body: z.object({ reason: z.string().trim().min(3).max(500) }) }),
  patchCancelLaboratoryOrder,
);
laboratoryRouter.patch(
  "/lab/orders/:id/assign",
  authenticate,
  validate({ params: idObject, body: z.object({ technicianId: z.string().min(1) }) }),
  patchLaboratoryOrdersAssign,
);
laboratoryRouter.post(
  "/lab/orders/:id/specimens",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      specimenType: z.string().trim().min(1).max(60).default("Blood"),
      barcode: z.string().trim().min(3).max(60).optional(),
      collectedAt: z.string().datetime().optional(),
      location: z.string().max(120).optional(),
    }),
  }),
  postLaboratoryOrderSpecimens,
);
laboratoryRouter.post(
  "/lab/orders/:id/results",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      itemId: z.string().uuid(),
      values: z
        .array(
          z.object({
            analyteId: z.string().uuid(),
            valueNumeric: z.number().optional(),
            valueText: z.string().max(200).optional(),
            unit: z.string().max(40).optional(),
          }),
        )
        .min(1),
    }),
  }),
  postLaboratoryOrderResults,
);
laboratoryRouter.post(
  "/lab/orders/:id/release",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      itemIds: z.array(z.string().uuid()).optional(),
      acknowledgedCriticalIds: z.array(z.string().uuid()).default([]),
    }),
  }),
  postLaboratoryOrderRelease,
);

/* Lab results */

laboratoryRouter.get("/lab/results", authenticate, getLaboratoryResults);
laboratoryRouter.get("/lab/results/critical", authenticate, getLaboratoryResultsCritical);
laboratoryRouter.post(
  "/lab/results/:id/amend",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      valueNumeric: z.number().optional(),
      valueText: z.string().max(200).optional(),
      reason: z.string().trim().min(3).max(500),
    }),
  }),
  postLaboratoryResultsAmend,
);

/* Specimens */

laboratoryRouter.get("/specimens", authenticate, getSpecimens);
laboratoryRouter.get(
  "/specimens/lookup",
  authenticate,
  validate({ query: z.object({ barcode: z.string().trim().min(1) }) }),
  getSpecimensLookup,
);
laboratoryRouter.patch(
  "/specimens/:id/status",
  authenticate,
  validate({
    params: idObject,
    body: z.object({
      status: specimenStatusEnum,
      location: z.string().max(120).optional(),
      notes: z.string().max(500).optional(),
    }),
  }),
  patchSpecimensStatus,
);
laboratoryRouter.get("/specimens/:id/custody", authenticate, validate({ params: idObject }), getSpecimenCustody);

/* Critical notifications */

laboratoryRouter.post(
  "/critical-notifications",
  authenticate,
  validate({
    body: z.object({
      labResultId: z.string().uuid(),
      notifiedUserId: z.string().min(1),
      method: z.enum(["PHONE", "IN_PERSON", "PAGER", "SMS"]).default("PHONE"),
      note: z.string().max(500).optional(),
    }),
  }),
  postCriticalNotifications,
);
laboratoryRouter.post(
  "/critical-notifications/:id/acknowledge",
  authenticate,
  validate({ params: idObject, body: z.object({ notes: z.string().max(500).optional() }).default({}) }),
  postCriticalNotificationsAcknowledge,
);

/* Patient-facing */

laboratoryRouter.get(
  "/patients/:id/lab-results",
  authenticate,
  validate({ params: idObject }),
  getPatientLabResults,
);

/* Dashboard */

laboratoryRouter.get("/lab/dashboard", authenticate, getLaboratoryDashboard);
