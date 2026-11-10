import { index, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { hms, idColumn, timestamps } from "./namespace.js";
import { conversationType } from "./enums.js";
import { patients } from "./patients.js";
import { users } from "./identity.js";

export const conversations = hms.table(
  "conversation",
  {
    id: idColumn(),
    subject: text("subject"),
    type: conversationType("type").default("DIRECT").notNull(),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    createdBy: text("created_by"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [index("conversation_last_message_idx").on(t.lastMessageAt)],
);

export const conversationParticipants = hms.table(
  "conversation_participant",
  {
    id: idColumn(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("conversation_participant_uq").on(t.conversationId, t.userId)],
);

export const messages = hms.table(
  "message",
  {
    id: idColumn(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("message_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const messageAttachments = hms.table("message_attachment", {
  id: idColumn(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  fileId: text("file_id").notNull(),
  fileName: text("file_name"),
  contentType: text("content_type"),
  sizeBytes: text("size_bytes"),
});

export const notifications = hms.table(
  "notification",
  {
    id: idColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    type: text("type").default("SYSTEM").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.readAt)],
);

