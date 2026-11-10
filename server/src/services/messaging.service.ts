import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  conversationParticipants,
  conversations,
  doctors,
  messages,
  notifications,
  patients,
  users,
} from "../db/schema/index.js";
import { AppError, badRequest, notFound } from "../lib/http.js";
import { initials } from "../lib/crypto.js";

/**
 * Secure messaging and in-app notifications.
 *
 * A conversation is only ever visible to its participants, so every query is
 * filtered by the caller's participant row. Notifications are addressed to a
 * single user and are the only rows the bell/feed reads.
 */

const displayName = sql<string>`${users.name}`;

export interface MessagingActor {
  id: string;
  name: string;
  role: string;
}

const assertParticipant = async (conversationId: string, userId: string) => {
  const [row] = await db
    .select({ id: conversationParticipants.id, lastReadAt: conversationParticipants.lastReadAt })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  if (!row) throw notFound("Conversation not found");
  return row;
};

export const listConversations = async (userId: string) => {
  const rows = await db
    .select({
      id: conversations.id,
      subject: conversations.subject,
      type: conversations.type,
      patientId: conversations.patientId,
      patientName: sql<string | null>`${patients.firstName} || ' ' || ${patients.lastName}`,
      lastMessageAt: conversations.lastMessageAt,
      lastReadAt: conversationParticipants.lastReadAt,
      unreadCount: sql<number>`(
        select count(*)::int from hms.message m
        where m.conversation_id = ${conversations.id}
          and m.sender_id <> ${userId}
          and (${conversationParticipants.lastReadAt} is null or m.created_at > ${conversationParticipants.lastReadAt})
      )`,
      lastMessage: sql<string | null>`(
        select m.body from hms.message m where m.conversation_id = ${conversations.id}
        order by m.created_at desc limit 1
      )`,
      lastSenderId: sql<string | null>`(
        select m.sender_id from hms.message m where m.conversation_id = ${conversations.id}
        order by m.created_at desc limit 1
      )`,
    })
    .from(conversationParticipants)
    .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
    .leftJoin(patients, eq(conversations.patientId, patients.id))
    .where(eq(conversationParticipants.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(200);

  if (rows.length === 0) return [];

  const participants = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      userId: users.id,
      name: displayName,
      role: sql<string>`${users.role}::text`,
    })
    .from(conversationParticipants)
    .innerJoin(users, eq(conversationParticipants.userId, users.id))
    .where(inArray(conversationParticipants.conversationId, rows.map((row) => row.id)));

  const byConversation = new Map<string, Array<{ id: string; name: string; role: string; avatarInitials: string }>>();
  for (const participant of participants) {
    const list = byConversation.get(participant.conversationId) ?? [];
    list.push({
      id: participant.userId,
      name: participant.name,
      role: participant.role,
      avatarInitials: initials(participant.name),
    });
    byConversation.set(participant.conversationId, list);
  }

  return rows.map((row) => {
    const people = byConversation.get(row.id) ?? [];
    const others = people.filter((person) => person.id !== userId);
    return {
      id: row.id,
      subject: row.subject,
      type: row.type,
      patientId: row.patientId,
      patientName: row.patientName,
      lastMessageAt: row.lastMessageAt,
      lastMessage: row.lastMessage,
      lastSenderId: row.lastSenderId,
      unreadCount: Number(row.unreadCount ?? 0),
      participants: people,
      counterpart: others[0] ?? null,
      counterpartName: others.map((person) => person.name).join(", ") || row.subject || "Conversation",
    };
  });
};

export const listMessages = async (conversationId: string, userId: string, page: number, pageSize: number) => {
  const participant = await assertParticipant(conversationId, userId);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderName: users.name,
        senderRole: sql<string>`${users.role}::text`,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(messages).where(eq(messages.conversationId, conversationId)),
  ]);

  const now = new Date();
  if (!participant.lastReadAt || participant.lastReadAt < now) {
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: now })
      .where(eq(conversationParticipants.id, participant.id));
  }

  return { rows, total: Number(totals?.value ?? 0), page, pageSize };
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  body: string,
  attachments: Array<{
    fileId: string;
    fileName?: string | undefined;
    contentType?: string | undefined;
    sizeBytes?: string | undefined;
  }> = [],
) => {
  const trimmed = body.trim();
  if (!trimmed) throw badRequest("Message body is required");
  await assertParticipant(conversationId, senderId);

  return db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({ conversationId, senderId, body: trimmed })
      .returning();
    if (!message) throw new AppError("INTERNAL_ERROR", "Message insert failed");

    await tx
      .update(conversations)
      .set({ lastMessageAt: message.createdAt, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const recipients = await tx
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(and(eq(conversationParticipants.conversationId, conversationId), ne(conversationParticipants.userId, senderId)));

    if (recipients.length > 0) {
      await tx.insert(notifications).values(
        recipients.map((recipient) => ({
          userId: recipient.userId,
          title: "New message",
          body: trimmed.slice(0, 140),
          type: "MESSAGE",
          entityType: "conversation",
          entityId: conversationId,
        })),
      );
    }

    return { ...message, attachments };
  });
};

export const createConversation = async (
  actor: MessagingActor,
  input: {
    participantIds: string[];
    subject?: string | undefined;
    patientId?: string | undefined;
    body?: string | undefined;
  },
) => {
  const participantIds = [...new Set(input.participantIds.filter((id) => id !== actor.id))];
  if (participantIds.length === 0) throw badRequest("At least one other participant is required");

  const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, participantIds));
  if (found.length !== participantIds.length) throw notFound("One or more participants do not exist");

  return db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(conversations)
      .values({
        subject: input.subject ?? null,
        type: participantIds.length > 1 ? "CARE_TEAM" : "DIRECT",
        patientId: input.patientId ?? null,
        createdBy: actor.id,
      })
      .returning();
    if (!conversation) throw new AppError("INTERNAL_ERROR", "Conversation insert failed");

    await tx.insert(conversationParticipants).values(
      [actor.id, ...participantIds].map((userId) => ({ conversationId: conversation.id, userId })),
    );

    if (input.body?.trim()) {
      const [message] = await tx
        .insert(messages)
        .values({ conversationId: conversation.id, senderId: actor.id, body: input.body.trim() })
        .returning();
      await tx
        .update(conversations)
        .set({ lastMessageAt: message?.createdAt ?? new Date() })
        .where(eq(conversations.id, conversation.id));
      await tx.insert(notifications).values(
        participantIds.map((userId) => ({
          userId,
          title: "New conversation",
          body: (input.subject ?? input.body ?? "").slice(0, 140),
          type: "MESSAGE",
          entityType: "conversation",
          entityId: conversation.id,
        })),
      );
    }

    return conversation;
  });
};

export const listNotifications = async (userId: string, page: number, pageSize: number, unreadOnly = false) => {
  const where = unreadOnly
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
    : eq(notifications.userId, userId);

  const [rows, [totals], [unread]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        type: notifications.type,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(notifications).where(where),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  return { rows, total: Number(totals?.value ?? 0), page, pageSize, unreadCount: Number(unread?.value ?? 0) };
};

export const markNotificationRead = async (id: string, userId: string) => {
  const [row] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id, readAt: notifications.readAt });
  if (!row) throw notFound("Notification not found");
  return row;
};

export const markAllNotificationsRead = async (userId: string) => {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { updated: rows.length };
};

/** Directory of people the caller may start a conversation with. */
export const messagingDirectory = async (actor: MessagingActor) => {
  const staff = await db
    .select({
      id: users.id,
      name: users.name,
      role: sql<string>`${users.role}::text`,
      subtitle: sql<string | null>`coalesce(${doctors.licenseNumber}, ${users.email})`,
    })
    .from(users)
    .leftJoin(doctors, eq(doctors.userId, users.id))
    .where(and(eq(users.status, "ACTIVE"), ne(users.id, actor.id), ne(users.role, "PATIENT")))
    .orderBy(users.name)
    .limit(200);

  const patientDirectory =
    actor.role === "PATIENT"
      ? []
      : await db
          .select({
            id: patients.id,
            name: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
            mrn: patients.mrn,
            userId: patients.userId,
          })
          .from(patients)
          .where(and(eq(patients.status, "ACTIVE"), sql`${patients.userId} is not null`))
          .orderBy(patients.lastName)
          .limit(200);

  return { staff, patients: patientDirectory };
};

/** Rows waiting for a response, surfaced on the messages screen header. */
export const unreadSummary = async (userId: string) => {
  const [unreadMessages] = await db
    .select({ value: count() })
    .from(messages)
    .innerJoin(conversationParticipants, eq(messages.conversationId, conversationParticipants.conversationId))
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        ne(messages.senderId, userId),
        or(
          isNull(conversationParticipants.lastReadAt),
          gt(messages.createdAt, conversationParticipants.lastReadAt),
        ),
      ),
    );
  const [unreadNotifications] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return {
    unreadMessages: Number(unreadMessages?.value ?? 0),
    unreadNotifications: Number(unreadNotifications?.value ?? 0),
  };
};
