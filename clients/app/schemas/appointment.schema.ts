import { z } from "zod";

/** Mirrors `CreateAppointmentInput` / the server booking validator. */
export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().optional(),
  startsAt: z.string().min(1, "Pick a date and time"),
  mode: z.enum(["IN_PERSON", "VIRTUAL"]),
  type: z.string().trim().max(60).optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]),
  reason: z.string().trim().max(500).optional(),
});

export type AppointmentFormValues = z.infer<typeof appointmentSchema>;
