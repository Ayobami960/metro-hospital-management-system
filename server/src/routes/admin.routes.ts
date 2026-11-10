import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  getBeds,
  getDepartmentById,
  getDepartments,
  getDoctorById,
  getDoctors,
  getRoomById,
  getRooms,
  getSpecialties,
  patchBed,
  patchDepartment,
  patchDoctor,
  patchRoom,
  postBedAssign,
  postBedRelease,
  postDepartment,
  postDoctor,
  postRoom,
  postRoomBed,
  postSpecialty,
} from "../controllers/admin.controller.js";

export const adminRouter = Router();

const uuid = z.string().uuid();
const roomTypeEnum = z.enum(["STANDARD", "PRIVATE", "ICU", "EMERGENCY", "ISOLATION"]);
const bedStatusEnum = z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE", "CLEANING"]);
const staffStatusEnum = z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]);

const departmentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional(),
  floor: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  headDoctorId: uuid.optional(),
  bedCapacity: z.coerce.number().int().min(0).max(1000).default(0),
});

const specialtySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
});

const doctorCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: z.string().trim().max(32).optional(),
  licenseNumber: z.string().trim().min(3).max(40),
  licenseExpiry: z.string().datetime().optional(),
  departmentId: uuid.optional(),
  specialtyId: uuid.optional(),
  consultationFeeMinor: z.coerce.number().int().min(0).default(0),
  credentials: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
});

const doctorUpdateSchema = doctorCreateSchema.omit({ email: true }).partial().extend({
  status: staffStatusEnum.optional(),
});

const roomCreateSchema = z.object({
  number: z.string().trim().min(1).max(20),
  floor: z.string().trim().min(1).max(40),
  type: roomTypeEnum.default("STANDARD"),
  departmentId: uuid.optional(),
  bedCount: z.coerce.number().int().min(0).max(12).default(0),
  bedLabels: z.array(z.string().trim().min(1).max(20)).max(12).optional(),
});

const roomUpdateSchema = roomCreateSchema.omit({ bedCount: true, bedLabels: true }).partial();

/* Departments */

adminRouter.get("/departments", authenticate, getDepartments);
adminRouter.post("/departments", authenticate, validate({ body: departmentSchema }), postDepartment);
adminRouter.get("/departments/:id", authenticate, getDepartmentById);
adminRouter.patch("/departments/:id", authenticate, validate({ body: departmentSchema.partial() }), patchDepartment);

/* Specialties */

adminRouter.get("/specialties", authenticate, getSpecialties);
adminRouter.post("/specialties", authenticate, validate({ body: specialtySchema }), postSpecialty);

/* Doctors */

adminRouter.get("/doctors", authenticate, getDoctors);
adminRouter.post("/doctors", authenticate, validate({ body: doctorCreateSchema }), postDoctor);
adminRouter.get("/doctors/:id", authenticate, getDoctorById);
adminRouter.patch("/doctors/:id", authenticate, validate({ body: doctorUpdateSchema }), patchDoctor);

/* Rooms */

adminRouter.get("/rooms", authenticate, getRooms);
adminRouter.post("/rooms", authenticate, validate({ body: roomCreateSchema }), postRoom);
adminRouter.get("/rooms/:id", authenticate, getRoomById);
adminRouter.patch("/rooms/:id", authenticate, validate({ body: roomUpdateSchema }), patchRoom);
adminRouter.post("/rooms/:id/beds", authenticate, validate({ body: z.object({ label: z.string().trim().min(1).max(20) }) }), postRoomBed);

/* Beds */

adminRouter.get("/beds", authenticate, getBeds);
adminRouter.patch("/beds/:id", authenticate, validate({ body: z.object({ status: bedStatusEnum }) }), patchBed);
adminRouter.post(
  "/beds/:id/assign",
  authenticate,
  validate({ body: z.object({ patientId: uuid, admissionId: uuid.optional() }) }),
  postBedAssign,
);
adminRouter.post(
  "/beds/:id/release",
  authenticate,
  validate({ body: z.object({ reason: z.string().trim().max(200).optional() }).default({}) }),
  postBedRelease,
);
