import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { parseMultipart } from "../middleware/upload.js";
import {
  downloadFile,
  getFileById,
  getMyAvatar,
  getMyDocuments,
  getPatientDocuments,
  postAvatar,
  postFile,
  removeFile,
} from "../controllers/files.controller.js";

export const filesRouter = Router();

filesRouter.post("/files", authenticate, parseMultipart, postFile);
filesRouter.get("/files/:id", authenticate, getFileById);
filesRouter.get("/files/:id/download", authenticate, downloadFile);
filesRouter.delete("/files/:id", authenticate, removeFile);

filesRouter.post("/me/avatar", authenticate, parseMultipart, postAvatar);
filesRouter.get("/me/avatar", authenticate, getMyAvatar);

filesRouter.get("/patients/:id/documents", authenticate, getPatientDocuments);
filesRouter.get("/me/documents", authenticate, getMyDocuments);
