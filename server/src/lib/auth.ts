import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import * as schema from "../db/schema/index.js";
import type { UserRole } from "../db/schema/enums.js";
import { writeAudit } from "../lib/audit.js";
import { logger } from "../lib/logger.js";
import { isRoomAccessRole } from "../lib/roles.js";
import { issueOtp } from "../services/otp.service.js";
import { consumeRoomAccess, ROOM_ACCESS_COOKIE } from "../services/room-access.service.js";

type CookieContext = {
  getCookie?: (name: string) => string | null;
  setCookie?: (name: string, value: string, options?: Record<string, unknown>) => string;
};

/**
 * better-auth with the Drizzle adapter. `role` and `status` are additional
 * fields so the RBAC layer can read them from the session user; they are not
 * client-writable (`input: false`).
 *
 * Two database hooks enforce the corrected workflow:
 *  - a new account receives an EMAIL_VERIFICATION code immediately;
 *  - a fully onboarded staff session may only be created after a valid Room
 *    Access authorization was obtained with the Daily Access Code. That
 *    authorization is consumed here, so it can never be reused as a login
 *    session. First-time staff are allowed a session to verify their email and
 *    complete their profile, but every dashboard route remains gated.
 */
export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  // Must match the mount point in app.ts (`/api/v1/auth`), otherwise every
  // auth route 404s: better-auth defaults to `/api/auth`.
  basePath: "/api/v1/auth",
  secret: env.betterAuthSecret,
  trustedOrigins: [env.frontendOrigin],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      twoFactor: schema.twoFactor,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    // Email verification is enforced by `auth-progress.service.ts` so the
    // account can obtain a session, receive the OTP and finish onboarding. No
    // dashboard endpoint is reachable before verification.
    requireEmailVerification: false,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "PATIENT", input: false },
      status: { type: "string", required: false, defaultValue: "ACTIVE", input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await issueOtp(
              { id: user.id, name: user.name, email: user.email },
              "EMAIL_VERIFICATION",
            );
          } catch (error) {
            // The account exists and the verify screen can request a resend.
            logger.error({ err: error, userId: user.id }, "email verification code not issued");
          }
        },
      },
    },
    session: {
      create: {
        before: async (session, context) => {
          const [row] = await db
            .select({
              role: schema.users.role,
              status: schema.users.status,
              emailVerified: schema.users.emailVerified,
              onboardingCompletedAt: schema.users.onboardingCompletedAt,
            })
            .from(schema.users)
            .where(eq(schema.users.id, session.userId))
            .limit(1);
          if (!row) throw new APIError("BAD_REQUEST", { message: "Account not found" });

          if (row.status !== "ACTIVE") {
            throw new APIError("FORBIDDEN", { message: "This account is not active." });
          }
          if (!isRoomAccessRole(row.role as UserRole)) return;

          // First-time staff activate through the invitation flow: they need a
          // session to verify their email and complete their profile, so the
          // Room Access gate applies only once that onboarding is finished.
          // The dashboard itself stays behind the progress gate until then.
          if (!row.emailVerified || !row.onboardingCompletedAt) return;

          const cookieContext = context as CookieContext | null;
          const token = cookieContext?.getCookie?.(ROOM_ACCESS_COOKIE) ?? null;
          const authorization = await consumeRoomAccess(
            token,
            session.userId,
            row.role as UserRole,
          );
          if (!authorization) {
            throw new APIError("FORBIDDEN", {
              message: "Verify your Room Access Daily Code before signing in.",
            });
          }

          cookieContext?.setCookie?.(ROOM_ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
          await writeAudit({
            actorId: session.userId,
            actorRole: row.role,
            action: "auth.room_access.consumed",
            module: "identity",
            entityType: "user",
            entityId: session.userId,
            level: "SUCCESS",
          });
        },
      },
    },
  },
  // 2FA is implemented in `services/two-factor.service.ts` so the TOTP secret
  // can be encrypted with the application key. The built-in plugin stores
  // plaintext secrets, which this project does not allow.
  plugins: [],
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProduction,
    },
  },
});

export type Auth = typeof auth;
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};
