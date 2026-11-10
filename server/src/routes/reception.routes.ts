import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getQueue,
  postCallNext,
  postQueueComplete,
  postQueueEntry,
  postQueueRemove,
  postQueueStart,
} from "../controllers/reception.controller.js";

export const receptionRouter = Router();

const addSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  type: z.enum(["WALK_IN", "APPOINTMENT"]).default("WALK_IN"),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  notes: z.string().max(500).optional(),
  appointmentId: z.string().uuid().optional(),
});

receptionRouter.get("/queue", authenticate, getQueue);
receptionRouter.post("/queue", authenticate, validate({ body: addSchema }), postQueueEntry);
receptionRouter.post("/queue/call-next", authenticate, postCallNext);
receptionRouter.post("/queue/:id/start", authenticate, postQueueStart);
receptionRouter.post("/queue/:id/complete", authenticate, postQueueComplete);
receptionRouter.post("/queue/:id/remove", authenticate, postQueueRemove);
