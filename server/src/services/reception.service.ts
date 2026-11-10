import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { queueEntries, queueEvents } from "../db/schema/clinical.js";
import { patients } from "../db/schema/patients.js";
import { writeAudit } from "../lib/audit.js";
import { AppError } from "../lib/http.js";
import { minutesBetween } from "../lib/time.js";

/**
 * Reception queue rules: ticket allocation, atomic "call next", and the
 * append-only status transitions. Positions and wait times are derived on read,
 * never stored.
 */

const queueView = {
  id: queueEntries.id,
  ticketNumber: queueEntries.ticketNumber,
  patientId: queueEntries.patientId,
  patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
  mrn: patients.mrn,
  doctorId: queueEntries.doctorId,
  priority: queueEntries.priority,
  status: queueEntries.status,
  type: queueEntries.type,
  checkInAt: queueEntries.checkInAt,
  calledAt: queueEntries.calledAt,
  completedAt: queueEntries.completedAt,
};

export const listQueue = async (options: { page: number; pageSize: number; offset: number; status: string | null }) => {
  const where = options.status
    ? and(eq(queueEntries.status, options.status as "WAITING"), sql`true`)
    : inArray(queueEntries.status, ["WAITING", "CALLED", "IN_PROGRESS"]);

  const [rows, [totals]] = await Promise.all([
    db
      .select(queueView)
      .from(queueEntries)
      .innerJoin(patients, eq(queueEntries.patientId, patients.id))
      .where(where)
      .orderBy(asc(sql`case ${queueEntries.priority} when 'STAT' then 0 when 'URGENT' then 1 else 2 end`), asc(queueEntries.checkInAt))
      .limit(options.pageSize)
      .offset(options.offset),
    db.select({ value: count() }).from(queueEntries).where(where),
  ]);

  const data = rows.map((row, index) => ({
    ...row,
    position: options.offset + index + 1,
    waitMinutes: minutesBetween(row.checkInAt),
  }));

  return { rows: data, total: Number(totals?.value ?? 0) };
};

export interface QueueInput {
  patientId: string;
  doctorId?: string | undefined;
  departmentId?: string | undefined;
  roomId?: string | undefined;
  type: "WALK_IN" | "APPOINTMENT";
  priority: "ROUTINE" | "URGENT" | "STAT";
  notes?: string | undefined;
  appointmentId?: string | undefined;
}

export const addQueueEntry = async (actorId: string, actorRole: string, input: QueueInput, ip?: string) => {
  const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.id, input.patientId)).limit(1);
  if (!patient) throw new AppError("NOT_FOUND", "Patient not found");

  return db.transaction(async (tx) => {
    const seqResult = await tx.execute<{ n: string }>(sql`select nextval('hms.queue_ticket_seq')::text as n`);
    const seqRow = seqResult.rows[0];
    const ticket = `Q-${String(seqRow?.n ?? Date.now()).padStart(4, "0")}`;
    const [row] = await tx
      .insert(queueEntries)
      .values({
        ticketNumber: ticket,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        doctorId: input.doctorId ?? null,
        departmentId: input.departmentId ?? null,
        roomId: input.roomId ?? null,
        type: input.type,
        priority: input.priority,
        notes: input.notes ?? null,
        createdBy: actorId,
      })
      .returning();
    if (!row) throw new AppError("INTERNAL_ERROR", "Queue insert failed");
    await tx.insert(queueEvents).values({ queueEntryId: row.id, eventType: "CHECKED_IN", toStatus: "WAITING", actorId });
    await writeAudit(
      {
        actorId,
        actorRole,
        action: "queue.add",
        module: "reception",
        entityType: "queue_entry",
        entityId: row.id,
        detail: { ticket },
        ip,
      },
      tx,
    );
    return row;
  });
};

/**
 * FOR UPDATE SKIP LOCKED so two receptionists can never call the same patient.
 */
export const callNextPatient = async (actorId: string, actorRole: string, doctorId: string | null, ip?: string) => {
  const called = await db.transaction(async (tx) => {
    const locked = await tx.execute<{ id: string }>(sql`
      select id from hms.queue_entry
      where status = 'WAITING'
        ${doctorId ? sql`and doctor_id = ${doctorId}::uuid` : sql``}
      order by case priority when 'STAT' then 0 when 'URGENT' then 1 else 2 end, check_in_at asc
      for update skip locked
      limit 1
    `);
    const row = locked.rows[0];
    if (!row) return null;

    const [entry] = await tx
      .update(queueEntries)
      .set({ status: "CALLED", calledAt: new Date(), version: sql`${queueEntries.version} + 1`, updatedAt: new Date() })
      .where(and(eq(queueEntries.id, row.id), eq(queueEntries.status, "WAITING")))
      .returning();
    if (!entry) return null;
    await tx.insert(queueEvents).values({ queueEntryId: entry.id, eventType: "CALLED", fromStatus: "WAITING", toStatus: "CALLED", actorId });
    await writeAudit(
      {
        actorId,
        actorRole,
        action: "queue.call_next",
        module: "reception",
        entityType: "queue_entry",
        entityId: entry.id,
        ip,
      },
      tx,
    );
    return entry;
  });

  if (!called) throw new AppError("PRECONDITION_FAILED", "No waiting patients in the queue");
  const [joined] = await db
    .select(queueView)
    .from(queueEntries)
    .innerJoin(patients, eq(queueEntries.patientId, patients.id))
    .where(eq(queueEntries.id, called.id))
    .limit(1);
  return joined;
};

export const transitionQueueEntry = async (
  actorId: string,
  actorRole: string,
  id: string,
  to: "IN_PROGRESS" | "COMPLETED" | "REMOVED",
  from: string[],
  event: string,
  ip?: string,
) => {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(queueEntries).where(eq(queueEntries.id, id)).limit(1);
    if (!entry) throw new AppError("NOT_FOUND", "Queue entry not found");
    if (!from.includes(entry.status)) throw new AppError("INVALID_TRANSITION", `Cannot move from ${entry.status} to ${to}`);

    const [updated] = await tx
      .update(queueEntries)
      .set({
        status: to,
        startedAt: to === "IN_PROGRESS" ? new Date() : entry.startedAt,
        completedAt: to === "COMPLETED" ? new Date() : entry.completedAt,
        version: sql`${queueEntries.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(queueEntries.id, id), eq(queueEntries.status, entry.status)))
      .returning();
    if (!updated) throw new AppError("CONFLICT", "Queue entry changed concurrently; retry");

    await tx.insert(queueEvents).values({ queueEntryId: id, eventType: event, fromStatus: entry.status, toStatus: to, actorId });
    await writeAudit(
      {
        actorId,
        actorRole,
        action: `queue.${event.toLowerCase()}`,
        module: "reception",
        entityType: "queue_entry",
        entityId: id,
        ip,
      },
      tx,
    );
    return updated;
  });
};
