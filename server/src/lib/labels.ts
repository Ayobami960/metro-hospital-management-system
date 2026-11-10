import { moneyMinorToDecimal } from "./money.js";

/**
 * Canonical enum value → the label each screen already renders (audit §7).
 * The database never stores these strings.
 */
export const UI_LABELS: Record<string, Record<string, string>> = {
  appointmentStatus: {
    REQUESTED: "Pending Approval",
    SCHEDULED: "Scheduled",
    CONFIRMED: "Confirmed",
    CHECKED_IN: "Checked In",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No Show",
    RESCHEDULED: "Rescheduled",
  },
  queueStatus: {
    WAITING: "In Waiting Room",
    CALLED: "Called",
    IN_PROGRESS: "With Doctor",
    COMPLETED: "Completed",
    REMOVED: "Removed",
  },
  invoiceStatus: {
    DRAFT: "Pending",
    ISSUED: "Outstanding",
    PARTIALLY_PAID: "Outstanding",
    PAID: "Paid",
    VOID: "Void",
    DISPUTED: "Disputed",
  },
  claimStatus: {
    DRAFT: "Pending",
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    APPROVED: "Approved",
    PARTIALLY_APPROVED: "Approved",
    DENIED: "Denied",
    APPEALED: "Appealed",
  },
  prescriptionStatus: {
    DRAFT: "Pending",
    SIGNED: "Active",
    SENT: "Active",
    PARTIALLY_DISPENSED: "Active",
    DISPENSED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
  },
  pharmacyOrderStatus: {
    NEW: "New",
    PROCESSING: "Processing",
    READY: "Ready",
    DISPENSED: "Dispensed",
    CANCELLED: "Cancelled",
  },
  labOrderStatus: {
    PENDING: "Pending",
    COLLECTED: "Sample Collected",
    IN_PROGRESS: "In Progress",
    RESULTED: "Processing",
    RELEASED: "Completed",
    CANCELLED: "Cancelled",
  },
  specimenStatus: {
    COLLECTED: "Collected",
    IN_TRANSIT: "In Transit",
    RECEIVED: "Received",
    PROCESSING: "Processing",
    ARCHIVED: "Archived",
  },
  labFlag: {
    NORMAL: "Normal",
    HIGH: "HIGH",
    LOW: "LOW",
    CRITICAL_HIGH: "CRITICAL HIGH",
    CRITICAL_LOW: "CRITICAL LOW",
  },
  inventoryStatus: {
    IN_STOCK: "In Stock",
    LOW: "Low Stock",
    OUT: "Out of Stock",
    NEAR_EXPIRY: "Near Expiry",
    EXPIRED: "Expired",
  },
  equipmentStatus: {
    OPERATIONAL: "Operational",
    MAINTENANCE_DUE: "Maintenance Due",
    OUT_OF_SERVICE: "Out of Service",
  },
  radiologyStatus: {
    ORDERED: "Ordered",
    SCHEDULED: "Scheduled",
    IN_PROGRESS: "In Progress",
    PENDING_READ: "Pending Read",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  },
  paymentStatus: {
    PENDING: "Pending",
    CLEARED: "Cleared",
    FAILED: "Failed",
    REFUNDED: "Refunded",
    VOIDED: "Voided",
  },
  marStatus: {
    DUE: "Due Now",
    GIVEN: "Given",
    HELD: "Held",
    REFUSED: "Refused",
    MISSED: "Overdue",
  },
  prescriptionClinical: {
    ACTIVE: "Active",
    PENDING: "Pending",
    REFILL_NEEDED: "Refill Needed",
    EXPIRED: "Expired",
  },
  riskBand: { LOW: "Low", MEDIUM: "Medium", HIGH: "High" },
  interactionSeverity: { MINOR: "Minor", MODERATE: "Moderate", MAJOR: "Major", CONTRAINDICATED: "Major" },
};

export const labelFor = (group: string, value: string): string => UI_LABELS[group]?.[value] ?? value;

/** Money for display only; API payloads carry minor units + currency. */
export const displayMoney = (minor: number, currency = "USD"): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(moneyMinorToDecimal(minor));

export const ENUM_GROUP_NAMES = Object.keys(UI_LABELS);
