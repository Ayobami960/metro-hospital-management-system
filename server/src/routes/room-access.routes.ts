import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema/identity.js";
import type { UserRole } from "../db/schema/enums.js";
import { env } from "../config/env.js";
import { AppError, handle, ok } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import {
  isRoomAccessRole,
  portalLabelForRole,
  portalLoginPathForRole,
} from "../lib/roles.js";
import { issueOtp, verifyOtp } from "../services/otp.service.js";
import {
  consumeRoomAccess,
  createRoomAccessSession,
  findActiveRoomAccess,
  ROOM_ACCESS_COOKIE,
  roomAccessCookieOptions,
} from "../services/room-access.service.js";

/**
 * Public Room Access endpoints.
 *
 * A hospital staff member proves control of their registered hospital email
 * with a Daily Access Code. Success only creates a short-lived Room Access
 * authorization; it never creates a login session. The normal password form is
 * still required, and the role is always read from the database.
 */
export const roomAccessRouter = Router();

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const emailKey = (req: { ip?: string | undefined; body?: unknown }): string => {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "unknown";
  return `${email}:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
};

const sendLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: emailKey,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: emailKey,
});

const findEligibleStaff = async (email: string) => {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (!row) return null;
  if (row.status !== "ACTIVE" || !row.emailVerified) return null;
  if (!isRoomAccessRole(row.role)) return null;
  return row;
};

roomAccessRouter.post(
  "/room-access/send",
  sendLimiter,
  validateBody(z.object({ email: z.string().trim().email().max(254) })),
  handle(async (req, res) => {
    const email = normalizeEmail((req.body as { email: string }).email);
    const staff = await findEligibleStaff(email);

    // Always the same public response: account existence and role are never
    // disclosed. Ineligible accounts simply receive nothing.
    if (staff) {
      try {
        const result = await issueOtp(
          { id: staff.id, name: staff.name, email: staff.email },
          "DAILY_ROOM_ACCESS",
          { force: true },
        );
        await writeAudit({
          actorId: staff.id,
          actorRole: staff.role,
          action: "auth.room_access.requested",
          module: "identity",
          entityType: "user",
          entityId: staff.id,
          level: "INFO",
          detail: { delivered: result.delivered },
          ip: req.ip,
        });
      } catch {
        // Rate limited or mail provider failure: still indistinguishable.
      }
    }

    ok(res, {
      requested: true,
      message:
        "If that address belongs to an authorized hospital staff account, a Daily Access Code is on its way.",
    });
  }),
);

roomAccessRouter.post(
  "/room-access/verify",
  verifyLimiter,
  validateBody(
    z.object({
      email: z.string().trim().email().max(254),
      code: z.string().trim().min(4).max(12),
    }),
  ),
  handle(async (req, res) => {
    const body = req.body as { email: string; code: string };
    const email = normalizeEmail(body.email);
    const staff = await findEligibleStaff(email);

    if (!staff) {
      throw new AppError("VALIDATION_ERROR", "That code is not valid or has expired.");
    }

    try {
      await verifyOtp(staff.id, "DAILY_ROOM_ACCESS", body.code);
    } catch {
      await writeAudit({
        actorId: staff.id,
        actorRole: staff.role,
        action: "auth.room_access.rejected",
        module: "identity",
        entityType: "user",
        entityId: staff.id,
        level: "WARNING",
        ip: req.ip,
      });
      throw new AppError("VALIDATION_ERROR", "That code is not valid or has expired.");
    }

    // Re-check after consuming: an account suspended between send and verify
    // must not receive an authorization.
    const current = await findEligibleStaff(email);
    if (!current || current.id !== staff.id) {
      throw new AppError("VALIDATION_ERROR", "That code is not valid or has expired.");
    }

    const authorization = await createRoomAccessSession(
      { id: current.id, role: current.role as UserRole },
      { ip: req.ip, userAgent: req.get("user-agent") },
    );

    res.cookie(ROOM_ACCESS_COOKIE, authorization.token, roomAccessCookieOptions);
    await writeAudit({
      actorId: current.id,
      actorRole: current.role,
      action: "auth.room_access.verified",
      module: "identity",
      entityType: "user",
      entityId: current.id,
      level: "SUCCESS",
      detail: { role: current.role },
      ip: req.ip,
    });

    const role = current.role as Parameters<typeof portalLoginPathForRole>[0];
    ok(res, {
      verified: true,
      role,
      portalLabel: portalLabelForRole(role),
      loginPath: portalLoginPathForRole(role),
      expiresAt: authorization.expiresAt,
    });
  }),
);

roomAccessRouter.get(
  "/room-access/session",
  handle(async (req, res) => {
    const session = await findActiveRoomAccess(req.cookies?.[ROOM_ACCESS_COOKIE] as string | undefined);
    if (!session) {
      ok(res, { active: false });
      return;
    }
    ok(res, {
      active: true,
      role: session.role,
      portalLabel: portalLabelForRole(session.role),
      loginPath: portalLoginPathForRole(session.role),
      expiresAt: session.expiresAt,
    });
  }),
);

roomAccessRouter.delete(
  "/room-access/session",
  handle(async (req, res) => {
    const token = req.cookies?.[ROOM_ACCESS_COOKIE] as string | undefined;
    const session = await findActiveRoomAccess(token);
    if (session && token) {
      await consumeRoomAccess(token, session.userId, session.role);
    }
    res.clearCookie(ROOM_ACCESS_COOKIE, { path: "/" });
    ok(res, { revoked: true });
  }),
);

/* Local zod body validation kept next to the public endpoints. */
function validateBody(schema: z.ZodType): import("express").RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new AppError("VALIDATION_ERROR", "Invalid request", {
          issues: parsed.error.issues,
        }),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}
