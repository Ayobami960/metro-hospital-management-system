import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getDrugInteractions,
  getDrugs,
  getMarBoard,
  getPrescriptionDetail,
  getPrescriptions,
  getRefillRequests,
  postCancelPrescription,
  postCreatePrescription,
  postInteractionCheck,
  postPrescriptionMar,
  postRefillDecision,
  postRefillRequest,
} from "../controllers/prescribing.controller.js";

export const prescribingRouter = Router();

const prescriptionSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  allergyOverride: z.boolean().default(false),
  overrideReason: z.string().trim().max(300).optional(),
  items: z
    .array(
      z.object({
        drugId: z.string().uuid(),
        dose: z.string().trim().min(1).max(80),
        frequency: z.string().trim().min(1).max(80),
        route: z.enum(["PO", "IV", "SQ", "IM", "TOPICAL", "INHALED", "RECTAL", "OPHTHALMIC"]).default("PO"),
        durationDays: z.number().int().positive().max(365).optional(),
        quantity: z.number().positive().max(100000),
        unit: z.string().max(40).default("tablet"),
        refillsAuthorized: z.number().int().min(0).max(12).default(0),
        instructions: z.string().max(500).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .min(1)
    .max(20),
});

prescribingRouter.get("/prescriptions", authenticate, getPrescriptions);
prescribingRouter.post("/prescriptions", authenticate, validate({ body: prescriptionSchema }), postCreatePrescription);
prescribingRouter.get("/prescriptions/:id", authenticate, getPrescriptionDetail);
prescribingRouter.post("/prescriptions/:id/cancel", authenticate, postCancelPrescription);
prescribingRouter.post("/prescriptions/:id/mar", authenticate, postPrescriptionMar);

prescribingRouter.get("/mar", authenticate, getMarBoard);

prescribingRouter.get("/refills", authenticate, getRefillRequests);
prescribingRouter.post("/refills", authenticate, postRefillRequest);
prescribingRouter.post("/refills/:id/decide", authenticate, postRefillDecision);

prescribingRouter.get("/drugs", authenticate, getDrugs);
prescribingRouter.get("/drugs/interactions", authenticate, getDrugInteractions);
prescribingRouter.post("/drugs/interactions/check", authenticate, postInteractionCheck);
