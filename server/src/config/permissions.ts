import type { UserRole } from "../db/schema/enums.js";

/**
 * Permission catalogue. Default deny: anything not listed for a role is refused.
 * SUPER_ADMIN is a strict superset of ADMIN (decision 3).
 */
export const PERMISSIONS = [
  "patient:read",
  "patient:create",
  "patient:update",
  "patient:merge",
  "patient:delete",
  "patient:export",
  "allergy:read",
  "allergy:write",
  "allergy:verify",
  "problem:read",
  "problem:write",
  "file:read",
  "file:write",
  "file:delete",
  "vitals:read",
  "vitals:write",
  "note:read",
  "note:write",
  "note:sign",
  "prescription:read",
  "prescription:write",
  "prescription:dispense",
  "refill:request",
  "refill:decide",
  "lab:order",
  "lab:result:read",
  "lab:result:enter",
  "lab:result:release",
  "lab:critical:ack",
  "specimen:read",
  "specimen:update",
  "radiology:order",
  "radiology:report",
  "equipment:read",
  "equipment:write",
  "appointment:read",
  "appointment:create",
  "appointment:approve",
  "appointment:cancel",
  "queue:read",
  "queue:manage",
  "encounter:read",
  "encounter:write",
  "admission:read",
  "admission:manage",
  "bed:read",
  "bed:assign",
  "bed:configure",
  "mar:read",
  "mar:administer",
  "inventory:read",
  "inventory:write",
  "purchase_order:read",
  "purchase_order:write",
  "interaction:check",
  "invoice:read",
  "invoice:create",
  "invoice:update",
  "payment:read",
  "payment:record",
  "payment:refund",
  "payment:pay_own",
  "claim:read",
  "claim:manage",
  "payment_plan:read",
  "payment_plan:manage",
  "report:billing",
  "report:clinical",
  "dashboard:admin",
  "dashboard:doctor",
  "dashboard:nurse",
  "dashboard:reception",
  "dashboard:patient",
  "dashboard:pharmacy",
  "dashboard:lab",
  "dashboard:billing",
  "user:read",
  "user:create",
  "user:role",
  "user:deactivate",
  "settings:read",
  "settings:write",
  "reference:read",
  "reference:write",
  "audit:read",
  "audit:export",
  "message:read",
  "message:send",
  "search:global",
  "me:read",
  "me:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];

/** Shared non-clinical reads. Clinical lists are granted explicitly per role. */
const staffRead: Permission[] = [
  "patient:read", "appointment:read", "queue:read", "encounter:read",
  "admission:read", "bed:read", "reference:read", "message:read",
  "message:send", "search:global", "me:read", "me:write",
  "file:read", "file:write",
];

const roleMatrix: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: [
    ...staffRead,
    "patient:create", "patient:update", "patient:merge", "patient:export",
    // Read-only clinical oversight: every read is PHI-logged, edits are refused.
    "allergy:read", "problem:read", "vitals:read", "note:read",
    "file:delete", "equipment:read",
    "appointment:create", "appointment:approve", "appointment:cancel", "queue:manage",
    "encounter:write", "admission:manage", "bed:assign", "bed:configure",
    "inventory:read", "purchase_order:read", "interaction:check",
    "invoice:read", "payment:read", "claim:read", "payment_plan:read",
    "report:billing", "report:clinical", "dashboard:admin", "dashboard:doctor",
    "dashboard:nurse", "dashboard:reception", "dashboard:patient", "dashboard:pharmacy", "dashboard:lab",
    "dashboard:billing", "user:read", "user:create", "user:deactivate", "settings:read",
    "settings:write",
    "reference:read", "reference:write", "audit:read", "audit:export",
  ],
  DOCTOR: [
    ...staffRead,
    "patient:update", "allergy:read", "allergy:write", "allergy:verify",
    "problem:read", "problem:write", "vitals:read", "vitals:write",
    "file:delete", "note:read", "note:write", "note:sign",
    "prescription:read", "prescription:write", "refill:decide",
    "lab:order", "lab:result:read", "lab:critical:ack", "specimen:read",
    "radiology:order", "radiology:report",
    "appointment:create", "appointment:approve", "appointment:cancel",
    "encounter:write", "admission:manage", "bed:assign",
    "mar:read", "interaction:check", "dashboard:doctor", "report:clinical",
  ],
  NURSE: [
    ...staffRead,
    // Writes are accepted but stored unverified until a clinician verifies them.
    "allergy:read", "allergy:write", "problem:read", "problem:write",
    "vitals:read", "vitals:write", "note:read", "note:write", "note:sign",
    "prescription:read", "lab:order", "lab:result:read", "specimen:read",
    "appointment:read", "queue:read", "encounter:write", "admission:manage",
    "bed:assign", "mar:read", "mar:administer", "dashboard:nurse",
  ],
  PATIENT: [
    "patient:read", "allergy:read", "allergy:write", "problem:read", "problem:write",
    "vitals:read", "vitals:write",
    "prescription:read", "refill:request", "lab:result:read",
    "appointment:read", "appointment:create", "appointment:cancel",
    "encounter:read", "admission:read", "invoice:read", "payment:read",
    "payment:pay_own", "claim:read", "payment_plan:read",
    "message:read", "message:send", "search:global", "me:read", "me:write",
    "patient:export", "file:read", "file:write", "reference:read",
    "dashboard:patient",
  ],
  RECEPTION: [
    ...staffRead,
    // No clinical lists: reception sees the allergy flag endpoint only.
    "patient:create", "patient:update",
    "appointment:create", "appointment:approve", "appointment:cancel", "queue:manage",
    "encounter:write", "admission:manage", "bed:assign",
    "invoice:read", "payment:read", "payment:record",
    "dashboard:reception",
  ],
  PHARMACY: [
    // Allergy/problem data is consulted internally by the dispense gate; the
    // role cannot list it directly.
    "patient:read", "prescription:read", "prescription:dispense", "refill:request",
    "inventory:read", "inventory:write", "purchase_order:read", "purchase_order:write",
    "interaction:check", "mar:read", "reference:read",
    "message:read", "message:send", "search:global", "me:read", "me:write",
    "file:read", "file:write", "dashboard:pharmacy",
  ],
  LABORATORY: [
    "patient:read",
    "lab:order", "lab:result:read", "lab:result:enter", "lab:result:release",
    "specimen:read", "specimen:update", "radiology:order", "radiology:report",
    "equipment:read", "equipment:write", "encounter:read", "bed:read",
    "reference:read", "message:read", "message:send", "search:global",
    "me:read", "me:write", "file:read", "file:write", "dashboard:lab",
  ],
  BILLING: [
    // Billing sees patient identity for invoices, never clinical lists/exports.
    "patient:read", "encounter:read",
    "invoice:read", "invoice:create", "invoice:update",
    "payment:read", "payment:record", "payment:refund",
    "claim:read", "claim:manage", "payment_plan:read", "payment_plan:manage",
    "report:billing", "dashboard:billing", "reference:read",
    "message:read", "message:send", "search:global", "me:read", "me:write",
    "file:read", "file:write",
  ],
};

const sets = new Map<UserRole, Set<string>>(
  Object.entries(roleMatrix).map(([role, perms]) => [role as UserRole, new Set<string>(perms)]),
);

export const can = (role: UserRole, permission: Permission): boolean =>
  sets.get(role)?.has(permission) ?? false;

export const permissionsFor = (role: UserRole): Permission[] =>
  ALL.filter((p) => can(role, p));

/** Nav allowlist per role, consumed by GET /me. Mirrors the audit's nav arrays. */
export const NAV: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    "dashboard", "doctors", "patients", "departments", "appointments", "rooms-beds",
    "reports", "system-logs", "settings", "users", "billing", "messages",
  ],
  ADMIN: [
    "dashboard", "doctors", "patients", "departments", "appointments", "rooms-beds",
    "reports", "system-logs", "settings", "messages",
  ],
  DOCTOR: ["dashboard", "appointments", "patients", "prescriptions", "lab-orders", "emr", "schedule", "analytics", "messages", "settings"],
  NURSE: ["dashboard", "patients", "vitals", "medications", "notes", "ward", "messages", "settings"],
  PATIENT: ["dashboard", "appointments", "records", "lab-results", "prescriptions", "bills", "health-insights", "messages", "settings"],
  RECEPTION: ["dashboard", "register", "check-in", "appointments", "queue", "messages", "settings"],
  PHARMACY: ["dashboard", "prescriptions", "inventory", "dispense", "drug-orders", "drug-interactions", "messages", "settings"],
  LABORATORY: ["dashboard", "test-requests", "results-entry", "sample-tracking", "equipment", "radiology", "messages", "settings"],
  BILLING: ["dashboard", "invoices", "payments", "insurance-claims", "outstanding", "reports", "messages", "settings"],
};
