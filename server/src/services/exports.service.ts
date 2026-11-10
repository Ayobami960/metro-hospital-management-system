import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { patients } from "../db/schema/patients.js";
import { appointments } from "../db/schema/scheduling.js";
import { invoices } from "../db/schema/billing.js";
import { labOrderItems, labOrders, labResults } from "../db/schema/laboratory.js";
import { analytes, doctors } from "../db/schema/reference.js";
import { auditLogs } from "../db/schema/audit.js";
import { users } from "../db/schema/identity.js";
import { writeAudit } from "../lib/audit.js";
import type { Actor } from "../lib/authorize.js";
import type { ExportColumn, ExportDataset } from "../lib/tabular.js";
import { ageFromDob } from "../lib/time.js";

/**
 * Export datasets. Each function returns the sheet definition plus the row
 * total; the controller only turns it into a CSV/XLSX download. Exports are
 * capped so a mis-click cannot stream an unbounded table, and every run writes
 * an audit row with the row count and truncation flag.
 */

export const ROW_LIMIT = 10_000;
const NIL = "00000000-0000-0000-0000-000000000000";

export interface ExportResult<T> {
  name: string;
  format: "csv" | "xlsx";
  dataset: ExportDataset<T>;
  total: number;
  auditAction: string;
}

export interface ExportRange {
  from: Date | null;
  to: Date | null;
  format: "csv" | "xlsx";
}

export const parseExportRange = (from: unknown, to: unknown, format: unknown): ExportRange => {
  const parse = (value: unknown): Date | null => {
    if (typeof value !== "string" || !value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  return { from: parse(from), to: parse(to), format: format === "xlsx" ? "xlsx" : "csv" };
};

const patientScope = (actor: Actor) => (actor.role === "PATIENT" ? eq(patients.id, actor.patientId ?? NIL) : undefined);

const doctorPanelScope = (actor: Actor) =>
  actor.role === "DOCTOR"
    ? sql`(
        ${patients.primaryDoctorId} = ${actor.doctorId ?? ""}
        or exists (select 1 from hms.doctor_panel p where p.patient_id = ${patients.id} and p.doctor_id = ${actor.doctorId ?? ""} and p.active)
      )`
    : undefined;

const recordExport = async (actor: Actor, result: { auditAction: string; format: string; rows: number; total: number }, ip?: string) =>
  writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: result.auditAction,
    module: "exports",
    entityType: "export",
    level: "SUCCESS",
    detail: { format: result.format, rows: result.rows, truncated: result.total > ROW_LIMIT, total: result.total },
    ip,
  });

export const exportPatients = async (actor: Actor, range: ExportRange, ip?: string) => {
  const where = and(patientScope(actor), doctorPanelScope(actor));
  const rows = await db
    .select({ p: patients, doctorName: users.name })
    .from(patients)
    .leftJoin(doctors, eq(patients.primaryDoctorId, doctors.id))
    .leftJoin(users, eq(doctors.userId, users.id))
    .where(where)
    .orderBy(asc(patients.lastName), asc(patients.firstName))
    .limit(ROW_LIMIT + 1);
  const [totals] = await db.select({ value: sql<number>`count(*)::int` }).from(patients).where(where);
  const total = Number(totals?.value ?? 0);

  const columns: Array<ExportColumn<(typeof rows)[number]>> = [
    { header: "MRN", key: "mrn", value: (r) => r.p.mrn, width: 18 },
    { header: "Last name", key: "lastName", value: (r) => r.p.lastName, width: 18 },
    { header: "First name", key: "firstName", value: (r) => r.p.firstName, width: 18 },
    { header: "Date of birth", key: "dob", value: (r) => r.p.dateOfBirth, width: 14 },
    { header: "Age", key: "age", value: (r) => ageFromDob(r.p.dateOfBirth), width: 8 },
    { header: "Sex at birth", key: "sex", value: (r) => r.p.sexAtBirth, width: 14 },
    { header: "Status", key: "status", value: (r) => r.p.status, width: 12 },
    { header: "Phone", key: "phone", value: (r) => r.p.phone, width: 18 },
    { header: "Email", key: "email", value: (r) => r.p.email, width: 26 },
    { header: "Primary doctor", key: "doctor", value: (r) => r.doctorName, width: 24 },
    { header: "City", key: "city", value: (r) => r.p.city, width: 16 },
    { header: "State", key: "state", value: (r) => r.p.state, width: 8 },
  ];

  await recordExport(actor, { auditAction: "export.patients", format: range.format, rows: rows.length, total }, ip);
  return {
    name: "patients",
    format: range.format,
    dataset: { sheetName: "Patients", columns, rows: rows.slice(0, ROW_LIMIT) },
    total,
    auditAction: "export.patients",
  };
};

export const exportAppointments = async (actor: Actor, range: ExportRange, ip?: string) => {
  const filters = [];
  if (range.from) filters.push(gte(appointments.startsAt, range.from));
  if (range.to) filters.push(lte(appointments.startsAt, range.to));
  if (actor.role === "PATIENT") filters.push(eq(appointments.patientId, actor.patientId ?? NIL));
  if (actor.role === "DOCTOR") filters.push(eq(appointments.doctorId, actor.doctorId ?? NIL));
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      a: appointments,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      mrn: patients.mrn,
      doctorName: users.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(where)
    .orderBy(desc(appointments.startsAt))
    .limit(ROW_LIMIT + 1);
  const [totals] = await db.select({ value: sql<number>`count(*)::int` }).from(appointments).where(where);
  const total = Number(totals?.value ?? 0);

  const columns: Array<ExportColumn<(typeof rows)[number]>> = [
    { header: "Starts at", key: "startsAt", value: (r) => r.a.startsAt, width: 22 },
    { header: "Ends at", key: "endsAt", value: (r) => r.a.endsAt, width: 22 },
    { header: "Patient", key: "patient", value: (r) => r.patientName, width: 24 },
    { header: "MRN", key: "mrn", value: (r) => r.mrn, width: 18 },
    { header: "Doctor", key: "doctor", value: (r) => r.doctorName, width: 24 },
    { header: "Type", key: "type", value: (r) => r.a.type, width: 16 },
    { header: "Mode", key: "mode", value: (r) => r.a.mode, width: 12 },
    { header: "Status", key: "status", value: (r) => r.a.status, width: 14 },
    { header: "Priority", key: "priority", value: (r) => r.a.priority, width: 10 },
    { header: "Reason", key: "reason", value: (r) => r.a.reason, width: 32 },
  ];

  await recordExport(actor, { auditAction: "export.appointments", format: range.format, rows: rows.length, total }, ip);
  return {
    name: "appointments",
    format: range.format,
    dataset: { sheetName: "Appointments", columns, rows: rows.slice(0, ROW_LIMIT) },
    total,
    auditAction: "export.appointments",
  };
};

export const exportInvoices = async (
  actor: Actor,
  range: ExportRange,
  patientId: string | undefined,
  ip?: string,
) => {
  const filters = [];
  if (range.from) filters.push(gte(invoices.issuedAt, range.from));
  if (range.to) filters.push(lte(invoices.issuedAt, range.to));
  if (actor.role === "PATIENT") filters.push(eq(invoices.patientId, actor.patientId ?? NIL));
  if (patientId && actor.role !== "PATIENT") filters.push(eq(invoices.patientId, patientId));
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      i: invoices,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      mrn: patients.mrn,
    })
    .from(invoices)
    .innerJoin(patients, eq(invoices.patientId, patients.id))
    .where(where)
    .orderBy(desc(invoices.issuedAt))
    .limit(ROW_LIMIT + 1);
  const [totals] = await db.select({ value: sql<number>`count(*)::int` }).from(invoices).where(where);
  const total = Number(totals?.value ?? 0);

  const columns: Array<ExportColumn<(typeof rows)[number]>> = [
    { header: "Invoice", key: "number", value: (r) => r.i.invoiceNumber, width: 18 },
    { header: "Issued", key: "issued", value: (r) => r.i.issuedAt, width: 22 },
    { header: "Due", key: "due", value: (r) => r.i.dueAt, width: 22 },
    { header: "Patient", key: "patient", value: (r) => r.patientName, width: 24 },
    { header: "MRN", key: "mrn", value: (r) => r.mrn, width: 18 },
    { header: "Status", key: "status", value: (r) => r.i.status, width: 16 },
    { header: "Currency", key: "currency", value: (r) => r.i.currency, width: 10 },
    { header: "Subtotal (minor)", key: "subtotal", value: (r) => r.i.subtotalMinor, width: 16 },
    { header: "Tax (minor)", key: "tax", value: (r) => r.i.taxMinor, width: 12 },
    { header: "Total (minor)", key: "total", value: (r) => r.i.totalMinor, width: 14 },
    { header: "Paid (minor)", key: "paid", value: (r) => r.i.amountPaidMinor, width: 14 },
    { header: "Balance (minor)", key: "balance", value: (r) => r.i.totalMinor - r.i.amountPaidMinor, width: 15 },
  ];

  await recordExport(actor, { auditAction: "export.invoices", format: range.format, rows: rows.length, total }, ip);
  return {
    name: "invoices",
    format: range.format,
    dataset: { sheetName: "Invoices", columns, rows: rows.slice(0, ROW_LIMIT) },
    total,
    auditAction: "export.invoices",
  };
};

export const exportLabResults = async (
  actor: Actor,
  range: ExportRange,
  patientId: string | undefined,
  ip?: string,
) => {
  const filters = [];
  if (range.from) filters.push(gte(labResults.enteredAt, range.from));
  if (range.to) filters.push(lte(labResults.enteredAt, range.to));
  if (actor.role === "PATIENT") {
    filters.push(eq(labResults.patientId, actor.patientId ?? NIL));
    filters.push(sql`${labResults.releasedAt} is not null`);
  }
  if (patientId && actor.role !== "PATIENT") filters.push(eq(labResults.patientId, patientId));
  if (actor.role === "DOCTOR") {
    filters.push(
      sql`exists (
        select 1 from hms.lab_order_item i
        join hms.lab_order o on o.id = i.lab_order_id
        where i.id = ${labResults.labOrderItemId}
          and o.ordering_doctor_id = ${actor.doctorId ?? NIL}
      )`,
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      result: labResults,
      analyteName: analytes.name,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      mrn: patients.mrn,
      orderStatus: labOrders.status,
    })
    .from(labResults)
    .innerJoin(analytes, eq(labResults.analyteId, analytes.id))
    .innerJoin(patients, eq(labResults.patientId, patients.id))
    .innerJoin(labOrderItems, eq(labResults.labOrderItemId, labOrderItems.id))
    .innerJoin(labOrders, eq(labOrderItems.labOrderId, labOrders.id))
    .where(where)
    .orderBy(desc(labResults.enteredAt))
    .limit(ROW_LIMIT + 1);
  const [totals] = await db.select({ value: sql<number>`count(*)::int` }).from(labResults).where(where);
  const total = Number(totals?.value ?? 0);

  const columns: Array<ExportColumn<(typeof rows)[number]>> = [
    { header: "Entered at", key: "entered", value: (r) => r.result.enteredAt, width: 22 },
    { header: "Patient", key: "patient", value: (r) => r.patientName, width: 24 },
    { header: "MRN", key: "mrn", value: (r) => r.mrn, width: 18 },
    { header: "Analyte", key: "analyte", value: (r) => r.analyteName, width: 22 },
    { header: "Value", key: "value", value: (r) => r.result.valueText, width: 14 },
    { header: "Unit", key: "unit", value: (r) => r.result.unit, width: 10 },
    { header: "Flag", key: "flag", value: (r) => r.result.flag, width: 16 },
    { header: "Critical", key: "critical", value: (r) => r.result.critical, width: 10 },
    { header: "Released", key: "released", value: (r) => r.result.releasedAt, width: 22 },
    { header: "Order status", key: "orderStatus", value: (r) => r.orderStatus, width: 14 },
  ];

  await recordExport(actor, { auditAction: "export.lab_results", format: range.format, rows: rows.length, total }, ip);
  return {
    name: "lab-results",
    format: range.format,
    dataset: { sheetName: "Lab results", columns, rows: rows.slice(0, ROW_LIMIT) },
    total,
    auditAction: "export.lab_results",
  };
};

export const exportAuditLogs = async (actor: Actor, range: ExportRange, ip?: string) => {
  const filters = [];
  if (range.from) filters.push(gte(auditLogs.createdAt, range.from));
  if (range.to) filters.push(lte(auditLogs.createdAt, range.to));
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(ROW_LIMIT + 1);
  const [totals] = await db.select({ value: sql<number>`count(*)::int` }).from(auditLogs).where(where);
  const total = Number(totals?.value ?? 0);

  const columns: Array<ExportColumn<(typeof rows)[number]>> = [
    { header: "Created at", key: "created", value: (r) => r.createdAt, width: 22 },
    { header: "Actor", key: "actor", value: (r) => r.actorId, width: 26 },
    { header: "Role", key: "role", value: (r) => r.actorRole, width: 12 },
    { header: "Action", key: "action", value: (r) => r.action, width: 28 },
    { header: "Module", key: "module", value: (r) => r.module, width: 14 },
    { header: "Entity", key: "entity", value: (r) => r.entityType, width: 18 },
    { header: "Entity id", key: "entityId", value: (r) => r.entityId, width: 36 },
    { header: "Level", key: "level", value: (r) => r.level, width: 10 },
    { header: "IP", key: "ip", value: (r) => r.ip, width: 16 },
    { header: "Detail", key: "detail", value: (r) => (r.detail ? JSON.stringify(r.detail) : null), width: 60 },
  ];

  await recordExport(actor, { auditAction: "export.audit_logs", format: range.format, rows: rows.length, total }, ip);
  return {
    name: "audit-logs",
    format: range.format,
    dataset: { sheetName: "Audit log", columns, rows: rows.slice(0, ROW_LIMIT) },
    total,
    auditAction: "export.audit_logs",
  };
};
