import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../lib/http.js";

type Source = "body" | "query" | "params";

/** Validates and replaces the request section with the parsed value. */
export const validate =
  (schemas: Partial<Record<Source, ZodTypeAny>>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      for (const source of ["body", "query", "params"] as Source[]) {
        const schema = schemas[source];
        if (!schema) continue;
        const result = schema.safeParse(req[source]);
        if (!result.success) {
          throw new AppError("VALIDATION_ERROR", "Request validation failed", {
            source,
            issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          });
        }
        // Express 5 exposes `query` (and `params`) as prototype getters, so a
        // plain assignment throws in strict mode. Define an own property that
        // shadows the getter with the parsed value instead.
        if (source === "body") {
          req.body = result.data;
        } else {
          Object.defineProperty(req, source, {
            value: result.data,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
