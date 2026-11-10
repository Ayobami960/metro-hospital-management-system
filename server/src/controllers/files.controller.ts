import type { Request } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { AppError, created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  deleteFile,
  getAvatar,
  getFile,
  getFileDownloadUrl,
  listMyDocuments,
  listPatientDocuments,
  uploadAvatar,
  uploadFile,
} from "../services/files.service.js";

const requireUpload = (req: Request) => {
  const file = req.file;
  if (!file) throw new AppError("VALIDATION_ERROR", "A multipart file field named 'file' is required");
  return file;
};

const pageQuery = (req: Request) => parseListQuery(req.query, ["createdAt"]);

export const postFile = handle(async (req, res) => {
  const actor = currentActor(req);
  const file = requireUpload(req);
  const record = await uploadFile(
    actor,
    {
      buffer: file.buffer,
      originalName: file.originalname || "",
      ownerType: String(req.body.ownerType ?? ""),
      ownerId: req.body.ownerId ? String(req.body.ownerId) : null,
      patientId: req.body.patientId ? String(req.body.patientId) : null,
    },
    req.ip,
  );
  created(res, record);
});

export const getFileById = handle(async (req, res) => {
  const actor = currentActor(req);
  ok(res, await getFile(actor, String(req.params.id)));
});

export const downloadFile = handle(async (req, res) => {
  const actor = currentActor(req);
  const { url } = await getFileDownloadUrl(actor, String(req.params.id), req.ip);
  res.setHeader("Cache-Control", "private, no-store");
  res.redirect(302, url);
});

export const removeFile = handle(async (req, res) => {
  const actor = currentActor(req);
  ok(res, await deleteFile(actor, String(req.params.id), req.ip));
});

export const postAvatar = handle(async (req, res) => {
  const actor = currentActor(req);
  const file = requireUpload(req);
  created(res, await uploadAvatar(actor, file.buffer, file.originalname || "", req.ip));
});

export const getMyAvatar = handle(async (req, res) => {
  const actor = currentActor(req);
  ok(res, await getAvatar(actor));
});

export const getPatientDocuments = handle(async (req, res) => {
  const actor = currentActor(req);
  const query = pageQuery(req);
  const { rows, total } = await listPatientDocuments(
    actor,
    String(req.params.id),
    query.page,
    query.pageSize,
    req.ip,
  );
  paginated(res, rows, total, query.page, query.pageSize);
});

export const getMyDocuments = handle(async (req, res) => {
  const actor = currentActor(req);
  const query = pageQuery(req);
  const { rows, total } = await listMyDocuments(actor, query.page, query.pageSize);
  paginated(res, rows, total, query.page, query.pageSize);
});
