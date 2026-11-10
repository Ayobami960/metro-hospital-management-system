import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../lib/http.js";
import { MAX_FILE_BYTES } from "../services/files.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 8 },
}).single("file");

/** Parses the single `file` multipart field and maps multer errors to the API envelope. */
export const parseMultipart = (req: Request, res: Response, next: NextFunction): void => {
  upload(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      next(
        new AppError(
          error.code === "LIMIT_FILE_SIZE" ? "VALIDATION_ERROR" : "BAD_REQUEST",
          error.code === "LIMIT_FILE_SIZE" ? `File exceeds ${MAX_FILE_BYTES} bytes` : error.message,
          { field: "file", code: error.code },
        ),
      );
      return;
    }
    next(error);
  });
};
