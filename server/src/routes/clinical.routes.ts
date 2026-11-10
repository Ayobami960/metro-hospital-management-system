import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getAllergenReference,
  getAllergies,
  getAllergyFlag,
  getAuditLogs,
  getClinicalSummary,
  getDrugReference,
  getIcd10Reference,
  getMyAccessLog,
  getMyAllergies,
  getMyClinicalSummary,
  getMyProblems,
  getProblems,
  patchAllergy,
  patchProblem,
  postAllergy,
  postNoKnownAllergies,
  postProblem,
  postVerifyAllergy,
} from "../controllers/clinical.controller.js";

export const clinicalRouter = Router();

const idObject = z.object({ id: z.string().uuid() });
const allergyParams = z.object({ id: z.string().uuid(), allergyId: z.string().uuid() });
const problemParams = z.object({ id: z.string().uuid(), problemId: z.string().uuid() });

const severityEnum = z.enum(["MILD", "MODERATE", "SEVERE", "LIFE_THREATENING"]);
const allergyStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ENTERED_IN_ERROR"]);
const problemStatusEnum = z.enum(["ACTIVE", "MONITORING", "RESOLVED"]);
const icd10Schema = z.string().trim().min(2).max(20).optional();

const createAllergySchema = z.object({
  allergen: z.string().trim().min(2).max(120),
  reaction: z.string().trim().max(300).optional(),
  severity: severityEnum.default("MODERATE"),
  status: allergyStatusEnum.default("ACTIVE"),
  onsetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
});

const updateAllergySchema = z.object({
  allergen: z.string().trim().min(2).max(120).optional(),
  reaction: z.string().trim().max(300).nullable().optional(),
  severity: severityEnum.optional(),
  status: allergyStatusEnum.optional(),
  onsetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  reason: z.string().trim().max(300).optional(),
});

const noKnownSchema = z.object({
  noKnownAllergies: z.boolean(),
  reason: z.string().max(300).optional(),
});

const createProblemSchema = z.object({
  diagnosis: z.string().trim().min(2).max(200),
  icd10Code: icd10Schema,
  icd10Id: z.string().uuid().optional(),
  onsetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: problemStatusEnum.default("ACTIVE"),
  managedBy: z.string().min(1).max(128).optional(),
  notes: z.string().max(2000).optional(),
});

const updateProblemSchema = z.object({
  diagnosis: z.string().trim().min(2).max(200).optional(),
  icd10Code: icd10Schema,
  icd10Id: z.string().uuid().nullable().optional(),
  onsetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: problemStatusEnum.optional(),
  managedBy: z.string().min(1).max(128).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  reason: z.string().trim().max(300).optional(),
});

clinicalRouter.get("/patients/:id/allergies", authenticate, validate({ params: idObject }), getAllergies);
clinicalRouter.get("/patients/:id/allergy-flag", authenticate, validate({ params: idObject }), getAllergyFlag);
clinicalRouter.post(
  "/patients/:id/allergies",
  authenticate,
  validate({ params: idObject, body: createAllergySchema }),
  postAllergy,
);
clinicalRouter.patch(
  "/patients/:id/allergies/:allergyId",
  authenticate,
  validate({ params: allergyParams, body: updateAllergySchema }),
  patchAllergy,
);
clinicalRouter.post(
  "/patients/:id/allergies/:allergyId/verify",
  authenticate,
  validate({ params: allergyParams }),
  postVerifyAllergy,
);
clinicalRouter.post(
  "/patients/:id/allergies/no-known",
  authenticate,
  validate({ params: idObject, body: noKnownSchema }),
  postNoKnownAllergies,
);

clinicalRouter.get("/patients/:id/problems", authenticate, validate({ params: idObject }), getProblems);
clinicalRouter.post(
  "/patients/:id/problems",
  authenticate,
  validate({ params: idObject, body: createProblemSchema }),
  postProblem,
);
clinicalRouter.patch(
  "/patients/:id/problems/:problemId",
  authenticate,
  validate({ params: problemParams, body: updateProblemSchema }),
  patchProblem,
);

clinicalRouter.get("/patients/:id/clinical-summary", authenticate, validate({ params: idObject }), getClinicalSummary);
clinicalRouter.get("/me/clinical-summary", authenticate, getMyClinicalSummary);
clinicalRouter.get("/me/allergies", authenticate, getMyAllergies);
clinicalRouter.get("/me/problems", authenticate, getMyProblems);

clinicalRouter.get("/me/access-log", authenticate, getMyAccessLog);
clinicalRouter.get("/audit-logs", authenticate, getAuditLogs);

clinicalRouter.get("/reference/allergens", authenticate, getAllergenReference);
clinicalRouter.get("/reference/icd10", authenticate, getIcd10Reference);
clinicalRouter.get("/reference/drugs", authenticate, getDrugReference);
