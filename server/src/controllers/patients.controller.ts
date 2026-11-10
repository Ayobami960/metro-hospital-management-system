import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  findPatientDuplicates,
  getPatient,
  listPatients,
  PATIENT_SORTS,
  registerPatient,
  verifyEligibility,
  type RegisterPatientInput,
} from "../services/patients.service.js";

export const getPatients = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:read");
  const q = parseListQuery(req.query as Record<string, unknown>, PATIENT_SORTS, "createdAt");
  const result = await listPatients(actor, {
    page: q.page,
    pageSize: q.pageSize,
    offset: q.offset,
    search: q.search,
    sort: q.sort,
    order: q.order,
  });
  paginated(res, result.rows, result.total, q.page, q.pageSize);
});

export const postCheckDuplicates = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "patient:create");
  const { firstName, lastName, dateOfBirth } = req.body as {
    firstName?: string;
    lastName: string;
    dateOfBirth: string;
  };
  ok(res, { candidates: await findPatientDuplicates(firstName ?? "", lastName, dateOfBirth) });
});

export const getPatientById = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:read");
  ok(res, await getPatient(actor, String(req.params.id), req.ip));
});

export const postPatient = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:create");
  const patient = await registerPatient(actor, req.body as RegisterPatientInput, req.ip);
  created(res, { id: patient.id, mrn: patient.mrn, name: `${patient.firstName} ${patient.lastName}` });
});

export const postEligibility = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:read");
  ok(res, await verifyEligibility(String(req.params.id)));
});
