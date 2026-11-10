import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { roomAccessSessions, users } from "../db/schema/index.js";
import { env } from "../config/env.js";
import type { UserRole } from "../db/schema/enums.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { isRoomAccessRole, type RoomAccessRole } from "../lib/roles.js";

/**
 * Room Access authorization.
 *
 * A verified Daily Room Access Code produces this short-lived, server-side
 * permission. It is separate from better-auth sessions and can only be redeemed
 * by the same account during a normal password sign-in.
 */

export const ROOM_ACCESS_COOKIE = "hms_room_access";

export const roomAccessCookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: env.auth.otp.roomAccessSessionTtlMinutes * 60_000,
};

export interface RoomAccessSessionView {
  id: string;
  userId: string;
  role: RoomAccessRole;
  email: string;
  name: string;
  expiresAt: Date;
}

export const createRoomAccessSession = async (
  user: { id: string; role: UserRole },
  meta: { ip?: string | undefined; userAgent?: string | undefined },
): Promise<{ token: string; expiresAt: Date; role: RoomAccessRole }> => {
  if (!isRoomAccessRole(user.role)) {
    throw new Error("Only eligible hospital staff can obtain a Room Access session");
  }

  const now = new Date();
  // One active Room Access authorization per account.
  await db
    .update(roomAccessSessions)
    .set({ consumedAt: now, updatedAt: now })
    .where(and(eq(roomAccessSessions.userId, user.id), isNull(roomAccessSessions.consumedAt)));

  const token = randomToken(32);
  const expiresAt = new Date(now.getTime() + env.auth.otp.roomAccessSessionTtlMinutes * 60_000);
  await db.insert(roomAccessSessions).values({
    tokenHash: sha256(token),
    userId: user.id,
    role: user.role,
    expiresAt,
    ipAddress: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return { token, expiresAt, role: user.role };
};

/** Reads an authorization without consuming it (used by the login form). */
export const findActiveRoomAccess = async (
  token: string | null | undefined,
): Promise<RoomAccessSessionView | null> => {
  if (!token) return null;
  const [row] = await db
    .select({
      id: roomAccessSessions.id,
      userId: roomAccessSessions.userId,
      role: roomAccessSessions.role,
      expiresAt: roomAccessSessions.expiresAt,
      email: users.email,
      name: users.name,
      status: users.status,
      emailVerified: users.emailVerified,
    })
    .from(roomAccessSessions)
    .innerJoin(users, eq(users.id, roomAccessSessions.userId))
    .where(and(eq(roomAccessSessions.tokenHash, sha256(token)), isNull(roomAccessSessions.consumedAt)))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.status !== "ACTIVE" || !row.emailVerified) return null;
  if (!isRoomAccessRole(row.role)) return null;

  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    email: row.email,
    name: row.name,
    expiresAt: row.expiresAt,
  };
};

/**
 * Atomically consumes the authorization for the account that just proved its
 * password. A token issued to a different account or role is refused.
 */
export const consumeRoomAccess = async (
  token: string | null | undefined,
  userId: string,
  role: UserRole,
): Promise<RoomAccessSessionView | null> => {
  const session = await findActiveRoomAccess(token);
  if (!session) return null;
  if (session.userId !== userId) return null;
  if (session.role !== role) return null;

  const now = new Date();
  const [consumed] = await db
    .update(roomAccessSessions)
    .set({ consumedAt: now, updatedAt: now })
    .where(and(eq(roomAccessSessions.id, session.id), isNull(roomAccessSessions.consumedAt)))
    .returning({ id: roomAccessSessions.id });

  return consumed ? session : null;
};
