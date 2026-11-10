import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  administerMedication,
  createNote,
  listAssignedPatients,
  listMedications,
  listNotes,
  listVitals,
  recordVitals,
  type NoteInput,
  type VitalsInput,
} from "../services/nursing.service.js";

const listOptions = (req: Request) => {
  const q = parseListQuery(req.query as Record<string, unknown>, ["createdAt"], "createdAt");
  return { page: q.page, pageSize: q.pageSize, offset: q.offset, search: q.search };
};

export const getAssignedPatients = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:read");
  const options = listOptions(req);
  const result = await listAssignedPatients(actor, options);
  paginated(res, result.rows, result.total, options.page, options.pageSize);
});

export const postVitals = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "vitals:write");
  const vital = await recordVitals(actor, req.body as VitalsInput, req.ip);
  ok(res, {
    id: vital.id,
    patientId: vital.patientId,
    recordedBy: vital.recordedBy,
    recordedAt: vital.recordedAt,
    systolic: vital.systolic,
    diastolic: vital.diastolic,
    heartRate: vital.heartRate,
    temperatureC: vital.temperatureC !== null ? Number(vital.temperatureC) : null,
    respiratoryRate: vital.respiratoryRate,
    spo2: vital.spo2,
    weightKg: vital.weightKg !== null ? Number(vital.weightKg) : null,
    heightCm: vital.heightCm !== null ? Number(vital.heightCm) : null,
    painScore: vital.painScore,
    notes: vital.notes,
  });
});

export const getVitals = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "vitals:read");
  const options = listOptions(req);
  const result = await listVitals(actor, String(req.params.patientId), options);
  paginated(res, result.rows, result.total, options.page, options.pageSize);
});

export const postNote = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "note:write");
  const note = await createNote(actor, req.body as NoteInput, req.ip);
  created(res, {
    id: note.id,
    patientId: note.patientId,
    encounterId: note.encounterId,
    authorId: note.authorId,
    type: note.type,
    title: note.title,
    content: note.content,
    status: note.status,
    currentVersion: note.currentVersion,
    createdAt: note.createdAt,
  });
});

export const getNotes = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "note:read");
  const options = listOptions(req);
  const result = await listNotes(actor, String(req.params.patientId), options);
  paginated(res, result.rows, result.total, options.page, options.pageSize);
});

export const getMedications = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "mar:read");
  const options = listOptions(req);
  const result = await listMedications(actor, String(req.params.patientId), options);
  paginated(res, result.rows, result.total, options.page, options.pageSize);
});

export const postAdministerMedication = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "mar:administer");
  const row = await administerMedication(
    actor,
    String(req.params.id),
    req.body as { status: "DUE" | "GIVEN" | "HELD" | "REFUSED" | "MISSED"; holdReason?: string; notes?: string },
    req.ip,
  );
  ok(res, {
    id: row.id,
    status: row.status,
    administeredAt: row.administeredAt,
    administeredBy: row.administeredBy,
    holdReason: row.holdReason,
    notes: row.notes,
  });
});
