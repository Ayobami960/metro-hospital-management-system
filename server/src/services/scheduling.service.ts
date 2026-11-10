import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { appointments, doctorAvailability, doctorTimeOff, patients, users } from "../db/schema/index.js";
import { departments, doctors } from "../db/schema/reference.js";
import { AppError, notFound } from "../lib/http.js";
import { writeAudit } from "../lib/audit.js";
import type { Actor } from "../lib/authorize.js";
import { addDays, startOfClinicDay } from "../lib/time.js";

/**
 * Doctor availability and the weekly schedule board.
 *
 * Weekday windows are the source of truth for bookable slots; time off blocks
 * days inside a window. The schedule board reads appointments for a range so
 * the calendar and the booking engine can never disagree.
 */

export const getAvailability = async (doctorId: string) =>
  db
    .select({
      id: doctorAvailability.id,
      weekday: doctorAvailability.weekday,
      startMinute: doctorAvailability.startMinute,
      endMinute: doctorAvailability.endMinute,
      slotMinutes: doctorAvailability.slotMinutes,
      breakStartMinute: doctorAvailability.breakStartMinute,
      breakEndMinute: doctorAvailability.breakEndMinute,
      maxDailyPatients: doctorAvailability.maxDailyPatients,
    })
    .from(doctorAvailability)
    .where(eq(doctorAvailability.doctorId, doctorId))
    .orderBy(asc(doctorAvailability.weekday), asc(doctorAvailability.startMinute));

export interface AvailabilityWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes?: number | undefined;
  breakStartMinute?: number | null | undefined;
  breakEndMinute?: number | null | undefined;
  maxDailyPatients?: number | undefined;
}

export const replaceAvailability = async (actor: Actor, doctorId: string, windows: AvailabilityWindow[]) => {
  const [doctor] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, doctorId)).limit(1);
  if (!doctor) throw notFound("Doctor not found");

  for (const window of windows) {
    if (window.endMinute <= window.startMinute) {
      throw new AppError("VALIDATION_ERROR", "A window must end after it starts", { window });
    }
  }

  return db.transaction(async (tx) => {
    await tx.delete(doctorAvailability).where(eq(doctorAvailability.doctorId, doctorId));
    if (windows.length > 0) {
      await tx.insert(doctorAvailability).values(
        windows.map((window) => ({
          doctorId,
          weekday: window.weekday,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
          slotMinutes: window.slotMinutes ?? 30,
          breakStartMinute: window.breakStartMinute ?? null,
          breakEndMinute: window.breakEndMinute ?? null,
          maxDailyPatients: window.maxDailyPatients ?? 16,
        })),
      );
    }
    await writeAudit(
      {
        actorId: actor.id,
        actorRole: actor.role,
        action: "schedule.availability",
        module: "appointments",
        entityType: "doctor_availability",
        entityId: doctorId,
        detail: { windows: windows.length },
      },
      tx,
    );
    return getAvailability(doctorId);
  });
};

export const listTimeOff = async (doctorId: string) =>
  db
    .select({
      id: doctorTimeOff.id,
      startsAt: doctorTimeOff.startsAt,
      endsAt: doctorTimeOff.endsAt,
      reason: doctorTimeOff.reason,
      createdAt: doctorTimeOff.createdAt,
    })
    .from(doctorTimeOff)
    .where(eq(doctorTimeOff.doctorId, doctorId))
    .orderBy(asc(doctorTimeOff.startsAt));

export const createTimeOff = async (
  actor: Actor,
  doctorId: string,
  input: { startsAt: string; endsAt: string; reason?: string | undefined },
) => {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (endsAt <= startsAt) throw new AppError("VALIDATION_ERROR", "Time off must end after it starts");

  const [row] = await db
    .insert(doctorTimeOff)
    .values({ doctorId, startsAt, endsAt, reason: input.reason ?? null })
    .returning();

  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "schedule.time_off",
    module: "appointments",
    entityType: "doctor_time_off",
    entityId: row?.id ?? null,
    detail: { doctorId, startsAt: input.startsAt, endsAt: input.endsAt },
  });
  return row;
};

export const deleteTimeOff = async (actor: Actor, doctorId: string, id: string) => {
  const [row] = await db
    .delete(doctorTimeOff)
    .where(and(eq(doctorTimeOff.id, id), eq(doctorTimeOff.doctorId, doctorId)))
    .returning({ id: doctorTimeOff.id });
  if (!row) throw notFound("Time off not found");
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: "schedule.time_off.delete",
    module: "appointments",
    entityType: "doctor_time_off",
    entityId: id,
    level: "WARNING",
    detail: { doctorId },
  });
  return row;
};

/** Week grid: appointments for a doctor between two dates, plus booked counts. */
export const scheduleBoard = async (doctorId: string, fromDate: string) => {
  const from = startOfClinicDay(new Date(`${fromDate}T12:00:00Z`));
  const to = addDays(from, 7);

  const [rows, windows, timeOff] = await Promise.all([
    db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        mrn: patients.mrn,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        type: appointments.type,
        mode: appointments.mode,
        priority: appointments.priority,
        reason: appointments.reason,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.startsAt, from),
          lt(appointments.startsAt, to),
        ),
      )
      .orderBy(asc(appointments.startsAt)),
    getAvailability(doctorId),
    db
      .select({ id: doctorTimeOff.id, startsAt: doctorTimeOff.startsAt, endsAt: doctorTimeOff.endsAt, reason: doctorTimeOff.reason })
      .from(doctorTimeOff)
      .where(and(eq(doctorTimeOff.doctorId, doctorId), lt(doctorTimeOff.startsAt, to), gte(doctorTimeOff.endsAt, from))),
  ]);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    appointments: rows,
    availability: windows,
    timeOff,
  };
};

/** Directory row the schedule page uses for the doctor picker. */
export const schedulableDoctors = async () =>
  db
    .select({
      id: doctors.id,
      name: users.name,
      department: departments.name,
      status: doctors.status,
      consultationFeeMinor: doctors.consultationFeeMinor,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(departments, eq(doctors.departmentId, departments.id))
    .where(eq(doctors.status, "ACTIVE"))
    .orderBy(asc(users.name));
