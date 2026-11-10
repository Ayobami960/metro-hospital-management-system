import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  addBed,
  assignBed,
  createDepartment,
  createDoctor,
  createRoom,
  createSpecialty,
  getDepartment,
  getDoctor,
  getRoom,
  listBeds,
  listDepartments,
  listDoctors,
  listRooms,
  listSpecialties,
  releaseBed,
  setBedStatus,
  updateDepartment,
  updateDoctor,
  updateRoom,
  BED_SORTS,
  DEPARTMENT_SORTS,
  DOCTOR_SORTS,
  ROOM_SORTS,
  SPECIALTY_SORTS,
  type BedStatus,
  type RoomType,
  type StaffStatus,
} from "../services/admin.service.js";

const str = (value: unknown): string | undefined => (typeof value === "string" && value ? value : undefined);

/* Departments */

export const getDepartments = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, DEPARTMENT_SORTS, "name");
  const result = await listDepartments(actor, query, str(req.query.floor));
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const postDepartment = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  created(res, await createDepartment(actor, req.body, req.ip));
});

export const getDepartmentById = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await getDepartment(actor, String(req.params.id)));
});

export const patchDepartment = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await updateDepartment(actor, String(req.params.id), req.body, req.ip));
});

/* Specialties */

export const getSpecialties = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, SPECIALTY_SORTS, "name");
  const result = await listSpecialties(actor, query);
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const postSpecialty = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  created(res, await createSpecialty(actor, req.body, req.ip));
});

/* Doctors */

export const getDoctors = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, DOCTOR_SORTS, "name");
  const result = await listDoctors(actor, query, {
    specialtyId: str(req.query.specialtyId),
    departmentId: str(req.query.departmentId),
    status: str(req.query.status) as StaffStatus | undefined,
  });
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const postDoctor = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  created(res, await createDoctor(actor, req.body, req.ip));
});

export const getDoctorById = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await getDoctor(actor, String(req.params.id)));
});

export const patchDoctor = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await updateDoctor(actor, String(req.params.id), req.body, req.ip));
});

/* Rooms */

export const getRooms = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, ROOM_SORTS, "number");
  const result = await listRooms(actor, query, {
    floor: str(req.query.floor),
    type: str(req.query.type) as RoomType | undefined,
    departmentId: str(req.query.departmentId),
  });
  paginated(res, result.rows, result.total, query.page, query.pageSize, { summary: result.summary });
});

export const postRoom = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  created(res, await createRoom(actor, req.body, req.ip));
});

export const getRoomById = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await getRoom(actor, String(req.params.id)));
});

export const patchRoom = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await updateRoom(actor, String(req.params.id), req.body, req.ip));
});

/* Beds */

export const postRoomBed = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const { label } = req.body as { label: string };
  created(res, await addBed(actor, String(req.params.id), label, req.ip));
});

export const getBeds = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, BED_SORTS, "label");
  const result = await listBeds(actor, query, {
    roomId: str(req.query.roomId),
    floor: str(req.query.floor),
    status: str(req.query.status) as BedStatus | undefined,
  });
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const patchBed = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const { status } = req.body as { status: BedStatus };
  ok(res, await setBedStatus(actor, String(req.params.id), status, req.ip));
});

export const postBedAssign = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  created(res, await assignBed(actor, String(req.params.id), req.body, req.ip));
});

export const postBedRelease = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const reason = (req.body as { reason?: string } | undefined)?.reason;
  ok(res, await releaseBed(actor, String(req.params.id), reason, req.ip));
});
