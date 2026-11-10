import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  allergyFlag,
  createAllergy,
  createProblem,
  listAccessLog,
  listAllergenReference,
  listAllergies,
  listAuditLogs,
  listDrugReference,
  listIcd10,
  listMyAllergies,
  listMyProblems,
  listProblems,
  myClinicalSummary,
  patientClinicalSummary,
  setNoKnownAllergies,
  updateAllergy,
  updateProblem,
  verifyAllergy,
} from "../services/clinical.service.js";

/** Request bodies are validated by the route's zod schema before this runs. */
const body = <T>(req: Request): T => req.body as T;

export const getAllergies = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const includeInactive = String(req.query.includeInactive ?? "") === "true";
  ok(res, await listAllergies(actor, String(req.params.id), includeInactive, req.ip));
});

export const getMyAllergies = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const includeInactive = String(req.query.includeInactive ?? "") === "true";
  ok(res, await listMyAllergies(actor, includeInactive));
});

export const getAllergyFlag = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await allergyFlag(actor, String(req.params.id), req.ip));
});

export const postAllergy = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const row = await createAllergy(actor, String(req.params.id), body(req), req.ip);
  created(res, row, { verified: row.verified });
});

export const patchAllergy = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const row = await updateAllergy(actor, String(req.params.id), String(req.params.allergyId), body(req), req.ip);
  ok(res, row, { verified: row.verified });
});

export const postVerifyAllergy = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await verifyAllergy(actor, String(req.params.id), String(req.params.allergyId), req.ip));
});

export const postNoKnownAllergies = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const { noKnownAllergies, reason } = body<{ noKnownAllergies: boolean; reason?: string }>(req);
  ok(res, await setNoKnownAllergies(actor, String(req.params.id), noKnownAllergies, reason, req.ip));
});

export const getProblems = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const includeResolved = String(req.query.includeResolved ?? "true") !== "false";
  ok(res, await listProblems(actor, String(req.params.id), includeResolved, req.ip));
});

export const getMyProblems = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const includeResolved = String(req.query.includeResolved ?? "true") !== "false";
  ok(res, await listMyProblems(actor, includeResolved));
});

export const postProblem = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  created(res, await createProblem(actor, String(req.params.id), body(req), req.ip));
});

export const patchProblem = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await updateProblem(actor, String(req.params.id), String(req.params.problemId), body(req), req.ip));
});

export const getClinicalSummary = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "patient:read");
  ok(res, await patientClinicalSummary(actor, String(req.params.id), req.ip));
});

export const getMyClinicalSummary = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  ok(res, await myClinicalSummary(actor));
});

export const getMyAccessLog = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, ["createdAt"], "createdAt");
  const result = await listAccessLog(actor, query.pageSize, query.offset);
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const getAuditLogs = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  const query = parseListQuery(req.query, ["createdAt"], "createdAt");
  const result = await listAuditLogs(actor, {
    module: typeof req.query.module === "string" && req.query.module ? req.query.module : undefined,
    level: typeof req.query.level === "string" && req.query.level ? req.query.level : undefined,
    actorId: typeof req.query.actorId === "string" && req.query.actorId ? req.query.actorId : undefined,
    search: query.search,
    pageSize: query.pageSize,
    offset: query.offset,
  });
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});

export const getAllergenReference = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  const search = String(req.query.search ?? "").trim();
  ok(res, listAllergenReference(search), { source: "curated" });
});

export const getIcd10Reference = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  const query = parseListQuery(req.query, ["code", "description"], "code");
  const result = await listIcd10(query.search, query.pageSize, query.offset);
  paginated(res, result.rows, result.total, query.page, result.pageSize);
});

export const getDrugReference = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "reference:read");
  const query = parseListQuery(req.query, ["name"], "name");
  const result = await listDrugReference(query.search, query.pageSize, query.offset);
  paginated(res, result.rows, result.total, query.page, query.pageSize);
});
