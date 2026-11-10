import {
  bigserial,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { hms } from "./namespace.js";
import { auditLevel, emailPurpose, fileOwnerType } from "./enums.js";
import { users } from "./identity.js";

/** Append-only audit trail (decision 14). */
export const auditLogs = hms.table(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    module: text("module").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    level: auditLevel("level").default("INFO").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    ip: text("ip"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_module_idx").on(t.module, t.createdAt),
    index("audit_log_actor_idx").on(t.actorId, t.createdAt),
  ],
);

/** Append-only PHI access log: who read which patient's record and when. */
export const phiAccessLogs = hms.table(
  "phi_access_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id").notNull(),
    actorRole: text("actor_role"),
    patientId: uuid("patient_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    action: text("action").notNull(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("phi_access_patient_idx").on(t.patientId, t.createdAt)],
);

export const idempotencyKeys = hms.table(
  "idempotency_key",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    // Null while the request is in flight: the row is reserved before the
    // handler runs so concurrent retries cannot both write.
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("idempotency_key_uq").on(t.scope, t.key)],
);

/** Cloudinary metadata + ownership (decision 8, revised to Cloudinary). */
export const files = hms.table(
  "file",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerType: fileOwnerType("owner_type").notNull(),
    /** Polymorphic: patient/encounter ids are UUIDs, message ids are UUIDs, avatar owner ids are auth text ids. */
    ownerId: text("owner_id"),
    patientId: uuid("patient_id"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    provider: text("provider").default("CLOUDINARY").notNull(),
    /** Cloudinary public_id, generated from a random UUID and never from PHI. */
    providerKey: text("provider_key").notNull(),
    checksumSha256: text("checksum_sha256"),
    url: text("url"),
    uploadedBy: text("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("file_owner_idx").on(t.ownerType, t.ownerId)],
);

export const emailOutbox = hms.table(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    purpose: emailPurpose("purpose").notNull(),
    provider: text("provider").default("stub").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("email_outbox_to_idx").on(t.to)],
);
