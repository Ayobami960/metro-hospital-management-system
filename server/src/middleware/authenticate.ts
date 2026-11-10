import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { auth } from "../lib/auth.js";
import { db } from "../db/client.js";
import { doctors } from "../db/schema/reference.js";
import { patients } from "../db/schema/patients.js";
import { sessions, users } from "../db/schema/identity.js";
import type { Actor } from "../lib/authorize.js";
import { unauthenticated } from "../lib/http.js";
import type { UserRole } from "../db/schema/enums.js";
import { enforceProgress, evaluateProgress } from "../services/auth-progress.service.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
      sessionId?: string;
    }
  }
}

/**
 * Routes reachable before the account finishes its challenges: the account
 * endpoints report progress, verify the email / patient code / TOTP and submit
 * the mandatory profile. Invitation endpoints are public. Everything else is
 * gated below.
 */
const EXEMPT_PREFIXES = ["/account", "/invitations"];

const isExempt = (req: Request): boolean => {
  const relative = req.path;
  const absolute = (req.originalUrl ?? "").split("?")[0] ?? "";
  return EXEMPT_PREFIXES.some(
    (prefix) => relative.startsWith(prefix) || absolute.includes(`/api/v1${prefix}`),
  );
};

/**
 * Resolves the better-auth session into an Actor, then enforces the login
 * progress gates server-side: an unverified or un-onboarded session gets 403
 * with a stable reason instead of any dashboard data, regardless of what the
 * client does.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) throw unauthenticated();

    const [row] = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        emailVerified: users.emailVerified,
        onboardingCompletedAt: users.onboardingCompletedAt,
        twoFactorEnabled: users.twoFactorEnabled,
        sessionId: sessions.id,
        mfaVerifiedAt: sessions.mfaVerifiedAt,
        mfaMethod: sessions.mfaMethod,
        revokedAt: sessions.revokedAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, session.session.id), eq(sessions.userId, session.user.id)))
      .limit(1);

    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
      throw unauthenticated("Session is no longer valid");
    }
    if (row.status !== "ACTIVE") throw unauthenticated("Account is not active");

    let patientId: string | null = null;
    let doctorId: string | null = null;
    if (row.role === "PATIENT") {
      const [p] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.userId, row.userId))
        .limit(1);
      patientId = p?.id ?? null;
    }
    if (row.role === "DOCTOR") {
      const [d] = await db
        .select({ id: doctors.id })
        .from(doctors)
        .where(eq(doctors.userId, row.userId))
        .limit(1);
      doctorId = d?.id ?? null;
    }

    req.actor = {
      id: row.userId,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      patientId,
      doctorId,
    };
    req.sessionId = row.sessionId;

    if (!isExempt(req)) {
      enforceProgress(
        await evaluateProgress(
          {
            id: row.userId,
            role: row.role as UserRole,
            emailVerified: row.emailVerified,
            onboardingCompletedAt: row.onboardingCompletedAt,
            twoFactorEnabled: row.twoFactorEnabled,
          },
          { mfaVerifiedAt: row.mfaVerifiedAt, mfaMethod: row.mfaMethod },
        ),
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const currentActor = (req: Request): Actor => {
  if (!req.actor) throw unauthenticated();
  return req.actor;
};

export const currentSessionId = (req: Request): string | undefined => req.sessionId;
