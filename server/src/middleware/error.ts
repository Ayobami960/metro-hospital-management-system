import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, errorBody } from "../lib/http.js";
import { logger } from "../lib/logger.js";

/**
 * Drizzle wraps driver failures in its own error, so the Postgres SQLSTATE lives
 * on the cause chain. Walking it is what turns a unique violation into 409 and
 * an exclusion-constraint conflict into SLOT_TAKEN instead of a 500.
 */
const postgresCode = (error: unknown): string | undefined => {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
};

export { postgresCode };

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json(errorBody(new AppError("NOT_FOUND", "Route not found")));
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = res.getHeader("X-Request-Id");

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error({ err: error, requestId, path: req.path }, "request failed");
    }
    res.status(error.status).json(errorBody(error));
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  const pgCode = postgresCode(error);
  if (pgCode === "23505") {
    res.status(409).json(errorBody(new AppError("CONFLICT", "Resource already exists")));
    return;
  }
  if (pgCode === "23P01") {
    res.status(409).json(errorBody(new AppError("SLOT_TAKEN", "That time slot is already booked")));
    return;
  }

  logger.error({ err: message, requestId, path: req.path }, "unhandled error");
  res.status(500).json(errorBody(new AppError("INTERNAL_ERROR", "Internal server error")));
};
