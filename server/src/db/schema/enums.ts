import { hms } from "./namespace.js";

export const userRole = hms.enum("user_role", [
  "SUPER_ADMIN",
  "ADMIN",
  "DOCTOR",
  "NURSE",
  "PATIENT",
  "RECEPTION",
  "PHARMACY",
  "LABORATORY",
  "BILLING",
]);

export type UserRole = (typeof userRole.enumValues)[number];

export const userStatus = hms.enum("user_status", [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "LOCKED",
  "DEACTIVATED",
]);

export type UserStatus = (typeof userStatus.enumValues)[number];

export const staffStatus = hms.enum("staff_status", ["ACTIVE", "ON_LEAVE", "INACTIVE"]);

export const patientStatus = hms.enum("patient_status", ["ACTIVE", "INACTIVE", "DECEASED", "MERGED"]);

export const sexAtBirth = hms.enum("sex_at_birth", ["MALE", "FEMALE", "INTERSEX", "UNKNOWN"]);

export const bloodType = hms.enum("blood_type", [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
  "UNKNOWN",
]);

export const relationship = hms.enum("relationship_kind", [
  "SPOUSE",
  "PARENT",
  "CHILD",
  "SIBLING",
  "GUARDIAN",
  "OTHER",
]);

export const encounterType = hms.enum("encounter_type", [
  "OUTPATIENT",
  "INPATIENT",
  "EMERGENCY",
  "TELEHEALTH",
]);

export const encounterStatus = hms.enum("encounter_status", [
  "PLANNED",
  "ARRIVED",
  "IN_PROGRESS",
  "ON_HOLD",
  "FINISHED",
  "CANCELLED",
]);

export const acuity = hms.enum("acuity", ["STABLE", "MONITORING", "CRITICAL", "DISCHARGE_READY"]);

export const bedStatus = hms.enum("bed_status", [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "MAINTENANCE",
  "CLEANING",
]);

export const roomType = hms.enum("room_type", [
  "STANDARD",
  "PRIVATE",
  "ICU",
  "EMERGENCY",
  "ISOLATION",
]);

export const allergySeverity = hms.enum("allergy_severity", [
  "MILD",
  "MODERATE",
  "SEVERE",
  "LIFE_THREATENING",
]);

export const problemStatus = hms.enum("problem_status", ["ACTIVE", "MONITORING", "RESOLVED"]);

/** Allergy lifecycle. Rows are never deleted; `ENTERED_IN_ERROR` is the retraction. */
export const allergyStatus = hms.enum("allergy_status", [
  "ACTIVE",
  "INACTIVE",
  "ENTERED_IN_ERROR",
]);

export const allergenSource = hms.enum("allergen_source", [
  "PATIENT_REPORTED",
  "CLINICIAN",
  "PHARMACY",
  "IMPORTED",
]);

export const problemSource = hms.enum("problem_source", [
  "PATIENT_REPORTED",
  "CLINICIAN",
  "IMPORTED",
]);

export const noteType = hms.enum("note_type", ["SOAP", "DAR", "NARRATIVE", "PROGRESS", "CONSULT"]);

export const noteStatus = hms.enum("note_status", ["DRAFT", "SIGNED", "AMENDED"]);

export const medRoute = hms.enum("med_route", [
  "PO",
  "IV",
  "SQ",
  "IM",
  "TOPICAL",
  "INHALED",
  "RECTAL",
  "OPHTHALMIC",
]);

export const medAdminStatus = hms.enum("med_admin_status", [
  "DUE",
  "GIVEN",
  "HELD",
  "REFUSED",
  "MISSED",
]);

export const appointmentStatus = hms.enum("appointment_status", [
  "REQUESTED",
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
]);

export const appointmentMode = hms.enum("appointment_mode", ["IN_PERSON", "VIRTUAL"]);

export const priority = hms.enum("priority", ["ROUTINE", "URGENT", "STAT"]);

export const queueStatus = hms.enum("queue_status", [
  "WAITING",
  "CALLED",
  "IN_PROGRESS",
  "COMPLETED",
  "REMOVED",
]);

export const queueType = hms.enum("queue_type", ["WALK_IN", "APPOINTMENT"]);

export const prescriptionStatus = hms.enum("prescription_status", [
  "DRAFT",
  "SIGNED",
  "SENT",
  "PARTIALLY_DISPENSED",
  "DISPENSED",
  "CANCELLED",
  "EXPIRED",
]);

export const pharmacyOrderStatus = hms.enum("pharmacy_order_status", [
  "NEW",
  "PROCESSING",
  "READY",
  "DISPENSED",
  "CANCELLED",
]);

export const refillRequestStatus = hms.enum("refill_request_status", [
  "REQUESTED",
  "APPROVED",
  "DENIED",
  "CANCELLED",
]);

export const poStatus = hms.enum("po_status", [
  "DRAFT",
  "SUBMITTED",
  "SHIPPED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
]);

export const stockMovementReason = hms.enum("stock_movement_reason", [
  "RECEIPT",
  "DISPENSE",
  "ADJUSTMENT",
  "EXPIRY",
  "RETURN",
  "TRANSFER",
  "COUNT_CORRECTION",
]);

export const interactionSeverity = hms.enum("interaction_severity", [
  "MINOR",
  "MODERATE",
  "MAJOR",
  "CONTRAINDICATED",
]);

export const labOrderStatus = hms.enum("lab_order_status", [
  "PENDING",
  "COLLECTED",
  "IN_PROGRESS",
  "RESULTED",
  "RELEASED",
  "CANCELLED",
]);

export const specimenStatus = hms.enum("specimen_status", [
  "COLLECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "PROCESSING",
  "ARCHIVED",
]);

export const labFlag = hms.enum("lab_flag", [
  "NORMAL",
  "HIGH",
  "LOW",
  "CRITICAL_HIGH",
  "CRITICAL_LOW",
]);

export const radiologyStatus = hms.enum("radiology_status", [
  "ORDERED",
  "SCHEDULED",
  "IN_PROGRESS",
  "PENDING_READ",
  "COMPLETED",
  "CANCELLED",
]);

export const equipmentStatus = hms.enum("equipment_status", [
  "OPERATIONAL",
  "MAINTENANCE_DUE",
  "OUT_OF_SERVICE",
]);

export const invoiceStatus = hms.enum("invoice_status", [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "VOID",
  "DISPUTED",
]);

export const paymentMethod = hms.enum("payment_method", [
  "CASH",
  "CHECK",
  "CARD",
  "INSURANCE",
  "TRANSFER",
]);

export const paymentStatus = hms.enum("payment_status", [
  "PENDING",
  "CLEARED",
  "FAILED",
  "REFUNDED",
  "VOIDED",
]);

export const paymentKind = hms.enum("payment_kind", ["PAYMENT", "REFUND", "VOID"]);

export const claimStatus = hms.enum("claim_status", [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "DENIED",
  "APPEALED",
]);

export const metricType = hms.enum("metric_type", [
  "STEPS",
  "WEIGHT",
  "BLOOD_PRESSURE",
  "HEART_RATE",
  "GLUCOSE",
  "SLEEP",
]);

export const planStatus = hms.enum("plan_status", [
  "ACTIVE",
  "COMPLETED",
  "DEFAULTED",
  "CANCELLED",
]);

export const installStatus = hms.enum("installment_status", ["PENDING", "PAID", "LATE", "CANCELLED"]);

export const conversationType = hms.enum("conversation_type", ["DIRECT", "CARE_TEAM"]);

export const auditLevel = hms.enum("audit_level", ["INFO", "WARNING", "DANGER", "SUCCESS"]);

export const fileOwnerType = hms.enum("file_owner_type", [
  "PATIENT",
  "ENCOUNTER",
  "MESSAGE",
  "RADIOLOGY",
  "REPORT",
  "INVOICE",
  "AVATAR",
]);

export const notificationChannel = hms.enum("notification_channel", ["IN_APP", "EMAIL", "SMS"]);

export const emailPurpose = hms.enum("email_purpose", [
  "INVITE",
  "PASSWORD_RESET",
  "WELCOME",
  "BILLING_REMINDER",
  /** Daily Room Access code for hospital staff (never contains the code in logs). */
  "DAILY_CODE",
  "EMAIL_VERIFICATION",
  "PATIENT_LOGIN",
  "ADMIN_2FA",
]);

/**
 * A verification code purpose. Codes are never valid across purposes: the
 * verification service always filters by purpose as well as account.
 */
export const otpPurpose = hms.enum("otp_purpose", [
  "EMAIL_VERIFICATION",
  "DAILY_ROOM_ACCESS",
  "PATIENT_LOGIN",
  "ADMIN_2FA",
]);

export type OtpPurpose = (typeof otpPurpose.enumValues)[number];

export const admissionStatus = hms.enum("admission_status", ["ACTIVE", "DISCHARGED", "TRANSFERRED"]);
