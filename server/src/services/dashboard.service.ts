import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  admissions,
  appointmentRequests,
  appointments,
  auditLogs,
  bedAssignments,
  beds,
  clinicalNotes,
  departments,
  dispenses,
  doctors,
  emergencyContacts,
  encounters,
  insuranceClaims,
  invoices,
  labOrders,
  labResults,
  medicationAdministrations,
  nursingAssignments,
  patientAllergies,
  patientMetrics,
  patientProblems,
  patients,
  payments,
  pharmacyOrders,
  prescriptionItems,
  prescriptions,
  purchaseOrders,
  queueEntries,
  rooms,
  specialties,
  users,
  vitals,
  files,
} from "../db/schema/index.js";
import { drugs } from "../db/schema/reference.js";
import { ageFromDob, clinicDayRange, minutesBetween } from "../lib/time.js";

/**
 * Read-only aggregation for the role dashboards. Every number is derived from
 * rows written elsewhere in the system — nothing here is seeded or fabricated.
 * Dashboards are polled by the SPA, so the queries stay aggregate-only and never
 * load full record sets into memory.
 */

const monthLabel = (column: unknown) =>
  sql<string>`to_char(date_trunc('month', ${column}), 'Mon')`;
const monthKey = (column: unknown) =>
  sql<string>`to_char(date_trunc('month', ${column}), 'YYYY-MM')`;

const num = (value: unknown): number => Number(value ?? 0);

const patientName = sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`;

export const adminDashboard = async () => {
  const { start, end } = clinicDayRange();
  const monthStart = sql`date_trunc('month', now())`;
  const prevMonthStart = sql`date_trunc('month', now()) - interval '1 month'`;

  const [
    patientTotals,
    doctorTotals,
    todayAppointments,
    todayConfirmed,
    monthRevenue,
    prevMonthRevenue,
    bedTotals,
    emergencyCases,
    criticalCases,
    labToday,
    labCompletedToday,
    claims,
    revenueRows,
    expenseRows,
    appointmentRows,
    departmentRows,
    doctorRows,
    activityRows,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        newThisMonth: sql<number>`count(*) filter (where ${patients.createdAt} >= date_trunc('month', now()))::int`,
        active: sql<number>`count(*) filter (where ${patients.status} = 'ACTIVE')::int`,
      })
      .from(patients),
    db
      .select({
        total: sql<number>`count(*) filter (where ${doctors.status} = 'ACTIVE')::int`,
        onLeave: sql<number>`count(*) filter (where ${doctors.status} = 'ON_LEAVE')::int`,
      })
      .from(doctors),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(gte(appointments.startsAt, start), lt(appointments.startsAt, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end),
          inArray(appointments.status, ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"]),
        ),
      ),
    db
      .select({ value: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.status, "CLEARED"), sql`${payments.receivedAt} >= ${monthStart}`)),
    db
      .select({ value: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int` })
      .from(payments)
      .where(
        and(
          eq(payments.status, "CLEARED"),
          sql`${payments.receivedAt} >= ${prevMonthStart}`,
          sql`${payments.receivedAt} < ${monthStart}`,
        ),
      ),
    db.select({ status: beds.status, value: count() }).from(beds).groupBy(beds.status),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(admissions)
      .where(eq(admissions.status, "ACTIVE")),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(admissions)
      .where(and(eq(admissions.status, "ACTIVE"), eq(admissions.acuity, "CRITICAL"))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(labOrders)
      .where(and(gte(labOrders.orderedAt, start), lt(labOrders.orderedAt, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(labOrders)
      .where(and(eq(labOrders.status, "RELEASED"), gte(labOrders.orderedAt, start), lt(labOrders.orderedAt, end))),
    db
      .select({ status: insuranceClaims.status, value: count() })
      .from(insuranceClaims)
      .groupBy(insuranceClaims.status),
    db
      .select({
        key: monthKey(payments.receivedAt).as("key"),
        month: monthLabel(payments.receivedAt).as("month"),
        value: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "CLEARED"),
          sql`${payments.receivedAt} >= date_trunc('month', now()) - interval '11 months'`,
        ),
      )
      .groupBy(sql`1, 2`)
      .orderBy(sql`1`),
    db
      .select({
        key: monthKey(purchaseOrders.orderedAt).as("key"),
        value: sql<number>`coalesce(sum(${purchaseOrders.totalMinor}), 0)::int`,
      })
      .from(purchaseOrders)
      .where(sql`${purchaseOrders.orderedAt} >= date_trunc('month', now()) - interval '11 months'`)
      .groupBy(sql`1`),
    db
      .select({
        key: monthKey(appointments.startsAt).as("key"),
        month: monthLabel(appointments.startsAt).as("month"),
        value: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(sql`${appointments.startsAt} >= date_trunc('month', now()) - interval '11 months'`)
      .groupBy(sql`1, 2`)
      .orderBy(sql`1`),
    db
      .select({
        id: departments.id,
        name: departments.name,
        head: sql<string | null>`(
          select u.name from hms.doctor d join hms."user" u on u.id = d.user_id
          where d.id = hms.department.head_doctor_id
        )`,
        doctorCount: sql<number>`(
          select count(*)::int from hms.doctor d where d.department_id = hms.department.id
        )`,
        bedCount: sql<number>`(
          select count(*)::int from hms.bed b join hms.room r on r.id = b.room_id
          where r.department_id = hms.department.id
        )`,
        occupied: sql<number>`(
          select count(*)::int from hms.bed b join hms.room r on r.id = b.room_id
          where r.department_id = hms.department.id and b.status = 'OCCUPIED'
        )`,
        patientCount: sql<number>`(
          select count(distinct p.id)::int from hms.patient p
          join hms.doctor d on d.id = p.primary_doctor_id
          where d.department_id = hms.department.id
        )`,
      })
      .from(departments)
      .orderBy(departments.name),
    db
      .select({
        id: doctors.id,
        name: users.name,
        department: departments.name,
        specialty: specialties.name,
        status: doctors.status,
        rating: doctors.ratingAvg,
        patientCount: sql<number>`(
          select count(distinct p.id)::int from hms.patient p
          where p.primary_doctor_id = hms.doctor.id
             or exists (select 1 from hms.doctor_panel dp where dp.patient_id = p.id and dp.doctor_id = hms.doctor.id and dp.active)
        )`,
        revenueMinor: sql<number>`(
          select coalesce(sum(i.total_minor), 0)::int from hms.invoice i
          join hms.encounter e on e.id = i.encounter_id
          where e.doctor_id = hms.doctor.id and i.status <> 'VOID'
        )`,
      })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .leftJoin(departments, eq(doctors.departmentId, departments.id))
      .leftJoin(specialties, eq(doctors.specialtyId, specialties.id))
      .orderBy(desc(sql`8`))
      .limit(8),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        module: auditLogs.module,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        level: auditLogs.level,
        detail: auditLogs.detail,
        actorRole: auditLogs.actorRole,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);

  const bedByStatus = (status: string) => num(bedTotals.find((b) => b.status === status)?.value);
  const totalBeds = bedTotals.reduce((sum, row) => sum + num(row.value), 0);
  const occupiedBeds = bedByStatus("OCCUPIED");
  const availableBeds = bedByStatus("AVAILABLE");
  const currentRevenue = num(monthRevenue[0]?.value);
  const previousRevenue = num(prevMonthRevenue[0]?.value);
  const revenueChangePercent =
    previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10 : null;
  const expenseByKey = new Map(expenseRows.map((row) => [row.key, num(row.value)]));

  const claimPending = claims
    .filter((row) => ["SUBMITTED", "UNDER_REVIEW", "APPEALED"].includes(row.status))
    .reduce((sum, row) => sum + num(row.value), 0);
  const claimDenied = claims
    .filter((row) => row.status === "DENIED")
    .reduce((sum, row) => sum + num(row.value), 0);

  return {
    stats: {
      totalPatients: num(patientTotals[0]?.total),
      activePatients: num(patientTotals[0]?.active),
      newPatientsThisMonth: num(patientTotals[0]?.newThisMonth),
      activeDoctors: num(doctorTotals[0]?.total),
      doctorsOnLeave: num(doctorTotals[0]?.onLeave),
      todayAppointments: num(todayAppointments[0]?.value),
      todayConfirmed: num(todayConfirmed[0]?.value),
      monthRevenueMinor: currentRevenue,
      revenueChangePercent,
      bedsAvailable: availableBeds,
      bedsTotal: totalBeds,
      occupancyPercent: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      emergencyCases: num(emergencyCases[0]?.value),
      criticalCases: num(criticalCases[0]?.value),
      labTestsToday: num(labToday[0]?.value),
      labCompletedToday: num(labCompletedToday[0]?.value),
      claimsPending: claimPending,
      claimsDenied: claimDenied,
    },
    revenueSeries: revenueRows.map((row) => ({
      month: row.month,
      key: row.key,
      revenue: num(row.value),
      expenses: expenseByKey.get(row.key) ?? 0,
    })),
    appointmentTrend: appointmentRows.map((row) => ({ month: row.month, key: row.key, appointments: num(row.value) })),
    departmentDistribution: departmentRows.map((row) => ({
      dept: row.name,
      patients: num(row.patientCount),
    })),
    doctorPerformance: doctorRows.map((row) => ({
      id: row.id,
      name: row.name,
      dept: row.department ?? row.specialty ?? "Unassigned",
      patients: num(row.patientCount),
      rating: row.rating !== null ? Number(row.rating) : null,
      revenueMinor: num(row.revenueMinor),
      status: row.status === "ON_LEAVE" ? "Leave" : row.status === "ACTIVE" ? "Active" : "Inactive",
    })),
    departments: departmentRows.map((row) => ({
      id: row.id,
      name: row.name,
      head: row.head ?? "Unassigned",
      doctors: num(row.doctorCount),
      beds: num(row.bedCount),
      occupied: num(row.occupied),
      status:
        num(row.bedCount) > 0 && num(row.occupied) === num(row.bedCount)
          ? "High Volume"
          : num(row.bedCount) === 0
            ? "Under Maintenance"
            : "Operational",
    })),
    recentActivities: activityRows.map((row) => ({
      id: String(row.id),
      action: row.action,
      module: row.module,
      entityType: row.entityType,
      entityId: row.entityId,
      level: row.level,
      detail: row.detail,
      createdAt: row.createdAt,
    })),
    generatedAt: new Date().toISOString(),
  };
};

export const doctorDashboard = async (doctorId: string) => {
  const { start, end } = clinicDayRange();

  const [
    todayAppointments,
    completedToday,
    uniquePatients,
    pendingLab,
    activeRx,
    ratingRow,
    monthRevenue,
    appointmentSeries,
    diagnosisRows,
    todayRows,
    requestRows,
    prescriptionRows,
    labPendingRows,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), gte(appointments.startsAt, start), lt(appointments.startsAt, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.status, "COMPLETED"),
          gte(appointments.startsAt, start),
          lt(appointments.startsAt, end),
        ),
      ),
    db
      .select({ value: sql<number>`count(distinct ${appointments.patientId})::int` })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), gte(appointments.startsAt, start), lt(appointments.startsAt, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(labOrders)
      .where(and(eq(labOrders.orderingDoctorId, doctorId), inArray(labOrders.status, ["PENDING", "COLLECTED", "IN_PROGRESS"]))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(prescriptions)
      .where(and(eq(prescriptions.doctorId, doctorId), inArray(prescriptions.status, ["DRAFT", "SIGNED", "SENT", "PARTIALLY_DISPENSED"]))),
    db.select({ rating: doctors.ratingAvg, ratings: doctors.ratingCount }).from(doctors).where(eq(doctors.id, doctorId)).limit(1),
    db
      .select({ value: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int` })
      .from(payments)
      .innerJoin(invoices, eq(payments.patientId, invoices.patientId))
      .innerJoin(encounters, eq(invoices.encounterId, encounters.id))
      .where(
        and(
          eq(encounters.doctorId, doctorId),
          eq(payments.status, "CLEARED"),
          sql`${payments.receivedAt} >= date_trunc('month', now())`,
        ),
      ),
    db
      .select({
        day: sql<string>`to_char(${appointments.startsAt} at time zone 'UTC', 'Dy')`,
        date: sql<string>`to_char(${appointments.startsAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        value: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), sql`${appointments.startsAt} >= now() - interval '6 days'`))
      .groupBy(sql`1, 2`)
      .orderBy(sql`2`),
    db
      .select({ name: sql<string>`coalesce(${encounters.chiefComplaint}, 'Unspecified')`, value: sql<number>`count(*)::int` })
      .from(encounters)
      .where(eq(encounters.doctorId, doctorId))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(5),
    db
      .select({
        appointmentId: appointments.id,
        patientId: patients.id,
        name: patientName,
        mrn: patients.mrn,
        dateOfBirth: patients.dateOfBirth,
        at: appointments.startsAt,
        status: appointments.status,
        reason: appointments.reason,
        mode: appointments.mode,
        priority: appointments.priority,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(and(eq(appointments.doctorId, doctorId), gte(appointments.startsAt, start), lt(appointments.startsAt, end)))
      .orderBy(appointments.startsAt),
    db
      .select({
        id: appointmentRequests.id,
        patientId: appointmentRequests.patientId,
        patientName: patientName,
        requestedFor: appointmentRequests.requestedFor,
        status: appointmentRequests.status,
        reason: appointmentRequests.reason,
        mode: appointmentRequests.mode,
      })
      .from(appointmentRequests)
      .innerJoin(patients, eq(appointmentRequests.patientId, patients.id))
      .where(and(eq(appointmentRequests.doctorId, doctorId), eq(appointmentRequests.status, "REQUESTED")))
      .orderBy(desc(appointmentRequests.requestedFor))
      .limit(10),
    db
      .select({
        id: prescriptions.id,
        patientName: patientName,
        status: prescriptions.status,
        createdAt: prescriptions.createdAt,
        drugNames: sql<string[]>`coalesce((
          select array_agg(d.name order by d.name)
          from hms.prescription_item pi join hms.drug d on d.id = pi.drug_id
          where pi.prescription_id = ${prescriptions.id}
        ), '{}')`,
      })
      .from(prescriptions)
      .innerJoin(patients, eq(prescriptions.patientId, patients.id))
      .where(eq(prescriptions.doctorId, doctorId))
      .orderBy(desc(prescriptions.createdAt))
      .limit(6),
    db
      .select({
        id: labOrders.id,
        patientName: patientName,
        status: labOrders.status,
        priority: labOrders.priority,
        orderedAt: labOrders.orderedAt,
        testNames: sql<string[]>`coalesce((
          select array_agg(t.name order by t.name)
          from hms.lab_order_item i join hms.lab_test t on t.id = i.test_id
          where i.lab_order_id = ${labOrders.id}
        ), '{}')`,
      })
      .from(labOrders)
      .innerJoin(patients, eq(labOrders.patientId, patients.id))
      .where(eq(labOrders.orderingDoctorId, doctorId))
      .orderBy(desc(labOrders.orderedAt))
      .limit(8),
  ]);

  const rating = ratingRow[0]?.rating;

  return {
    stats: {
      todayAppointments: num(todayAppointments[0]?.value),
      completedToday: num(completedToday[0]?.value),
      uniquePatientsToday: num(uniquePatients[0]?.value),
      pendingLabOrders: num(pendingLab[0]?.value),
      activePrescriptions: num(activeRx[0]?.value),
      rating: rating !== null && rating !== undefined ? Number(rating) : null,
      ratingCount: num(ratingRow[0]?.ratings),
      monthRevenueMinor: num(monthRevenue[0]?.value),
    },
    appointmentSeries: appointmentSeries.map((row) => ({ day: row.day, date: row.date, appointments: num(row.value) })),
    diagnosisDistribution: diagnosisRows.map((row) => ({ name: row.name, value: num(row.value) })),
    todayPatients: todayRows.map((row) => ({
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      name: row.name,
      mrn: row.mrn,
      age: ageFromDob(row.dateOfBirth),
      at: row.at,
      status: row.status,
      reason: row.reason,
      mode: row.mode,
      priority: row.priority,
    })),
    pendingRequests: requestRows,
    recentPrescriptions: prescriptionRows,
    labOrders: labPendingRows,
    generatedAt: new Date().toISOString(),
  };
};

export const nurseDashboard = async (nurseId: string) => {
  const { start, end } = clinicDayRange();

  const [assigned, medsToday, medsGiven, vitalsToday, criticalPatients, schedule, patientRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(nursingAssignments)
      .where(and(eq(nursingAssignments.nurseId, nurseId), eq(nursingAssignments.active, true))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(medicationAdministrations)
      .where(and(gte(medicationAdministrations.scheduledFor, start), lt(medicationAdministrations.scheduledFor, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(medicationAdministrations)
      .where(
        and(
          eq(medicationAdministrations.status, "GIVEN"),
          gte(medicationAdministrations.scheduledFor, start),
          lt(medicationAdministrations.scheduledFor, end),
        ),
      ),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(vitals)
      .where(and(gte(vitals.recordedAt, start), lt(vitals.recordedAt, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(nursingAssignments)
      .innerJoin(patients, eq(nursingAssignments.patientId, patients.id))
      .innerJoin(admissions, eq(admissions.patientId, patients.id))
      .where(and(eq(nursingAssignments.nurseId, nurseId), eq(admissions.acuity, "CRITICAL"), eq(admissions.status, "ACTIVE"))),
    db
      .select({
        id: medicationAdministrations.id,
        patientId: medicationAdministrations.patientId,
        patientName: patientName,
        drug: drugs.name,
        dose: prescriptionItems.dose,
        route: prescriptionItems.route,
        scheduledFor: medicationAdministrations.scheduledFor,
        status: medicationAdministrations.status,
        holdReason: medicationAdministrations.holdReason,
      })
      .from(medicationAdministrations)
      .innerJoin(patients, eq(medicationAdministrations.patientId, patients.id))
      .innerJoin(prescriptionItems, eq(medicationAdministrations.prescriptionItemId, prescriptionItems.id))
      .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
      .innerJoin(nursingAssignments, eq(nursingAssignments.patientId, medicationAdministrations.patientId))
      .where(
        and(
          eq(nursingAssignments.nurseId, nurseId),
          eq(nursingAssignments.active, true),
          gte(medicationAdministrations.scheduledFor, start),
          lt(medicationAdministrations.scheduledFor, end),
        ),
      )
      .orderBy(medicationAdministrations.scheduledFor),
    db
      .select({
        id: patients.id,
        name: patientName,
        mrn: patients.mrn,
        dateOfBirth: patients.dateOfBirth,
        bedLabel: beds.label,
        roomNumber: rooms.number,
        acuity: admissions.acuity,
        admittedAt: admissions.admittedAt,
        allergies: sql<string[]>`coalesce((
          select array_agg(a.allergen order by a.allergen)
          from hms.patient_allergy a
          where a.patient_id = ${patients.id} and a.status = 'ACTIVE'
        ), '{}')`,
      })
      .from(nursingAssignments)
      .innerJoin(patients, eq(nursingAssignments.patientId, patients.id))
      .leftJoin(admissions, and(eq(admissions.patientId, patients.id), eq(admissions.status, "ACTIVE")))
      .leftJoin(bedAssignments, and(eq(bedAssignments.patientId, patients.id), sql`${bedAssignments.releasedAt} is null`))
      .leftJoin(beds, eq(bedAssignments.bedId, beds.id))
      .leftJoin(rooms, eq(beds.roomId, rooms.id))
      .where(and(eq(nursingAssignments.nurseId, nurseId), eq(nursingAssignments.active, true)))
      .orderBy(beds.label),
  ]);

  return {
    stats: {
      assignedPatients: num(assigned[0]?.value),
      medicationsDueToday: num(medsToday[0]?.value),
      medicationsGivenToday: num(medsGiven[0]?.value),
      vitalsRecordedToday: num(vitalsToday[0]?.value),
      criticalPatients: num(criticalPatients[0]?.value),
      medicationsOverdue: schedule.filter((row) => row.status === "DUE" && row.scheduledFor < start).length,
    },
    medicationSchedule: schedule.map((row) => ({
      id: row.id,
      patientId: row.patientId,
      patientName: row.patientName,
      drug: row.drug,
      dose: row.dose,
      route: row.route,
      scheduledFor: row.scheduledFor,
      time: row.scheduledFor.toISOString(),
      status: row.status,
      holdReason: row.holdReason,
    })),
    patients: patientRows.map((row) => ({
      id: row.id,
      name: row.name,
      mrn: row.mrn,
      age: ageFromDob(row.dateOfBirth),
      bed: row.bedLabel ? `${row.roomNumber ?? ""}-${row.bedLabel}` : null,
      acuity: row.acuity ?? "STABLE",
      admittedAt: row.admittedAt,
      allergies: row.allergies ?? [],
    })),
    generatedAt: new Date().toISOString(),
  };
};

export const patientDashboard = async (patientId: string) => {
  const { start } = clinicDayRange();

  const [upcoming, recentRx, labRows, balance, vitalsRows, metricRows, lastVisit, records, careTeam] = await Promise.all([
    db
      .select({
        id: appointments.id,
        at: appointments.startsAt,
        status: appointments.status,
        mode: appointments.mode,
        type: appointments.type,
        doctorName: users.name,
        department: departments.name,
        reason: appointments.reason,
      })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .innerJoin(users, eq(doctors.userId, users.id))
      .leftJoin(departments, eq(doctors.departmentId, departments.id))
      .where(and(eq(appointments.patientId, patientId), gte(appointments.startsAt, start)))
      .orderBy(appointments.startsAt)
      .limit(5),
    db
      .select({
        id: prescriptions.id,
        status: prescriptions.status,
        createdAt: prescriptions.createdAt,
        doctorName: users.name,
        drugNames: sql<string[]>`coalesce((
          select array_agg(d.name order by d.name)
          from hms.prescription_item pi join hms.drug d on d.id = pi.drug_id
          where pi.prescription_id = ${prescriptions.id}
        ), '{}')`,
      })
      .from(prescriptions)
      .innerJoin(doctors, eq(prescriptions.doctorId, doctors.id))
      .innerJoin(users, eq(doctors.userId, users.id))
      .where(and(eq(prescriptions.patientId, patientId), inArray(prescriptions.status, ["SIGNED", "SENT", "PARTIALLY_DISPENSED", "DISPENSED"])))
      .orderBy(desc(prescriptions.createdAt))
      .limit(5),
    db
      .select({
        id: labOrders.id,
        status: labOrders.status,
        orderedAt: labOrders.orderedAt,
        releasedAt: labOrders.releasedAt,
        critical: sql<boolean>`exists (select 1 from hms.lab_result lr where lr.patient_id = ${labOrders.patientId} and lr.critical and lr.released_at is not null)`,
        testNames: sql<string[]>`coalesce((
          select array_agg(t.name order by t.name)
          from hms.lab_order_item i join hms.lab_test t on t.id = i.test_id
          where i.lab_order_id = ${labOrders.id}
        ), '{}')`,
      })
      .from(labOrders)
      .where(eq(labOrders.patientId, patientId))
      .orderBy(desc(labOrders.orderedAt))
      .limit(6),
    db
      .select({
        billed: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::int`,
        paid: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)::int`,
      })
      .from(invoices)
      .where(and(eq(invoices.patientId, patientId), inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"]))),
    db
      .select({
        recordedAt: vitals.recordedAt,
        systolic: vitals.systolic,
        diastolic: vitals.diastolic,
        heartRate: vitals.heartRate,
        weightKg: vitals.weightKg,
        spo2: vitals.spo2,
      })
      .from(vitals)
      .where(eq(vitals.patientId, patientId))
      .orderBy(desc(vitals.recordedAt))
      .limit(12),
    db
      .select({
        type: sql<string>`${patientMetrics.type}::text`,
        recordedAt: patientMetrics.recordedAt,
        value: patientMetrics.value,
        secondaryValue: patientMetrics.secondaryValue,
        unit: patientMetrics.unit,
      })
      .from(patientMetrics)
      .where(eq(patientMetrics.patientId, patientId))
      .orderBy(desc(patientMetrics.recordedAt))
      .limit(40),
    db
      .select({ at: encounters.startedAt, doctorName: users.name, type: encounters.type, complaint: encounters.chiefComplaint })
      .from(encounters)
      .leftJoin(doctors, eq(encounters.doctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(encounters.patientId, patientId))
      .orderBy(desc(encounters.startedAt))
      .limit(1),
    db
      .select({
        allergies: sql<string[]>`coalesce((select array_agg(a.allergen order by a.allergen) from hms.patient_allergy a where a.patient_id = ${patients.id} and a.status = 'ACTIVE'), '{}')`,
        problems: sql<string[]>`coalesce((select array_agg(p.diagnosis order by p.diagnosis) from hms.patient_problem p where p.patient_id = ${patients.id} and p.status = 'ACTIVE'), '{}')`,
      })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1),
    db
      .select({ doctorName: users.name, specialty: specialties.name, department: departments.name })
      .from(patients)
      .leftJoin(doctors, eq(patients.primaryDoctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .leftJoin(specialties, eq(doctors.specialtyId, specialties.id))
      .leftJoin(departments, eq(doctors.departmentId, departments.id))
      .where(eq(patients.id, patientId))
      .limit(1),
  ]);

  const bpSeries = [...vitalsRows]
    .reverse()
    .filter((row) => row.systolic !== null && row.diastolic !== null)
    .map((row) => ({
      date: row.recordedAt.toISOString().slice(0, 10),
      systolic: row.systolic,
      diastolic: row.diastolic,
    }));
  const weightSeries = [...vitalsRows]
    .reverse()
    .filter((row) => row.weightKg !== null)
    .map((row) => ({ date: row.recordedAt.toISOString().slice(0, 10), weight: Number(row.weightKg) }));

  return {
    stats: {
      upcomingAppointments: upcoming.length,
      activePrescriptions: recentRx.filter((rx) => rx.status !== "DISPENSED").length,
      releasedLabResults: labRows.filter((row) => row.releasedAt !== null).length,
      outstandingBalanceMinor: Math.max(0, num(balance[0]?.billed) - num(balance[0]?.paid)),
      lastVisitAt: lastVisit[0]?.at ?? null,
    },
    upcomingAppointments: upcoming,
    prescriptions: recentRx,
    labResults: labRows,
    bpSeries,
    weightSeries,
    metrics: metricRows.map((row) => ({
      type: row.type,
      recordedAt: row.recordedAt,
      value: Number(row.value),
      secondaryValue: row.secondaryValue !== null ? Number(row.secondaryValue) : null,
      unit: row.unit,
    })),
    allergies: records[0]?.allergies ?? [],
    problems: records[0]?.problems ?? [],
    careTeam: careTeam[0] ?? null,
    generatedAt: new Date().toISOString(),
  };
};

export const receptionDashboard = async () => {
  const { start, end } = clinicDayRange();

  const [queueRows, todayRows, registeredToday, completedToday, noShowToday, upcomingRequests] = await Promise.all([
    db
      .select({
        id: queueEntries.id,
        ticketNumber: queueEntries.ticketNumber,
        patientId: queueEntries.patientId,
        patientName: patientName,
        mrn: patients.mrn,
        doctorId: queueEntries.doctorId,
        priority: queueEntries.priority,
        status: queueEntries.status,
        type: queueEntries.type,
        checkInAt: queueEntries.checkInAt,
        calledAt: queueEntries.calledAt,
      })
      .from(queueEntries)
      .innerJoin(patients, eq(queueEntries.patientId, patients.id))
      .where(inArray(queueEntries.status, ["WAITING", "CALLED", "IN_PROGRESS"]))
      .orderBy(queueEntries.checkInAt),
    db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientName: patientName,
        mrn: patients.mrn,
        doctorName: users.name,
        at: appointments.startsAt,
        status: appointments.status,
        mode: appointments.mode,
        type: appointments.type,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .innerJoin(users, eq(doctors.userId, users.id))
      .where(and(gte(appointments.startsAt, start), lt(appointments.startsAt, end)))
      .orderBy(appointments.startsAt),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(patients)
      .where(and(gte(patients.createdAt, start), lt(patients.createdAt, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(queueEntries)
      .where(and(eq(queueEntries.status, "COMPLETED"), gte(queueEntries.completedAt, start), lt(queueEntries.completedAt, end))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.status, "NO_SHOW"), gte(appointments.startsAt, start), lt(appointments.startsAt, end))),
    db
      .select({
        id: appointmentRequests.id,
        patientName: patientName,
        requestedFor: appointmentRequests.requestedFor,
        doctorName: users.name,
        mode: appointmentRequests.mode,
        reason: appointmentRequests.reason,
      })
      .from(appointmentRequests)
      .innerJoin(patients, eq(appointmentRequests.patientId, patients.id))
      .innerJoin(doctors, eq(appointmentRequests.doctorId, doctors.id))
      .innerJoin(users, eq(doctors.userId, users.id))
      .where(eq(appointmentRequests.status, "REQUESTED"))
      .orderBy(appointmentRequests.requestedFor)
      .limit(10),
  ]);

  const waiting = queueRows.filter((row) => row.status === "WAITING");
  const avgWait =
    waiting.length > 0
      ? Math.round(waiting.reduce((sum, row) => sum + minutesBetween(row.checkInAt), 0) / waiting.length)
      : 0;

  return {
    stats: {
      inQueue: queueRows.length,
      waiting: waiting.length,
      called: queueRows.filter((row) => row.status === "CALLED").length,
      inProgress: queueRows.filter((row) => row.status === "IN_PROGRESS").length,
      avgWaitMinutes: avgWait,
      todayAppointments: todayRows.length,
      checkedIn: todayRows.filter((row) => ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(row.status)).length,
      completedToday: num(completedToday[0]?.value),
      noShowsToday: num(noShowToday[0]?.value),
      registeredToday: num(registeredToday[0]?.value),
    },
    queue: queueRows.map((row, index) => ({ ...row, position: index + 1, waitMinutes: minutesBetween(row.checkInAt) })),
    todayAppointments: todayRows,
    pendingRequests: upcomingRequests,
    generatedAt: new Date().toISOString(),
  };
};

/** Ward board for the nurse dashboard and the ward overview screen. */
export const wardOverview = async (departmentId?: string) => {
  const [roomRows, bedsByStatus, wardPatients] = await Promise.all([
    db
      .select({
        roomId: rooms.id,
        number: rooms.number,
        floor: rooms.floor,
        type: rooms.type,
        department: departments.name,
        bedCount: sql<number>`count(${beds.id})::int`,
        occupied: sql<number>`count(*) filter (where ${beds.status} = 'OCCUPIED')::int`,
        available: sql<number>`count(*) filter (where ${beds.status} = 'AVAILABLE')::int`,
        maintenance: sql<number>`count(*) filter (where ${beds.status} = 'MAINTENANCE')::int`,
      })
      .from(rooms)
      .leftJoin(beds, eq(beds.roomId, rooms.id))
      .leftJoin(departments, eq(rooms.departmentId, departments.id))
      .where(departmentId ? eq(rooms.departmentId, departmentId) : undefined)
      .groupBy(rooms.id, rooms.number, rooms.floor, rooms.type, departments.name)
      .orderBy(rooms.number),
    db.select({ status: beds.status, value: count() }).from(beds).groupBy(beds.status),
    db
      .select({
        id: patients.id,
        name: patientName,
        mrn: patients.mrn,
        dateOfBirth: patients.dateOfBirth,
        roomNumber: rooms.number,
        bedLabel: beds.label,
        acuity: admissions.acuity,
        admittedAt: admissions.admittedAt,
        doctorName: users.name,
      })
      .from(bedAssignments)
      .innerJoin(patients, eq(bedAssignments.patientId, patients.id))
      .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
      .innerJoin(rooms, eq(beds.roomId, rooms.id))
      .leftJoin(admissions, and(eq(admissions.patientId, patients.id), eq(admissions.status, "ACTIVE")))
      .leftJoin(doctors, eq(admissions.attendingDoctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(and(sql`${bedAssignments.releasedAt} is null`, departmentId ? eq(rooms.departmentId, departmentId) : undefined))
      .orderBy(rooms.number, beds.label),
  ]);

  const byStatus = (status: string) => num(bedsByStatus.find((row) => row.status === status)?.value);

  return {
    beds: {
      total: bedsByStatus.reduce((sum, row) => sum + num(row.value), 0),
      occupied: byStatus("OCCUPIED"),
      available: byStatus("AVAILABLE"),
      maintenance: byStatus("MAINTENANCE"),
      reserved: byStatus("RESERVED"),
      cleaning: byStatus("CLEANING"),
    },
    rooms: roomRows.map((row) => ({
      ...row,
      bedCount: num(row.bedCount),
      occupied: num(row.occupied),
      available: num(row.available),
      maintenance: num(row.maintenance),
      status:
        num(row.bedCount) > 0 && num(row.maintenance) === num(row.bedCount)
          ? "Maintenance"
          : num(row.occupied) > 0
            ? "Occupied"
            : "Available",
    })),
    patients: wardPatients.map((row) => ({
      id: row.id,
      name: row.name,
      mrn: row.mrn,
      age: ageFromDob(row.dateOfBirth),
      bed: row.bedLabel ? `${row.roomNumber}-${row.bedLabel}` : null,
      acuity: row.acuity ?? "STABLE",
      admittedAt: row.admittedAt,
      doctorName: row.doctorName,
    })),
    generatedAt: new Date().toISOString(),
  };
};

/** Activity feed reused by the profile/notification screens. */
export const patientTimeline = async (patientId: string) => {
  const [visits, notes, labRows, rxRows, allergies, problems, contacts, documents] = await Promise.all([
    db
      .select({
        id: encounters.id,
        at: encounters.startedAt,
        type: encounters.type,
        status: encounters.status,
        complaint: encounters.chiefComplaint,
        disposition: encounters.disposition,
        doctorName: users.name,
      })
      .from(encounters)
      .leftJoin(doctors, eq(encounters.doctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(encounters.patientId, patientId))
      .orderBy(desc(encounters.startedAt))
      .limit(20),
    db
      .select({ id: clinicalNotes.id, at: clinicalNotes.createdAt, type: clinicalNotes.type, title: clinicalNotes.title, status: clinicalNotes.status, content: clinicalNotes.content })
      .from(clinicalNotes)
      .where(eq(clinicalNotes.patientId, patientId))
      .orderBy(desc(clinicalNotes.createdAt))
      .limit(20),
    db
      .select({
        id: labOrders.id,
        at: labOrders.orderedAt,
        status: labOrders.status,
        releasedAt: labOrders.releasedAt,
        testNames: sql<string[]>`coalesce((
          select array_agg(t.name order by t.name) from hms.lab_order_item i
          join hms.lab_test t on t.id = i.test_id where i.lab_order_id = ${labOrders.id}
        ), '{}')`,
      })
      .from(labOrders)
      .where(eq(labOrders.patientId, patientId))
      .orderBy(desc(labOrders.orderedAt))
      .limit(20),
    db
      .select({
        id: prescriptions.id,
        at: prescriptions.createdAt,
        status: prescriptions.status,
        doctorName: users.name,
        drugNames: sql<string[]>`coalesce((
          select array_agg(d.name order by d.name) from hms.prescription_item pi
          join hms.drug d on d.id = pi.drug_id where pi.prescription_id = ${prescriptions.id}
        ), '{}')`,
      })
      .from(prescriptions)
      .leftJoin(doctors, eq(prescriptions.doctorId, doctors.id))
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(prescriptions.patientId, patientId))
      .orderBy(desc(prescriptions.createdAt))
      .limit(20),
    db
      .select({ id: patientAllergies.id, allergen: patientAllergies.allergen, reaction: patientAllergies.reaction, severity: patientAllergies.severity, status: patientAllergies.status, verifiedAt: patientAllergies.verifiedAt })
      .from(patientAllergies)
      .where(eq(patientAllergies.patientId, patientId)),
    db
      .select({ id: patientProblems.id, diagnosis: patientProblems.diagnosis, status: patientProblems.status, onsetDate: patientProblems.onsetDate, resolvedAt: patientProblems.resolvedAt })
      .from(patientProblems)
      .where(eq(patientProblems.patientId, patientId)),
    db
      .select({ id: emergencyContacts.id, name: emergencyContacts.name, relationship: emergencyContacts.relationship, phone: emergencyContacts.phone, isPrimary: emergencyContacts.isPrimary })
      .from(emergencyContacts)
      .where(eq(emergencyContacts.patientId, patientId)),
    db
      .select({ id: sql<string>`${files.id}::text`, fileName: files.fileName, contentType: files.contentType, createdAt: files.createdAt })
      .from(files)
      .where(and(eq(files.patientId, patientId), sql`${files.deletedAt} is null`))
      .orderBy(desc(files.createdAt))
      .limit(50),
  ]);

  return { visits, notes, labOrders: labRows, prescriptions: rxRows, allergies, problems, emergencyContacts: contacts, documents };
};

/** Queue entry count for nav badges / notification summaries. */
export const operationCounts = async () => {
  const [pendingLab, pendingRx, pendingClaims, queued] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(labOrders).where(inArray(labOrders.status, ["PENDING", "COLLECTED", "IN_PROGRESS"])),
    db.select({ value: sql<number>`count(*)::int` }).from(pharmacyOrders).where(inArray(pharmacyOrders.status, ["NEW", "PROCESSING", "READY"])),
    db.select({ value: sql<number>`count(*)::int` }).from(insuranceClaims).where(inArray(insuranceClaims.status, ["SUBMITTED", "UNDER_REVIEW", "APPEALED"])),
    db.select({ value: sql<number>`count(*)::int` }).from(queueEntries).where(eq(queueEntries.status, "WAITING")),
  ]);
  return {
    pendingLabOrders: num(pendingLab[0]?.value),
    pendingPharmacyOrders: num(pendingRx[0]?.value),
    pendingClaims: num(pendingClaims[0]?.value),
    waitingInQueue: num(queued[0]?.value),
  };
};

/** Diagnostics used by the administration screen (counts across domains). */
export const systemHealth = async () => {
  const [released, dispensed, criticalUnacked] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(labResults).where(sql`${labResults.releasedAt} is not null`),
    db.select({ value: sql<number>`count(*)::int` }).from(dispenses),
    db.select({ value: sql<number>`count(*)::int` }).from(labResults).where(and(eq(labResults.critical, true), sql`${labResults.releasedAt} is not null`)),
  ]);
  return {
    releasedLabResults: num(released[0]?.value),
    dispensesRecorded: num(dispensed[0]?.value),
    criticalResultsReleased: num(criticalUnacked[0]?.value),
    uptimeSeconds: Math.round(process.uptime()),
  };
};
