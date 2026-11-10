import { extname, basename } from "node:path";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { db } from "../db/client.js";
import { files } from "../db/schema/audit.js";
import { users } from "../db/schema/identity.js";
import { conversations, conversationParticipants, messages } from "../db/schema/messaging.js";
import { encounters } from "../db/schema/clinical.js";
import { invoices } from "../db/schema/billing.js";
import { radiologyOrders } from "../db/schema/laboratory.js";
import type { Actor } from "../lib/authorize.js";
import { requirePermission } from "../lib/authorize.js";
import { canReadClinicalPatient } from "../lib/patient-access.js";
import { writeAudit, writePhiAccess } from "../lib/audit.js";
import { AppError, forbidden, notFound } from "../lib/http.js";
import { storage } from "../lib/storage.js";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

interface Detected {
  contentType: string;
  extension: string;
}

const ALLOWED_TYPES = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/tiff", "tiff"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["text/plain", "txt"],
  ["application/dicom", "dcm"],
]);

export const OWNER_TYPES = ["PATIENT", "ENCOUNTER", "MESSAGE", "RADIOLOGY", "REPORT", "INVOICE", "AVATAR"] as const;

/**
 * Magic-byte allowlist. The declared multipart content type is ignored: a
 * caller cannot smuggle an executable by naming it `scan.pdf`. DOCX is a ZIP,
 * so it is only accepted when the filename extension is `.docx`.
 */
const detectContent = async (buffer: Buffer, originalName: string): Promise<Detected> => {
  if (buffer.length < 5) throw new AppError("VALIDATION_ERROR", "File is empty or truncated");

  // DICOM has a 128-byte preamble followed by the DICM magic.
  if (buffer.length > 132 && buffer.toString("ascii", 128, 132) === "DICM") {
    return { contentType: "application/dicom", extension: "dcm" };
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    const ext = extname(originalName).toLowerCase();
    if (ext === ".txt" && !buffer.includes(0)) return { contentType: "text/plain", extension: "txt" };
    throw new AppError("VALIDATION_ERROR", "Unsupported file type", { field: "file" });
  }

  if (detected.mime === "application/zip") {
    if (extname(originalName).toLowerCase() !== ".docx") {
      throw new AppError("VALIDATION_ERROR", "ZIP files are not accepted; upload a PDF or image", { field: "file" });
    }
    return { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" };
  }

  const extension = ALLOWED_TYPES.get(detected.mime);
  if (!extension) {
    throw new AppError("VALIDATION_ERROR", "Unsupported file type", { field: "file", detected: detected.mime });
  }
  return { contentType: detected.mime, extension };
};

const safeDisplayName = (value: string): string => {
  // eslint-disable-next-line no-control-regex -- strip control characters from a user-supplied filename
  const name = basename(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (name || "document").slice(0, 200);
};

export interface FileDto {
  id: string;
  ownerType: string;
  ownerId: string | null;
  patientId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  provider: string;
  uploadedBy: string | null;
  createdAt: Date;
  downloadUrl: string;
}

const serialize = (row: typeof files.$inferSelect): FileDto => ({
  id: row.id,
  ownerType: row.ownerType,
  ownerId: row.ownerId,
  patientId: row.patientId,
  fileName: row.fileName,
  contentType: row.contentType,
  sizeBytes: row.sizeBytes,
  provider: row.provider,
  uploadedBy: row.uploadedBy,
  createdAt: row.createdAt,
  downloadUrl: `/api/v1/files/${row.id}/download`,
});

const isMessageParticipant = async (userId: string, messageId: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(conversationParticipants, eq(messages.conversationId, conversationParticipants.conversationId))
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.id, messageId), eq(conversationParticipants.userId, userId)))
    .limit(1);
  return Boolean(row);
};

const resolvePatientForOwner = async (ownerType: string, ownerId: string | null): Promise<string | null> => {
  if (ownerType === "PATIENT") return ownerId;
  if (!ownerId) return null;
  if (ownerType === "ENCOUNTER") {
    const [row] = await db
      .select({ patientId: encounters.patientId })
      .from(encounters)
      .where(eq(encounters.id, ownerId))
      .limit(1);
    return row?.patientId ?? null;
  }
  if (ownerType === "RADIOLOGY") {
    const [row] = await db
      .select({ patientId: radiologyOrders.patientId })
      .from(radiologyOrders)
      .where(eq(radiologyOrders.id, ownerId))
      .limit(1);
    return row?.patientId ?? null;
  }
  if (ownerType === "INVOICE") {
    const [row] = await db.select({ patientId: invoices.patientId }).from(invoices).where(eq(invoices.id, ownerId)).limit(1);
    return row?.patientId ?? null;
  }
  return null;
};

const assertFileRead = async (actor: Actor, row: typeof files.$inferSelect): Promise<void> => {
  if (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN") return;
  if (row.uploadedBy === actor.id) return;
  if (row.ownerType === "AVATAR" && row.ownerId === actor.id) return;
  if (row.ownerType === "MESSAGE" && row.ownerId) {
    if (await isMessageParticipant(actor.id, row.ownerId)) return;
  }
  if (row.patientId) {
    if (actor.role === "PATIENT" && actor.patientId === row.patientId) return;
    if (actor.role === "DOCTOR" || actor.role === "NURSE") {
      if (await canReadClinicalPatient(actor, row.patientId)) return;
    }
  }
  throw notFound("File not found");
};

const loadFile = async (id: string): Promise<typeof files.$inferSelect> => {
  const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  if (!row || row.deletedAt) throw notFound("File not found");
  return row;
};

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  ownerType: string;
  ownerId?: string | null | undefined;
  patientId?: string | null | undefined;
}

export const uploadFile = async (actor: Actor, input: UploadFileInput, ip?: string): Promise<FileDto> => {
  requirePermission(actor, "file:write");
  const ownerType = String(input.ownerType ?? "").toUpperCase();
  if (!(OWNER_TYPES as readonly string[]).includes(ownerType) || ownerType === "AVATAR") {
    throw new AppError("VALIDATION_ERROR", "ownerType is invalid", { field: "ownerType", allowed: OWNER_TYPES });
  }

  const detected = await detectContent(input.buffer, input.originalName);
  const displayName = safeDisplayName(input.originalName || `document.${detected.extension}`);

  let ownerId = input.ownerId ? String(input.ownerId) : null;
  let patientId = input.patientId ? String(input.patientId) : null;

  if (actor.role === "PATIENT") {
    if (!actor.patientId) throw forbidden("No patient record is linked to this account");
    if (ownerType !== "PATIENT" || (patientId && patientId !== actor.patientId) || (ownerId && ownerId !== actor.patientId)) {
      throw forbidden("Patients may only upload documents to their own record");
    }
    patientId = actor.patientId;
    ownerId = actor.patientId;
  }

  if (ownerType === "MESSAGE") {
    if (!ownerId || !(await isMessageParticipant(actor.id, ownerId))) throw notFound("Conversation not found");
    patientId = null;
  } else {
    if (!ownerId && ownerType === "PATIENT") ownerId = patientId ?? actor.patientId;
    const resolved = await resolvePatientForOwner(ownerType, ownerId);
    if (ownerType === "PATIENT" && !resolved) throw notFound("Patient not found");
    if (resolved) {
      patientId = resolved;
      if (actor.role !== "PATIENT" && !(await canReadClinicalPatient(actor, resolved))) throw notFound("Patient not found");
    } else if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
      // REPORT/INVOICE without a resolvable chart are staff-only uploads.
      if (["RECEPTION", "PHARMACY", "LABORATORY", "BILLING"].includes(actor.role)) {
        throw forbidden("This role cannot attach files to that resource");
      }
    }
  }

  const stored = await storage().upload({
    buffer: input.buffer,
    contentType: detected.contentType,
    ownerType,
    extension: detected.extension,
  });

  const [row] = await db
    .insert(files)
    .values({
      ownerType: ownerType as (typeof files.$inferInsert)["ownerType"],
      ownerId,
      patientId,
      fileName: displayName,
      contentType: detected.contentType,
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      providerKey: stored.key,
      checksumSha256: stored.checksumSha256,
      url: null,
      uploadedBy: actor.id,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "File insert failed");

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "file.upload",
    module: "files",
    entityType: "file",
    entityId: row.id,
    detail: { ownerType, contentType: detected.contentType, sizeBytes: stored.sizeBytes },
    ip,
  });

  return serialize(row);
};

export const getFile = async (actor: Actor, id: string): Promise<FileDto> => {
  requirePermission(actor, "file:read");
  const row = await loadFile(id);
  await assertFileRead(actor, row);
  return serialize(row);
};

export interface FileDownload {
  url: string;
}

export const getFileDownloadUrl = async (actor: Actor, id: string, ip?: string): Promise<FileDownload> => {
  requirePermission(actor, "file:read");
  const row = await loadFile(id);
  await assertFileRead(actor, row);
  if (row.provider !== "CLOUDINARY") {
    throw new AppError("INTERNAL_ERROR", "Legacy storage provider is no longer supported");
  }
  const extension = extname(row.fileName).replace(/^\./, "") || row.contentType.split("/")[1] || "bin";
  const url = await storage().signedUrl(row.providerKey, row.contentType, extension);
  if (row.patientId) {
    await writePhiAccess({
      actorId: actor.id,
      actorRole: actor.role,
      patientId: row.patientId,
      resourceType: "file",
      resourceId: row.id,
      action: "READ",
      ip,
    });
  }
  return { url };
};

export const deleteFile = async (actor: Actor, id: string, ip?: string): Promise<{ id: string; deleted: true }> => {
  requirePermission(actor, "file:read");
  const row = await loadFile(id);
  const isOwner = row.uploadedBy === actor.id;
  if (!isOwner) requirePermission(actor, "file:delete");
  if (!isOwner && actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") {
    throw forbidden("Only the uploader or an administrator can delete this file");
  }

  await storage().destroy(row.providerKey, row.contentType);
  await db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, row.id));
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "file.delete",
    module: "files",
    entityType: "file",
    entityId: row.id,
    level: "WARNING",
    detail: { ownerType: row.ownerType },
    ip,
  });
  return { id: row.id, deleted: true };
};

/**
 * Patient documents uploaded during registration / profile completion.
 *
 * The patient row may not exist yet (an invited patient completes onboarding
 * first), so the file starts unlinked and `savePatientProfile` attaches every
 * orphaned upload to the patient record once it is created.
 */
export const uploadPatientOnboardingDocument = async (
  actor: Actor,
  buffer: Buffer,
  originalName: string,
  ip?: string,
): Promise<FileDto> => {
  if (actor.role !== "PATIENT") throw forbidden("Only patient accounts can upload medical documents here.");
  requirePermission(actor, "file:write");

  const detected = await detectContent(buffer, originalName);
  const stored = await storage().upload({
    buffer,
    contentType: detected.contentType,
    ownerType: "PATIENT",
    extension: detected.extension,
  });
  const [row] = await db
    .insert(files)
    .values({
      ownerType: "PATIENT",
      ownerId: actor.patientId,
      patientId: actor.patientId,
      fileName: safeDisplayName(originalName || `document.${detected.extension}`),
      contentType: detected.contentType,
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      providerKey: stored.key,
      checksumSha256: stored.checksumSha256,
      url: null,
      uploadedBy: actor.id,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "File insert failed");

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "file.upload",
    module: "files",
    entityType: "file",
    entityId: row.id,
    detail: { ownerType: "PATIENT", onboarding: true, contentType: detected.contentType },
    ip,
  });
  return serialize(row);
};

/** Documents visible to a patient before their patient record exists. */
export const listOwnOnboardingDocuments = async (actor: Actor): Promise<FileDto[]> => {
  const rows = await db
    .select()
    .from(files)
    .where(and(eq(files.uploadedBy, actor.id), eq(files.ownerType, "PATIENT"), isNull(files.deletedAt)))
    .orderBy(desc(files.createdAt))
    .limit(50);
  return rows.map(serialize);
};

export const uploadAvatar = async (
  actor: Actor,
  buffer: Buffer,
  originalName: string,
  ip?: string,
): Promise<FileDto & { avatarUrl: string }> => {
  requirePermission(actor, "me:write");
  const detected = await detectContent(buffer, originalName);
  if (!detected.contentType.startsWith("image/")) {
    throw new AppError("VALIDATION_ERROR", "An avatar must be an image");
  }

  const previous = await db
    .select()
    .from(files)
    .where(and(eq(files.ownerType, "AVATAR"), eq(files.ownerId, actor.id), eq(files.uploadedBy, actor.id)))
    .orderBy(desc(files.createdAt));
  for (const old of previous) {
    if (old.deletedAt) continue;
    await storage().destroy(old.providerKey, old.contentType);
    await db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, old.id));
  }

  const stored = await storage().upload({
    buffer,
    contentType: detected.contentType,
    ownerType: "AVATAR",
    extension: detected.extension,
  });
  const [row] = await db
    .insert(files)
    .values({
      ownerType: "AVATAR",
      ownerId: actor.id,
      patientId: actor.patientId,
      fileName: safeDisplayName(originalName || `avatar.${detected.extension}`),
      contentType: detected.contentType,
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      providerKey: stored.key,
      checksumSha256: stored.checksumSha256,
      uploadedBy: actor.id,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Avatar insert failed");

  const avatarUrl = `/api/v1/files/${row.id}/download`;
  await db.update(users).set({ image: avatarUrl, updatedAt: new Date() }).where(eq(users.id, actor.id));
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "file.avatar",
    module: "files",
    entityType: "file",
    entityId: row.id,
    detail: { contentType: detected.contentType },
    ip,
  });
  return { ...serialize(row), avatarUrl };
};

export const getAvatar = async (actor: Actor): Promise<FileDto> => {
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.ownerType, "AVATAR"), eq(files.ownerId, actor.id)))
    .orderBy(desc(files.createdAt))
    .limit(1);
  if (!row || row.deletedAt) throw notFound("No avatar uploaded");
  return serialize(row);
};

const documentsForPatient = async (
  patientId: string,
  page: number,
  pageSize: number,
): Promise<{ rows: (typeof files.$inferSelect)[]; total: number }> => {
  const where = and(eq(files.patientId, patientId), isNull(files.deletedAt));
  const rows = await db
    .select()
    .from(files)
    .where(where)
    .orderBy(desc(files.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [totals] = await db.select({ value: count() }).from(files).where(where);
  return { rows, total: Number(totals?.value ?? 0) };
};

export const listPatientDocuments = async (
  actor: Actor,
  patientId: string,
  page: number,
  pageSize: number,
  ip?: string,
): Promise<{ rows: FileDto[]; total: number }> => {
  requirePermission(actor, "patient:read");
  if (actor.role === "PATIENT" && actor.patientId !== patientId) throw notFound("Patient not found");
  if (actor.role !== "PATIENT" && !(await canReadClinicalPatient(actor, patientId))) {
    throw notFound("Patient not found");
  }
  const { rows, total } = await documentsForPatient(patientId, page, pageSize);
  if (actor.role !== "PATIENT") {
    await writePhiAccess({
      actorId: actor.id,
      actorRole: actor.role,
      patientId,
      resourceType: "documents",
      action: "READ",
      ip,
    });
  }
  return { rows: rows.map(serialize), total };
};

export const listMyDocuments = async (
  actor: Actor,
  page: number,
  pageSize: number,
): Promise<{ rows: FileDto[]; total: number }> => {
  requirePermission(actor, "patient:read");
  if (!actor.patientId) throw notFound("No patient record linked to this account");
  const { rows, total } = await documentsForPatient(actor.patientId, page, pageSize);
  return { rows: rows.map(serialize), total };
};
