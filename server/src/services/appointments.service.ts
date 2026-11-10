import { and, asc, count, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { appointments, appointmentHistory, doctorAvailability, doctorTimeOff } from "../db/schema/scheduling.js";
import { patients } from "../db/schema/patients.js";
import { doctors } from "../db/schema/reference.js";
import { writeAudit } from "../lib/audit.js";
import type { Actor } from "../lib/authorize.js";
import { AppError, forbidden, notFound } from "../lib/http.js";
import { addDays, clinicDayRange, startOfClinicDay } from "../lib/time.js";

/**
 * Appointment rules: ownership scoping, slot availability (weekly windows minus
 * time off minus booked ranges), booking, and the approval/cancellation state
 * machine. Every transition writes history and an audit row.
 */

export interface AppointmentListOptions {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
  patientId?: string | undefined;
  doctorId?: string | undefined;
  status?: string | undefined;
  date?: string | undefined;
}

export const listAppointments = async (actor: Actor, options: AppointmentListOptions) => {
  const filters = [];
  if (actor.role === "PATIENT") filters.push(eq(appointments.patientId, actor.patientId ?? ""));
  if (actor.role === "DOCTOR") filters.push(eq(appointments.doctorId, actor.doctorId ?? ""));
  if (options.patientId) filters.push(eq(appointments.patientId, options.patientId));
  if (options.doctorId && actor.role !== "DOCTOR") filters.push(eq(appointments.doctorId, options.doctorId));
  if (options.status) filters.push(eq(appointments.status, options.status as "SCHEDULED"));
  if (options.date) {
    const range = clinicDayRange(new Date(`${options.date}T12:00:00Z`));
    filters.push(gte(appointments.startsAt, range.start), lt(appointments.startsAt, range.end));
  }
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        patientDob: patients.dateOfBirth,
        doctorId: appointments.doctorId,
        at: appointments.startsAt,
        endsAt: appointments.endsAt,
        mode: appointments.mode,
        type: appointments.type,
        status: appointments.status,
        priority: appointments.priority,
        reason: appointments.reason,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(where)
      .orderBy(options.order === "asc" ? asc(appointments.startsAt) : sql`${appointments.startsAt} desc`)
      .limit(options.pageSize)
      .offset(options.offset),
    db.select({ value: count() }).from(appointments).where(where),
  ]);

  return { rows, total: Number(totals?.value ?? 0) };
};

export const availableSlots = async (doctorId: string, date: string) => {
  const day = startOfClinicDay(new Date(`${date}T12:00:00Z`));
  const dayEnd = addDays(day, 1);

  const windows = await db.select().from(doctorAvailability).where(eq(doctorAvailability.doctorId, doctorId));
  const weekday = day.getUTCDay();
  const window = windows.find((w) => w.weekday === weekday);
  if (!window) return [];

  const [timeOff, booked] = await Promise.all([
    db
      .select()
      .from(doctorTimeOff)
      .where(
        and(
          eq(doctorTimeOff.doctorId, doctorId),
          lt(doctorTimeOff.startsAt, dayEnd),
          gte(doctorTimeOff.endsAt, day),
        ),
      ),
    db
      .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.startsAt, day),
          lt(appointments.startsAt, dayEnd),
          inArray(appointments.status, ["REQUESTED", "SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"]),
        ),
      ),
  ]);

  const slots: Array<{ startsAt: string; endsAt: string; available: boolean }> = [];
  for (let minute = window.startMinute; minute + window.slotMinutes <= window.endMinute; minute += window.slotMinutes) {
    const startsAt = new Date(day.getTime() + minute * 60_000);
    const endsAt = new Date(startsAt.getTime() + window.slotMinutes * 60_000);
    const inBreak =
      window.breakStartMinute !== null &&
      window.breakEndMinute !== null &&
      minute >= window.breakStartMinute &&
      minute < window.breakEndMinute;
    const blocked = timeOff.some((t) => t.startsAt < endsAt && t.endsAt > startsAt);
    const taken = booked.some((b) => b.startsAt < endsAt && b.endsAt > startsAt);
    slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), available: !inBreak && !blocked && !taken });
  }
  return slots;
};

export interface BookingInput {
  patientId: string;
  doctorId: string;
  startsAt: string;
  mode: "IN_PERSON" | "VIRTUAL";
  type: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  reason?: string | undefined;
  symptoms?: string | undefined;
  requestApproval: boolean;
}

export const bookAppointment = async (actor: Actor, input: BookingInput, ip?: string) => {
  if (actor.role === "PATIENT" && input.patientId !== actor.patientId) throw forbidden("Cannot book for another patient");

  const [doctor] = await db.select().from(doctors).where(eq(doctors.id, input.doctorId)).limit(1);
  if (!doctor) throw notFound("Doctor not found");
  if (doctor.status !== "ACTIVE") throw new AppError("PRECONDITION_FAILED", "Doctor is not accepting appointments");

  const availability = await db.select().from(doctorAvailability).where(eq(doctorAvailability.doctorId, input.doctorId));
  const startsAt = new Date(input.startsAt);
  const weekday = startsAt.getUTCDay();
  const windows = availability.filter((w) => w.weekday === weekday);
  if (windows.length === 0) throw new AppError("PRECONDITION_FAILED", "Doctor is not available on that day");
  const slotMinutes = windows[0]!.slotMinutes;
  const endsAt = new Date(startsAt.getTime() + slotMinutes * 60_000);

  const [timeOff] = await db
    .select()
    .from(doctorTimeOff)
    .where(and(eq(doctorTimeOff.doctorId, input.doctorId), lt(doctorTimeOff.startsAt, endsAt), gte(doctorTimeOff.endsAt, startsAt)))
    .limit(1);
  if (timeOff) throw new AppError("PRECONDITION_FAILED", "Doctor is on leave then");

  const status = input.requestApproval || actor.role === "PATIENT" ? "REQUESTED" : "CONFIRMED";

  return db
    .transaction(async (tx) => {
      const [row] = await tx
        .insert(appointments)
        .values({
          patientId: input.patientId,
          doctorId: input.doctorId,
          startsAt,
          endsAt,
          mode: input.mode,
          type: input.type,
          priority: input.priority,
          status,
          reason: input.reason ?? null,
          symptoms: input.symptoms ?? null,
          requestedBy: actor.id,
          approvedBy: status === "CONFIRMED" ? actor.id : null,
          approvedAt: status === "CONFIRMED" ? new Date() : null,
        })
        .returning();
      if (!row) throw new AppError("INTERNAL_ERROR", "Appointment insert failed");
      await tx.insert(appointmentHistory).values({ appointmentId: row.id, toStatus: status, changedBy: actor.id });
      await writeAudit(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "appointment.create",
          module: "appointments",
          entityType: "appointment",
          entityId: row.id,
          detail: { status },
          ip,
        },
        tx,
      );
      return row;
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "23P01") throw new AppError("SLOT_TAKEN", "That slot is already booked");
      throw error;
    });
};

export const decideAppointment = async (
  actor: Actor,
  id: string,
  to: "CONFIRMED" | "CANCELLED",
  reason: string | null,
  allowedFrom: Array<"REQUESTED" | "SCHEDULED" | "CONFIRMED" | "CHECKED_IN">,
  ip?: string,
) =>
  db.transaction(async (tx) => {
    const [existing] = await tx.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    if (!existing) throw notFound("Appointment not found");
    if (actor.role === "DOCTOR" && existing.doctorId !== actor.doctorId) throw notFound("Appointment not found");
    if (actor.role === "PATIENT" && existing.patientId !== actor.patientId) throw notFound("Appointment not found");
    if (!allowedFrom.includes(existing.status as "REQUESTED")) {
      throw new AppError("INVALID_TRANSITION", `Cannot move from ${existing.status} to ${to}`);
    }

    const [updated] = await tx
      .update(appointments)
      .set({
        status: to,
        approvedBy: to === "CONFIRMED" ? actor.id : existing.approvedBy,
        approvedAt: to === "CONFIRMED" ? new Date() : existing.approvedAt,
        cancelledAt: to === "CANCELLED" ? new Date() : null,
        cancelledReason: to === "CANCELLED" ? reason : null,
        updatedAt: new Date(),
      })
      .where(and(eq(appointments.id, id), eq(appointments.status, existing.status)))
      .returning();
    if (!updated) throw new AppError("CONFLICT", "Appointment changed concurrently; retry");

    await tx.insert(appointmentHistory).values({
      appointmentId: id,
      fromStatus: existing.status,
      toStatus: to,
      changedBy: actor.id,
      reason,
    });
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: `appointment.${to.toLowerCase()}`,
        module: "appointments",
        entityType: "appointment",
        entityId: id,
        ip,
      },
      tx,
    );
    return updated;
  });
