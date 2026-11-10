import { z } from "zod";

/** Mirrors `CreatePrescriptionInput` (`server/src/services/prescribing.service.ts`). */
export const prescriptionSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  drugId: z.string().min(1, "Select a drug"),
  dose: z.string().trim().min(1, "Dose is required").max(60),
  frequency: z.string().trim().min(1, "Frequency is required").max(60),
  route: z.enum(["PO", "IV", "SQ", "IM", "TOPICAL", "INHALED", "RECTAL", "OPHTHALMIC"]),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((value) => Number(value) > 0, "Quantity must be greater than zero"),
  durationDays: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), "Use whole days"),
  refillsAuthorized: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), "Use whole numbers"),
  instructions: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]),
  allergyOverride: z.boolean().optional(),
  overrideReason: z.string().trim().max(300).optional(),
});

export type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

/** New allergy / problem entries captured in the EMR. */
export const allergySchema = z.object({
  allergen: z.string().trim().min(1, "Allergen is required").max(120),
  reaction: z.string().trim().max(200).optional(),
  severity: z.enum(["MILD", "MODERATE", "SEVERE", "LIFE_THREATENING"]),
  notes: z.string().trim().max(300).optional(),
});

export type AllergyFormValues = z.infer<typeof allergySchema>;

export const problemSchema = z.object({
  diagnosis: z.string().trim().min(1, "Diagnosis is required").max(200),
  icd10Code: z.string().trim().max(20).optional(),
  status: z.enum(["ACTIVE", "MONITORING", "RESOLVED"]),
  notes: z.string().trim().max(300).optional(),
});

export type ProblemFormValues = z.infer<typeof problemSchema>;
