import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getAppointments,
  getAvailability,
  postAppointment,
  postApproveAppointment,
  postCancelAppointment,
} from "../controllers/appointments.controller.js";

export const appointmentsRouter = Router();

const createSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  startsAt: z.string().datetime(),
  mode: z.enum(["IN_PERSON", "VIRTUAL"]).default("IN_PERSON"),
  type: z.string().max(40).default("Consultation"),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  reason: z.string().max(500).optional(),
  symptoms: z.string().max(1000).optional(),
  /** Staff book confirmed appointments; patient requests stay REQUESTED for approval. */
  requestApproval: z.boolean().default(false),
});

appointmentsRouter.get("/appointments", authenticate, getAppointments);
appointmentsRouter.get("/appointments/availability", authenticate, getAvailability);
appointmentsRouter.post("/appointments", authenticate, validate({ body: createSchema }), postAppointment);
appointmentsRouter.post("/appointments/:id/approve", authenticate, postApproveAppointment);
appointmentsRouter.post("/appointments/:id/cancel", authenticate, postCancelAppointment);
