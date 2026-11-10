import { z } from "zod";

/**
 * Reusable validation schemas for the administrations screens.
 *
 * Server-side Zod validators stay authoritative; these mirror them so the user
 * sees field errors before the request and the payload is type-safe.
 */

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(120),
  code: z.string().trim().max(20).optional(),
  floor: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  headDoctorId: z.string().optional(),
  bedCapacity: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), "Use a whole number"),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;

export const doctorSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(40).optional(),
  licenseNumber: z.string().trim().min(1, "License number is required").max(60),
  licenseExpiry: z.string().optional(),
  departmentId: z.string().optional(),
  specialtyId: z.string().optional(),
  consultationFee: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+(\.\d{1,2})?$/.test(value), "Enter an amount such as 150.00"),
  credentials: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
});

export type DoctorFormValues = z.infer<typeof doctorSchema>;

export const roomSchema = z.object({
  number: z.string().trim().min(1, "Room number is required").max(20),
  floor: z.string().trim().min(1, "Floor is required").max(40),
  type: z.enum(["STANDARD", "PRIVATE", "ICU", "EMERGENCY", "ISOLATION"]).optional(),
  departmentId: z.string().optional(),
  bedCount: z
    .string()
    .optional()
    .refine((value) => !value || /^[1-9]\d?$/.test(value), "Between 1 and 99 beds"),
});

export type RoomFormValues = z.infer<typeof roomSchema>;
