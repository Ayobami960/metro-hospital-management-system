import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { patients } from "../db/schema/patients.js";
import { doctors, drugs } from "../db/schema/reference.js";
import { users } from "../db/schema/identity.js";
import { invoiceItems, invoices, paymentAllocations, payments } from "../db/schema/billing.js";
import { labOrderItems, labOrders, labResults } from "../db/schema/laboratory.js";
import { analytes, labTests } from "../db/schema/reference.js";
import { prescriptionItems, prescriptions } from "../db/schema/clinical.js";
import type { Actor } from "../lib/authorize.js";
import { requirePermission } from "../lib/authorize.js";
import { canReadClinicalPatient } from "../lib/patient-access.js";
import { writeAudit, writePhiAccess } from "../lib/audit.js";
import { notFound } from "../lib/http.js";
import { env } from "../config/env.js";
import { createPdf, drawHeader, drawMetaGrid, drawSectionTitle, drawTable, finalizePdf } from "../lib/pdf.js";
import { buildSummary } from "./clinical.service.js";

/**
 * Printable documents (invoice, lab report, prescription, patient summary).
 * The service renders the PDF and records the audit/PHI rows; the controller
 * only streams the bytes.
 */

const money = (minor: number, currency = "USD"): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

const date = (value: Date | string | null | undefined): string => {
  if (!value) return "—";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: env.clinicTimezone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed);
};

const dateTime = (value: Date | string | null | undefined): string => {
  if (!value) return "—";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: env.clinicTimezone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

export interface RenderedDocument {
  fileName: string;
  buffer: Buffer;
}

const recordDocument = async (
  actor: Actor,
  ip: string | null,
  buffer: Buffer,
  audit: { action: string; entityType: string; entityId: string; patientId: string },
): Promise<void> => {
  await writeAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: audit.action,
    module: "documents",
    entityType: audit.entityType,
    entityId: audit.entityId,
    detail: { patientId: audit.patientId, bytes: buffer.length },
    ip,
  });
  if (actor.role !== "PATIENT") {
    await writePhiAccess({
      actorId: actor.id,
      actorRole: actor.role,
      patientId: audit.patientId,
      resourceType: audit.entityType,
      resourceId: audit.entityId,
      action: "READ",
      ip,
    });
  }
};

const patientBlock = (patient: typeof patients.$inferSelect) => ({
  name: `${patient.firstName} ${patient.lastName}`,
  mrn: patient.mrn,
  dob: date(patient.dateOfBirth),
  sex: patient.sexAtBirth,
});

const assertInvoiceAccess = (actor: Actor, patientId: string): void => {
  if (actor.role === "PATIENT") {
    if (actor.patientId !== patientId) throw notFound("Invoice not found");
    return;
  }
  requirePermission(actor, "invoice:read");
};

const assertPrescriptionAccess = async (actor: Actor, patientId: string): Promise<void> => {
  requirePermission(actor, "prescription:read");
  if (actor.role === "PATIENT") {
    if (actor.patientId !== patientId) throw notFound("Prescription not found");
    return;
  }
  if (actor.role === "DOCTOR" || actor.role === "NURSE") {
    if (!(await canReadClinicalPatient(actor, patientId))) throw notFound("Prescription not found");
  }
};

export const renderInvoicePdf = async (actor: Actor, invoiceId: string, ip?: string): Promise<RenderedDocument> => {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) throw notFound("Invoice not found");
  assertInvoiceAccess(actor, invoice.patientId);

  const [patient] = await db.select().from(patients).where(eq(patients.id, invoice.patientId)).limit(1);
  if (!patient) throw notFound("Invoice not found");
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoice.id))
    .orderBy(asc(invoiceItems.createdAt));
  const allocations = await db
    .select({ payment: payments, amountMinor: paymentAllocations.amountMinor })
    .from(paymentAllocations)
    .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
    .where(eq(paymentAllocations.invoiceId, invoice.id));

  const doc = createPdf();
  drawHeader(doc, "Invoice", invoice.invoiceNumber);
  const person = patientBlock(patient);
  drawMetaGrid(doc, [
    { label: "Patient", value: person.name },
    { label: "MRN", value: person.mrn },
    { label: "Issued", value: date(invoice.issuedAt) },
    { label: "Due", value: date(invoice.dueAt) },
    { label: "Status", value: invoice.status },
    { label: "Balance", value: money(invoice.totalMinor - invoice.amountPaidMinor, invoice.currency) },
  ]);

  drawSectionTitle(doc, "Charges");
  drawTable(doc, {
    columns: [
      { header: "Description", key: "description", width: 250 },
      { header: "Qty", key: "quantity", width: 45, align: "right" },
      { header: "Unit", key: "unit", width: 90, align: "right" },
      { header: "Total", key: "total", width: 100, align: "right" },
    ],
    rows: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: money(item.unitPriceMinor, invoice.currency),
      total: money(item.totalMinor, invoice.currency),
    })),
  });

  drawSectionTitle(doc, "Summary");
  drawTable(doc, {
    columns: [
      { header: "Line", key: "label", width: 300 },
      { header: "Amount", key: "value", width: 185, align: "right" },
    ],
    rows: [
      { label: "Subtotal", value: money(invoice.subtotalMinor, invoice.currency) },
      { label: "Tax", value: money(invoice.taxMinor, invoice.currency) },
      { label: "Total", value: money(invoice.totalMinor, invoice.currency) },
      { label: "Paid to date", value: money(invoice.amountPaidMinor, invoice.currency) },
      { label: "Balance due", value: money(invoice.totalMinor - invoice.amountPaidMinor, invoice.currency) },
    ],
  });

  if (allocations.length > 0) {
    drawSectionTitle(doc, "Payments");
    drawTable(doc, {
      columns: [
        { header: "Payment", key: "number", width: 150 },
        { header: "Method", key: "method", width: 100 },
        { header: "Received", key: "received", width: 130 },
        { header: "Allocated", key: "amount", width: 105, align: "right" },
      ],
      rows: allocations.map((row) => ({
        number: row.payment.paymentNumber,
        method: row.payment.method,
        received: date(row.payment.receivedAt),
        amount: money(row.amountMinor, invoice.currency),
      })),
    });
  }

  const buffer = await finalizePdf(doc);
  await recordDocument(actor, ip ?? null, buffer, {
    action: "document.invoice",
    entityType: "invoice",
    entityId: invoice.id,
    patientId: invoice.patientId,
  });
  return { fileName: `invoice-${invoice.invoiceNumber}.pdf`, buffer };
};

export const renderLabReportPdf = async (actor: Actor, orderId: string, ip?: string): Promise<RenderedDocument> => {
  requirePermission(actor, "lab:result:read");
  const [order] = await db.select().from(labOrders).where(eq(labOrders.id, orderId)).limit(1);
  if (!order) throw notFound("Lab order not found");
  if (actor.role === "PATIENT" && actor.patientId !== order.patientId) throw notFound("Lab order not found");
  if (actor.role === "DOCTOR" && order.orderingDoctorId !== actor.doctorId) {
    if (!(await canReadClinicalPatient(actor, order.patientId))) throw notFound("Lab order not found");
  }
  const [patient] = await db.select().from(patients).where(eq(patients.id, order.patientId)).limit(1);
  if (!patient) throw notFound("Lab order not found");

  const rows = await db
    .select({ testName: labTests.name, analyte: analytes.name, result: labResults })
    .from(labOrderItems)
    .innerJoin(labTests, eq(labOrderItems.testId, labTests.id))
    .leftJoin(labResults, eq(labResults.labOrderItemId, labOrderItems.id))
    .leftJoin(analytes, eq(labResults.analyteId, analytes.id))
    .where(eq(labOrderItems.labOrderId, orderId))
    .orderBy(asc(labTests.name), asc(analytes.sortOrder));

  const visible = actor.role === "PATIENT" ? rows.filter((row) => row.result?.releasedAt) : rows;
  if (actor.role === "PATIENT" && visible.length === 0) throw notFound("Lab report not released");

  const doc = createPdf();
  drawHeader(doc, "Laboratory Report", `Order ${order.id.slice(0, 8).toUpperCase()}`);
  drawMetaGrid(doc, [
    { label: "Patient", value: `${patient.firstName} ${patient.lastName}` },
    { label: "MRN", value: patient.mrn },
    { label: "Ordered", value: dateTime(order.orderedAt) },
    { label: "Status", value: order.status },
    { label: "Priority", value: order.priority },
    { label: "Released", value: dateTime(order.releasedAt) },
    { label: "Date of birth", value: date(patient.dateOfBirth) },
    { label: "Sex", value: patient.sexAtBirth },
  ]);

  drawSectionTitle(doc, "Results");
  drawTable(doc, {
    columns: [
      { header: "Test", key: "test", width: 165 },
      { header: "Analyte", key: "analyte", width: 125 },
      { header: "Result", key: "value", width: 80 },
      { header: "Unit", key: "unit", width: 55 },
      { header: "Flag", key: "flag", width: 60 },
    ],
    rows: visible.map((row) => ({
      test: row.testName,
      analyte: row.analyte,
      value: row.result?.valueText,
      unit: row.result?.unit,
      flag: row.result?.flag,
    })),
  });

  if (order.clinicalNotes) {
    drawSectionTitle(doc, "Clinical notes");
    doc.font("Helvetica").fontSize(9).fillColor("#0f172a").text(order.clinicalNotes);
  }

  const buffer = await finalizePdf(doc);
  await recordDocument(actor, ip ?? null, buffer, {
    action: "document.lab_report",
    entityType: "lab_order",
    entityId: order.id,
    patientId: order.patientId,
  });
  return { fileName: `lab-report-${order.id.slice(0, 8)}.pdf`, buffer };
};

export const renderPrescriptionPdf = async (actor: Actor, id: string, ip?: string): Promise<RenderedDocument> => {
  const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1);
  if (!rx) throw notFound("Prescription not found");
  await assertPrescriptionAccess(actor, rx.patientId);

  const [patient] = await db.select().from(patients).where(eq(patients.id, rx.patientId)).limit(1);
  if (!patient) throw notFound("Prescription not found");
  const [prescriber] = await db
    .select({ name: users.name })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.id, rx.doctorId))
    .limit(1);
  const items = await db
    .select({
      name: drugs.name,
      strength: drugs.strength,
      dose: prescriptionItems.dose,
      frequency: prescriptionItems.frequency,
      route: prescriptionItems.route,
      durationDays: prescriptionItems.durationDays,
      quantity: prescriptionItems.quantity,
      unit: prescriptionItems.unit,
      refills: prescriptionItems.refillsAuthorized,
      instructions: prescriptionItems.instructions,
    })
    .from(prescriptionItems)
    .innerJoin(drugs, eq(prescriptionItems.drugId, drugs.id))
    .where(eq(prescriptionItems.prescriptionId, rx.id));

  const doc = createPdf();
  drawHeader(doc, "Prescription", rx.id.slice(0, 8).toUpperCase());
  drawMetaGrid(doc, [
    { label: "Patient", value: `${patient.firstName} ${patient.lastName}` },
    { label: "MRN", value: patient.mrn },
    { label: "Date of birth", value: date(patient.dateOfBirth) },
    { label: "Prescriber", value: prescriber?.name ?? "—" },
    { label: "Signed", value: dateTime(rx.signedAt) },
    { label: "Expires", value: dateTime(rx.expiresAt) },
    { label: "Status", value: rx.status },
    { label: "Prescription id", value: rx.id },
  ]);

  drawSectionTitle(doc, "Medications");
  drawTable(doc, {
    columns: [
      { header: "Drug", key: "drug", width: 155 },
      { header: "Dose", key: "dose", width: 70 },
      { header: "Frequency", key: "frequency", width: 75 },
      { header: "Route", key: "route", width: 45 },
      { header: "Qty", key: "quantity", width: 50 },
      { header: "Refills", key: "refills", width: 45, align: "right" },
    ],
    rows: items.map((item) => ({
      drug: `${item.name}${item.strength ? ` ${item.strength}` : ""}`,
      dose: item.dose,
      frequency: item.frequency,
      route: item.route,
      quantity: `${item.quantity} ${item.unit}`,
      refills: item.refills,
    })),
  });

  if (items.some((item) => item.instructions)) {
    drawSectionTitle(doc, "Instructions");
    for (const item of items) {
      if (!item.instructions) continue;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text(`${item.name}: `, { continued: true });
      doc.font("Helvetica").fontSize(8).text(item.instructions);
    }
  }

  if (rx.notes) {
    drawSectionTitle(doc, "Notes");
    doc.font("Helvetica").fontSize(9).fillColor("#0f172a").text(rx.notes);
  }

  const buffer = await finalizePdf(doc);
  await recordDocument(actor, ip ?? null, buffer, {
    action: "document.prescription",
    entityType: "prescription",
    entityId: rx.id,
    patientId: rx.patientId,
  });
  return { fileName: `prescription-${rx.id.slice(0, 8)}.pdf`, buffer };
};

export const renderPatientSummaryPdf = async (actor: Actor, patientId: string, ip?: string): Promise<RenderedDocument> => {
  requirePermission(actor, "patient:read");
  requirePermission(actor, "allergy:read");
  requirePermission(actor, "problem:read");
  if (actor.role === "PATIENT" && actor.patientId !== patientId) throw notFound("Patient not found");
  if (actor.role !== "PATIENT" && !(await canReadClinicalPatient(actor, patientId))) throw notFound("Patient not found");

  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!patient) throw notFound("Patient not found");
  const summary = await buildSummary(patientId);

  const doc = createPdf();
  drawHeader(doc, "Patient Clinical Summary", `${patient.firstName} ${patient.lastName} · ${patient.mrn}`);
  drawMetaGrid(doc, [
    { label: "Date of birth", value: date(patient.dateOfBirth) },
    { label: "Sex at birth", value: patient.sexAtBirth },
    { label: "Blood type", value: patient.bloodType },
    { label: "Allergies", value: summary.noKnownAllergies ? "No known allergies" : `${summary.counts.activeAllergies} active` },
    { label: "Active problems", value: String(summary.counts.activeProblems) },
    { label: "Active medications", value: String(summary.counts.activeMedications) },
  ]);

  drawSectionTitle(doc, "Allergies");
  drawTable(doc, {
    columns: [
      { header: "Allergen", key: "allergen", width: 190 },
      { header: "Reaction", key: "reaction", width: 190 },
      { header: "Severity", key: "severity", width: 105 },
    ],
    rows: summary.noKnownAllergies
      ? [{ allergen: "No known allergies", reaction: "—", severity: "—" }]
      : summary.allergies.map((allergy) => ({
          allergen: allergy.allergen,
          reaction: allergy.reaction,
          severity: allergy.severity,
        })),
  });

  drawSectionTitle(doc, "Problem list");
  drawTable(doc, {
    columns: [
      { header: "Diagnosis", key: "diagnosis", width: 220 },
      { header: "ICD-10", key: "icd", width: 70 },
      { header: "Onset", key: "onset", width: 90 },
      { header: "Status", key: "status", width: 105 },
    ],
    rows: summary.problems.map((problem) => ({
      diagnosis: problem.diagnosis,
      icd: problem.icd10Code,
      onset: date(problem.onsetDate),
      status: problem.status,
    })),
  });

  drawSectionTitle(doc, "Active medications");
  drawTable(doc, {
    columns: [
      { header: "Drug", key: "drug", width: 200 },
      { header: "Dose", key: "dose", width: 90 },
      { header: "Frequency", key: "frequency", width: 90 },
      { header: "Route", key: "route", width: 60 },
      { header: "Quantity", key: "quantity", width: 55, align: "right" },
    ],
    rows: summary.activeMedications.map((med) => ({
      drug: med.drugName,
      dose: med.dose,
      frequency: med.frequency,
      route: med.route,
      quantity: med.quantity,
    })),
  });

  if (summary.latestVitals) {
    const v = summary.latestVitals;
    drawSectionTitle(doc, "Latest vitals");
    drawMetaGrid(doc, [
      { label: "Recorded", value: dateTime(v.recordedAt) },
      { label: "Blood pressure", value: v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic} mmHg` : "—" },
      { label: "Heart rate", value: v.heartRate ? `${v.heartRate} bpm` : "—" },
      { label: "Temperature", value: v.temperatureC ? `${v.temperatureC} °C` : "—" },
      { label: "SpO₂", value: v.spo2 ? `${v.spo2}%` : "—" },
      { label: "Pain", value: v.painScore === null ? "—" : `${v.painScore}/10` },
    ]);
  }

  const buffer = await finalizePdf(doc);
  await recordDocument(actor, ip ?? null, buffer, {
    action: "document.patient_summary",
    entityType: "patient",
    entityId: patient.id,
    patientId: patient.id,
  });
  return { fileName: `patient-summary-${patient.id.slice(0, 8)}.pdf`, buffer };
};
