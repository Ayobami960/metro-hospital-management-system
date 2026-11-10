import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  admissions,
  appointments,
  beds,
  departments,
  dispenses,
  doctors,
  encounters,
  insuranceClaims,
  invoices,
  labOrders,
  payments,
  queueEntries,
  rooms,
  users,
} from "../db/schema/index.js";
import { doctorRatings } from "../db/schema/scheduling.js";

/**
 * Reporting and analytics. Each figure is a database aggregate over the rows
 * the operational modules write; nothing is stored twice and nothing is
 * synthesised. Ranges default to the trailing twelve months unless the query
 * string asks for something else.
 */

const num = (value: unknown): number => Number(value ?? 0);

const rangeStart = (days?: number) =>
  days ? sql`now() - make_interval(days => ${days})` : sql`now() - interval '12 months'`;

export const reportsOverview = async () => {
  const [
    revenueMonth,
    revenuePrevMonth,
    billed,
    collected,
    satisfaction,
    occupancy,
    lengthOfStay,
    readmissions,
    appointments30,
    completed30,
    noShow30,
    openClaims,
    deniedClaims,
    pendingLab,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.status, "CLEARED"), sql`${payments.receivedAt} >= date_trunc('month', now())`)),
    db
      .select({ value: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int` })
      .from(payments)
      .where(
        and(
          eq(payments.status, "CLEARED"),
          sql`${payments.receivedAt} >= date_trunc('month', now()) - interval '1 month'`,
          sql`${payments.receivedAt} < date_trunc('month', now())`,
        ),
      ),
    db
      .select({ value: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::int` })
      .from(invoices)
      .where(and(sql`${invoices.issuedAt} >= date_trunc('month', now())`, sql`${invoices.status} <> 'VOID'`)),
    db
      .select({ value: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)::int` })
      .from(invoices)
      .where(and(sql`${invoices.issuedAt} >= date_trunc('month', now())`, sql`${invoices.status} <> 'VOID'`)),
    db.select({ value: sql<number>`coalesce(avg(${doctorRatings.rating}), 0)::numeric(4,2)` }).from(doctorRatings),
    db.select({ status: beds.status, value: count() }).from(beds).groupBy(beds.status),
    db
      .select({
        value: sql<number>`coalesce(avg(extract(epoch from (${admissions.dischargedAt} - ${admissions.admittedAt})) / 86400), 0)::numeric(5,2)`,
      })
      .from(admissions)
      .where(sql`${admissions.dischargedAt} is not null`),
    db
      .select({
        total: sql<number>`count(*)::int`,
        readmitted: sql<number>`count(*) filter (where exists (
          select 1 from hms.admission prev
          where prev.patient_id = ${admissions.patientId}
            and prev.discharged_at is not null
            and prev.discharged_at > ${admissions.admittedAt} - interval '30 days'
        ))::int`,
      })
      .from(admissions)
      .where(sql`${admissions.admittedAt} >= now() - interval '90 days'`),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(sql`${appointments.startsAt} >= now() - interval '30 days'`),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.status, "COMPLETED"), sql`${appointments.startsAt} >= now() - interval '30 days'`)),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.status, "NO_SHOW"), sql`${appointments.startsAt} >= now() - interval '30 days'`)),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(insuranceClaims)
      .where(inArray(insuranceClaims.status, ["SUBMITTED", "UNDER_REVIEW", "APPEALED"])),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(insuranceClaims)
      .where(eq(insuranceClaims.status, "DENIED")),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(labOrders)
      .where(inArray(labOrders.status, ["PENDING", "COLLECTED", "IN_PROGRESS"])),
  ]);

  const occupied = num(occupancy.find((row) => row.status === "OCCUPIED")?.value);
  const totalBeds = occupancy.reduce((sum, row) => sum + num(row.value), 0);
  const currentRevenue = num(revenueMonth[0]?.value);
  const previousRevenue = num(revenuePrevMonth[0]?.value);
  const readmissionRate =
    num(readmissions[0]?.total) > 0
      ? Math.round((num(readmissions[0]?.readmitted) / num(readmissions[0]?.total)) * 1000) / 10
      : null;

  return {
    kpis: {
      revenueThisMonthMinor: currentRevenue,
      revenueChangePercent:
        previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 1000) / 10 : null,
      billedThisMonthMinor: num(billed[0]?.value),
      collectedThisMonthMinor: num(collected[0]?.value),
      collectionRatePercent:
        num(billed[0]?.value) > 0 ? Math.round((num(collected[0]?.value) / num(billed[0]?.value)) * 100) : null,
      satisfaction: num(satisfaction[0]?.value),
      bedOccupancyPercent: totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0,
      occupiedBeds: occupied,
      totalBeds,
      avgLengthOfStayDays: Number(lengthOfStay[0]?.value ?? 0),
      readmissionRatePercent: readmissionRate,
      appointmentsLast30: num(appointments30[0]?.value),
      completedLast30: num(completed30[0]?.value),
      noShowLast30: num(noShow30[0]?.value),
      openClaims: num(openClaims[0]?.value),
      deniedClaims: num(deniedClaims[0]?.value),
      pendingLabOrders: num(pendingLab[0]?.value),
    },
    generatedAt: new Date().toISOString(),
  };
};

export const financialReport = async (days = 365) => {
  const since = rangeStart(days);
  const [revenueSeries, departmentRevenue, payerMix, aging, outstanding, refunds] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${payments.receivedAt}), 'Mon')`,
        key: sql<string>`to_char(date_trunc('month', ${payments.receivedAt}), 'YYYY-MM')`,
        collectedMinor: sql<number>`coalesce(sum(${payments.amountMinor}) filter (where ${payments.kind} = 'PAYMENT'), 0)::int`,
        refundedMinor: sql<number>`coalesce(-sum(${payments.amountMinor}) filter (where ${payments.kind} <> 'PAYMENT'), 0)::int`,
      })
      .from(payments)
      .where(and(eq(payments.status, "CLEARED"), sql`${payments.receivedAt} >= ${since}`))
      .groupBy(sql`1, 2`)
      .orderBy(sql`2`),
    db
      .select({
        department: sql<string>`coalesce(${departments.name}, 'Unassigned')`,
        billedMinor: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::int`,
        collectedMinor: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)::int`,
        invoiceCount: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .leftJoin(encounters, eq(invoices.encounterId, encounters.id))
      .leftJoin(doctors, eq(encounters.doctorId, doctors.id))
      .leftJoin(departments, eq(doctors.departmentId, departments.id))
      .where(and(sql`${invoices.issuedAt} >= ${since}`, sql`${invoices.status} <> 'VOID'`))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`),
    db
      .select({
        method: sql<string>`${payments.method}::text`,
        amountMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
        payments: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(and(eq(payments.status, "CLEARED"), sql`${payments.receivedAt} >= ${since}`))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`),
    db
      .select({
        bucket: sql<string>`case
          when ${invoices.dueAt} >= now() then 'Current'
          when ${invoices.dueAt} >= now() - interval '30 days' then '1-30 days'
          when ${invoices.dueAt} >= now() - interval '60 days' then '31-60 days'
          when ${invoices.dueAt} >= now() - interval '90 days' then '61-90 days'
          else '90+ days' end`,
        amountMinor: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)::int`,
        invoices: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"]))
      .groupBy(sql`1`),
    db
      .select({
        value: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)::int`,
      })
      .from(invoices)
      .where(inArray(invoices.status, ["ISSUED", "PARTIALLY_PAID"])),
    db
      .select({ value: sql<number>`coalesce(-sum(${payments.amountMinor}), 0)::int` })
      .from(payments)
      .where(and(sql`${payments.kind} <> 'PAYMENT'`, sql`${payments.receivedAt} >= ${since}`)),
  ]);

  return {
    range: { days },
    revenueSeries,
    departmentRevenue,
    payerMix,
    receivableAging: aging,
    outstandingMinor: num(outstanding[0]?.value),
    refundedMinor: num(refunds[0]?.value),
    generatedAt: new Date().toISOString(),
  };
};

export const clinicalReport = async (days = 180) => {
  const since = rangeStart(days);
  const [diagnoses, encounterMix, satisfactionSeries, appointmentMix, throughput, labTurnaround] = await Promise.all([
    db
      .select({
        diagnosis: sql<string>`coalesce(${encounters.chiefComplaint}, 'Unspecified')`,
        visits: sql<number>`count(*)::int`,
      })
      .from(encounters)
      .where(sql`${encounters.startedAt} >= ${since}`)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(10),
    db
      .select({
        type: sql<string>`${encounters.type}::text`,
        visits: sql<number>`count(*)::int`,
      })
      .from(encounters)
      .where(sql`${encounters.startedAt} >= ${since}`)
      .groupBy(sql`1`),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${doctorRatings.createdAt}), 'Mon')`,
        key: sql<string>`to_char(date_trunc('month', ${doctorRatings.createdAt}), 'YYYY-MM')`,
        rating: sql<number>`round(avg(${doctorRatings.rating}), 2)`,
        responses: sql<number>`count(*)::int`,
      })
      .from(doctorRatings)
      .where(sql`${doctorRatings.createdAt} >= ${since}`)
      .groupBy(sql`1, 2`)
      .orderBy(sql`2`),
    db
      .select({
        type: sql<string>`${appointments.type}`,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${appointments.status} = 'COMPLETED')::int`,
      })
      .from(appointments)
      .where(sql`${appointments.startsAt} >= ${since}`)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${encounters.startedAt}), 'Mon')`,
        key: sql<string>`to_char(date_trunc('month', ${encounters.startedAt}), 'YYYY-MM')`,
        encounters: sql<number>`count(*)::int`,
        uniquePatients: sql<number>`count(distinct ${encounters.patientId})::int`,
      })
      .from(encounters)
      .where(sql`${encounters.startedAt} >= ${since}`)
      .groupBy(sql`1, 2`)
      .orderBy(sql`2`),
    db
      .select({
        hours: sql<number>`coalesce(avg(extract(epoch from (${labOrders.releasedAt} - ${labOrders.orderedAt})) / 3600), 0)::numeric(6,1)`,
        released: sql<number>`count(*)::int`,
      })
      .from(labOrders)
      .where(and(sql`${labOrders.releasedAt} is not null`, sql`${labOrders.releasedAt} >= ${since}`)),
  ]);

  return {
    range: { days },
    topDiagnoses: diagnoses,
    encounterMix,
    satisfactionSeries,
    appointmentMix,
    throughput,
    labTurnaround: labTurnaround[0] ?? { hours: 0, released: 0 },
    generatedAt: new Date().toISOString(),
  };
};

export const operationalReport = async (days = 90) => {
  const since = rangeStart(days);
  const [bedUtilisation, queueWaits, labVolume, pharmacyVolume, admittances] = await Promise.all([
    db
      .select({
        department: sql<string>`coalesce(${departments.name}, 'Unassigned')`,
        rooms: sql<number>`count(distinct ${rooms.id})::int`,
        beds: sql<number>`count(${beds.id})::int`,
        occupied: sql<number>`count(*) filter (where ${beds.status} = 'OCCUPIED')::int`,
      })
      .from(rooms)
      .leftJoin(beds, eq(beds.roomId, rooms.id))
      .leftJoin(departments, eq(rooms.departmentId, departments.id))
      .groupBy(sql`1`),
    db
      .select({
        day: sql<string>`to_char(${queueEntries.checkInAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        avgWaitMinutes: sql<number>`coalesce(avg(extract(epoch from (${queueEntries.calledAt} - ${queueEntries.checkInAt})) / 60), 0)::numeric(6,1)`,
        tickets: sql<number>`count(*)::int`,
      })
      .from(queueEntries)
      .where(and(sql`${queueEntries.checkInAt} >= ${since}`, sql`${queueEntries.calledAt} is not null`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({
        day: sql<string>`to_char(${labOrders.orderedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        ordered: sql<number>`count(*)::int`,
        released: sql<number>`count(*) filter (where ${labOrders.status} = 'RELEASED')::int`,
      })
      .from(labOrders)
      .where(sql`${labOrders.orderedAt} >= ${since}`)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({
        day: sql<string>`to_char(${dispenses.dispensedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        dispensed: sql<number>`count(*)::int`,
      })
      .from(dispenses)
      .where(sql`${dispenses.dispensedAt} >= ${since}`)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({
        admitted: sql<number>`count(*)::int`,
        discharged: sql<number>`count(*) filter (where ${admissions.dischargedAt} is not null)::int`,
        active: sql<number>`count(*) filter (where ${admissions.status} = 'ACTIVE')::int`,
      })
      .from(admissions)
      .where(sql`${admissions.admittedAt} >= ${since}`),
  ]);

  return {
    range: { days },
    bedUtilisation,
    queueWaits,
    labVolume,
    pharmacyVolume,
    admissions: admittances[0] ?? { admitted: 0, discharged: 0, active: 0 },
    generatedAt: new Date().toISOString(),
  };
};

export const staffReport = async (days = 30) => {
  const since = rangeStart(days);
  const [workload, ratings, roster] = await Promise.all([
    db
      .select({
        doctorId: doctors.id,
        doctorName: users.name,
        department: sql<string>`coalesce(${departments.name}, 'Unassigned')`,
        appointments: sql<number>`count(${appointments.id})::int`,
        completed: sql<number>`count(${appointments.id}) filter (where ${appointments.status} = 'COMPLETED')::int`,
        uniquePatients: sql<number>`count(distinct ${appointments.patientId})::int`,
      })
      .from(doctors)
      .innerJoin(users, eq(doctors.userId, users.id))
      .leftJoin(departments, eq(doctors.departmentId, departments.id))
      .leftJoin(appointments, and(eq(appointments.doctorId, doctors.id), sql`${appointments.startsAt} >= ${since}`))
      .groupBy(doctors.id, users.name, departments.name)
      .orderBy(sql`4 desc`),
    db
      .select({
        doctorId: doctorRatings.doctorId,
        rating: sql<number>`round(avg(${doctorRatings.rating}), 2)`,
        responses: sql<number>`count(*)::int`,
      })
      .from(doctorRatings)
      .groupBy(doctorRatings.doctorId),
    db
      .select({ status: doctors.status, value: count() })
      .from(doctors)
      .groupBy(doctors.status),
  ]);

  const ratingByDoctor = new Map(ratings.map((row) => [row.doctorId, row]));
  return {
    range: { days },
    workload: workload.map((row) => ({
      ...row,
      rating: ratingByDoctor.get(row.doctorId)?.rating ?? null,
      ratingResponses: num(ratingByDoctor.get(row.doctorId)?.responses),
    })),
    roster: Object.fromEntries(roster.map((row) => [row.status, num(row.value)])),
    generatedAt: new Date().toISOString(),
  };
};

/** Doctor-facing analytics screen. */
export const doctorAnalytics = async (doctorId: string, days = 90) => {
  const since = rangeStart(days);
  const [perDay, satisfaction, typeMix, diagnoses, totals] = await Promise.all([
    db
      .select({
        date: sql<string>`to_char(${appointments.startsAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        appointments: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${appointments.status} = 'COMPLETED')::int`,
      })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), sql`${appointments.startsAt} >= ${since}`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${doctorRatings.createdAt}), 'Mon')`,
        key: sql<string>`to_char(date_trunc('month', ${doctorRatings.createdAt}), 'YYYY-MM')`,
        rating: sql<number>`round(avg(${doctorRatings.rating}), 2)`,
        responses: sql<number>`count(*)::int`,
      })
      .from(doctorRatings)
      .where(and(eq(doctorRatings.doctorId, doctorId), sql`${doctorRatings.createdAt} >= ${since}`))
      .groupBy(sql`1, 2`)
      .orderBy(sql`2`),
    db
      .select({
        type: sql<string>`${appointments.type}`,
        total: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), sql`${appointments.startsAt} >= ${since}`))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`),
    db
      .select({
        name: sql<string>`coalesce(${encounters.chiefComplaint}, 'Unspecified')`,
        value: sql<number>`count(*)::int`,
      })
      .from(encounters)
      .where(and(eq(encounters.doctorId, doctorId), sql`${encounters.startedAt} >= ${since}`))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(8),
    db
      .select({
        appointments: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${appointments.status} = 'COMPLETED')::int`,
        cancellations: sql<number>`count(*) filter (where ${appointments.status} = 'CANCELLED')::int`,
        noShows: sql<number>`count(*) filter (where ${appointments.status} = 'NO_SHOW')::int`,
        uniquePatients: sql<number>`count(distinct ${appointments.patientId})::int`,
      })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), sql`${appointments.startsAt} >= ${since}`)),
  ]);

  return {
    range: { days },
    appointmentsPerDay: perDay,
    satisfactionTrend: satisfaction,
    appointmentTypeDistribution: typeMix,
    topDiagnoses: diagnoses,
    totals: totals[0] ?? { appointments: 0, completed: 0, cancellations: 0, noShows: 0, uniquePatients: 0 },
    generatedAt: new Date().toISOString(),
  };
};

