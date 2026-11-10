import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  deleteDoctorTimeOff,
  getDoctorAvailability,
  getDoctorTimeOff,
  getSchedulableDoctors,
  getScheduleBoard,
  postDoctorTimeOff,
  putDoctorAvailability,
} from "../controllers/scheduling.controller.js";

export const schedulingRouter = Router();

schedulingRouter.get("/schedule/doctors", authenticate, getSchedulableDoctors);
schedulingRouter.get("/schedule/board", authenticate, getScheduleBoard);
schedulingRouter.get("/schedule/availability", authenticate, getDoctorAvailability);
schedulingRouter.put("/schedule/availability", authenticate, putDoctorAvailability);
schedulingRouter.get("/schedule/time-off", authenticate, getDoctorTimeOff);
schedulingRouter.post("/schedule/time-off", authenticate, postDoctorTimeOff);
schedulingRouter.delete("/schedule/time-off/:id", authenticate, deleteDoctorTimeOff);
