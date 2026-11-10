import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { idempotency } from "../middleware/idempotency.js";
import {
  getPatientById,
  getPatients,
  postCheckDuplicates,
  postEligibility,
  postPatient,
} from "../controllers/patients.controller.js";

export const patientsRouter = Router();

const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sexAtBirth: z.enum(["MALE", "FEMALE", "INTERSEX", "UNKNOWN"]).default("UNKNOWN"),
  bloodType: z
    .enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "UNKNOWN"])
    .default("UNKNOWN"),
  phone: z.string().trim().max(32).optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  postalCode: z.string().max(16).optional(),
  heightCm: z.coerce.number().positive().max(300).optional(),
  weightKg: z.coerce.number().positive().max(500).optional(),
  ssnLast4: z.string().regex(/^\d{4}$/).optional(),
  primaryDoctorId: z.string().uuid().optional(),
  insurance: z
    .object({
      insurerId: z.string().uuid(),
      planId: z.string().uuid(),
      policyNumber: z.string().min(1),
      groupNumber: z.string().optional(),
      memberId: z.string().optional(),
    })
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1),
      relationship: z.enum(["SPOUSE", "PARENT", "CHILD", "SIBLING", "GUARDIAN", "OTHER"]),
      phone: z.string().min(3),
    })
    .optional(),
  allowDuplicate: z.boolean().default(false),
});

patientsRouter.get("/patients", authenticate, getPatients);
patientsRouter.post(
  "/patients/check-duplicates",
  authenticate,
  validate({ body: z.object({ firstName: z.string().optional(), lastName: z.string().min(1), dateOfBirth: z.string() }) }),
  postCheckDuplicates,
);
patientsRouter.get("/patients/:id", authenticate, getPatientById);
patientsRouter.post("/patients", authenticate, idempotency("patients:register"), validate({ body: registerSchema }), postPatient);
patientsRouter.post("/patients/:id/eligibility", authenticate, postEligibility);
