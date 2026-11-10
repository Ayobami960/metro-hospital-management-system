import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getAssignedPatients,
  getMedications,
  getNotes,
  getVitals,
  postAdministerMedication,
  postNote,
  postVitals,
} from "../controllers/nursing.controller.js";

export const nursingRouter = Router();

const patientIdParam = z.object({ patientId: z.string().uuid() });
const noteTypeEnum = z.enum(["SOAP", "DAR", "NARRATIVE", "PROGRESS", "CONSULT"]);
const marStatusEnum = z.enum(["DUE", "GIVEN", "HELD", "REFUSED", "MISSED"]);

const vitalsSchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  systolic: z.number().int().min(60).max(250).optional(),
  diastolic: z.number().int().min(30).max(150).optional(),
  heartRate: z.number().int().min(30).max(250).optional(),
  temperatureC: z.number().min(30).max(45).transform((n) => Math.round(n * 10) / 10).optional(),
  respiratoryRate: z.number().int().min(5).max(60).optional(),
  spo2: z.number().int().min(50).max(100).optional(),
  weightKg: z.number().min(0).transform((n) => Math.round(n * 10) / 10).optional(),
  heightCm: z.number().min(0).transform((n) => Math.round(n * 10) / 10).optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

const noteSchema = z.object({
  patientId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(20000),
  type: noteTypeEnum.default("NARRATIVE").optional(),
  encounterId: z.string().uuid().optional(),
});

nursingRouter.get("/nursing/assigned-patients", authenticate, getAssignedPatients);
nursingRouter.post("/vitals", authenticate, validate({ body: vitalsSchema }), postVitals);
nursingRouter.get("/vitals/:patientId", authenticate, validate({ params: patientIdParam }), getVitals);
nursingRouter.post("/notes", authenticate, validate({ body: noteSchema }), postNote);
nursingRouter.get("/notes/:patientId", authenticate, validate({ params: patientIdParam }), getNotes);
nursingRouter.get("/medications/:patientId", authenticate, validate({ params: patientIdParam }), getMedications);
nursingRouter.post(
  "/medications/:id/administer",
  authenticate,
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      status: marStatusEnum,
      holdReason: z.string().max(300).optional().default(""),
      notes: z.string().max(1000).optional().default(""),
    }),
  }),
  postAdministerMedication,
);
