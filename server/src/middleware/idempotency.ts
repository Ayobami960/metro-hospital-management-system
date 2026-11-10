import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { idempotencyKeys } from "../db/schema/audit.js";
import { AppError } from "../lib/http.js";

/**
 * Reservation-first idempotency.
 *
 * 1. The key is inserted with `ON CONFLICT DO NOTHING` *before* the handler runs,
 *    so two concurrent retries cannot both execute the write: the loser sees the
 *    reservation and is told the request is still in flight.
 * 2. The stored response is committed before the response is flushed, so an
 *    immediate sequential retry replays instead of duplicating.
 * 3. A failed request (4xx/5xx) releases the reservation, so the caller can fix
 *    the payload and retry with the same key.
 */
export const idempotency =
  (scope: string) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header("idempotency-key");
    if (!key) {
      next();
      return;
    }
    if (key.length > 200) {
      next(new AppError("VALIDATION_ERROR", "Idempotency-Key is too long"));
      return;
    }

    const requestHash = createHash("sha256")
      .update(JSON.stringify(req.body ?? {}))
      .digest("hex");

    try {
      const [reserved] = await db
        .insert(idempotencyKeys)
        .values({ scope, key, requestHash })
        .onConflictDoNothing({ target: [idempotencyKeys.scope, idempotencyKeys.key] })
        .returning({ id: idempotencyKeys.id });

      if (!reserved) {
        const [existing] = await db
          .select()
          .from(idempotencyKeys)
          .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
          .limit(1);

        if (!existing) {
          next(new AppError("CONFLICT", "Could not reserve the Idempotency-Key; retry once"));
          return;
        }
        if (existing.requestHash !== requestHash) {
          next(
            new AppError(
              "IDEMPOTENCY_MISMATCH",
              "Idempotency-Key was reused with a different payload",
            ),
          );
          return;
        }
        if (existing.responseStatus === null || existing.responseBody === null) {
          next(new AppError("CONFLICT", "An identical request is still in progress"));
          return;
        }
        res.status(existing.responseStatus).json(existing.responseBody);
        return;
      }

      const originalJson = res.json.bind(res);
      let flushed = false;
      res.json = (body: unknown) => {
        if (flushed || res.statusCode >= 400) return originalJson(body);
        flushed = true;
        void db
          .update(idempotencyKeys)
          .set({ responseStatus: res.statusCode, responseBody: body as object })
          .where(eq(idempotencyKeys.id, reserved.id))
          .then(() => originalJson(body))
          .catch(() => originalJson(body));
        return res;
      };

      res.on("finish", () => {
        if (res.statusCode >= 400) {
          void db
            .delete(idempotencyKeys)
            .where(eq(idempotencyKeys.id, reserved.id))
            .catch(() => undefined);
        }
      });

      next();
    } catch (error) {
      next(error);
    }
  };
