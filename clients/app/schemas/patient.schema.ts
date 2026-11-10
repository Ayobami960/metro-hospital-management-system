import { z } from "zod";

/** Mirrors `CreatePatientInput` (`server/src/services/patients.service.ts`). */
export const registerPatientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  sexAtBirth: z.enum(["MALE", "FEMALE", "INTERSEX", "UNKNOWN"]),
  bloodType: z.enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "UNKNOWN"]),
  ssnLast4: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}$/.test(value.replace(/\D/g, "")), "Enter the last 4 digits"),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  addressLine1: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  heightCm: z
    .string()
    .optional()
    .refine((value) => !value || Number(value) > 0, "Enter a height in centimetres"),
  weightKg: z
    .string()
    .optional()
    .refine((value) => !value || Number(value) > 0, "Enter a weight in kilograms"),
  primaryDoctorId: z.string().optional(),
});

export type RegisterPatientValues = z.infer<typeof registerPatientSchema>;
