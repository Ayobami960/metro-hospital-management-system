import { db } from "../db/client.js";
import { auditLogs, phiAccessLogs } from "../db/schema/audit.js";
import type { AuditLevel } from "./audit-types.js";
import { logger } from "./logger.js";

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  level?: AuditLevel;
  detail?: Record<string, unknown> | null;
  ip?: string | null | undefined;
  requestId?: string | null;
}

/** Audit rows are written in the caller's transaction when one is supplied. */
export type AuditDb = Pick<typeof db, "insert">;

export const writeAudit = async (input: AuditInput, tx: AuditDb = db): Promise<void> => {
  try {
    await tx.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      module: input.module,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      level: input.level ?? "INFO",
      detail: input.detail ?? null,
      ip: input.ip ?? null,
      requestId: input.requestId ?? null,
    });
  } catch (error) {
    // Auditing must never break the request; it is alerted separately.
    logger.error({ err: error, action: input.action }, "audit write failed");
  }
};

export interface PhiAccessInput {
  actorId: string;
  actorRole?: string | null;
  patientId: string;
  resourceType: string;
  resourceId?: string | null;
  action?: string;
  ip?: string | null | undefined;
}

export const writePhiAccess = async (input: PhiAccessInput, tx: AuditDb = db): Promise<void> => {
  try {
    await tx.insert(phiAccessLogs).values({
      actorId: input.actorId,
      actorRole: input.actorRole ?? null,
      patientId: input.patientId,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      action: input.action ?? "READ",
      ip: input.ip ?? null,
    });
  } catch (error) {
    logger.error({ err: error, resourceType: input.resourceType }, "phi access write failed");
  }
};
