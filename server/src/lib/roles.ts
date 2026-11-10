import type { UserRole } from "../db/schema/enums.js";

/**
 * Role groups used by the authentication workflow.
 *
 * The Daily Room Access Code is a pre-login verification for hospital staff.
 * Administrators and patients authenticate from the normal login page and must
 * never be issued a room access code.
 */
export const ROOM_ACCESS_ROLES = [
  "DOCTOR",
  "NURSE",
  "RECEPTION",
  "PHARMACY",
  "LABORATORY",
  "BILLING",
] as const satisfies readonly UserRole[];

export type RoomAccessRole = (typeof ROOM_ACCESS_ROLES)[number];

export const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const satisfies readonly UserRole[];

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const isRoomAccessRole = (role: UserRole): role is RoomAccessRole =>
  (ROOM_ACCESS_ROLES as readonly UserRole[]).includes(role);

export const isAdminRole = (role: UserRole): role is AdminRole =>
  (ADMIN_ROLES as readonly UserRole[]).includes(role);

/** Portal slug used by `/login?role=…` for each room-access role. */
export const PORTAL_SLUG_FOR_ROLE: Record<RoomAccessRole, string> = {
  DOCTOR: "doctor",
  NURSE: "nurse",
  RECEPTION: "reception",
  PHARMACY: "pharmacy",
  LABORATORY: "lab",
  BILLING: "billing",
};

export const portalLoginPathForRole = (role: RoomAccessRole): string =>
  `/login?role=${PORTAL_SLUG_FOR_ROLE[role]}`;

export const portalLabelForRole = (role: RoomAccessRole): string =>
  ({
    DOCTOR: "Doctor Portal",
    NURSE: "Nurse Station",
    RECEPTION: "Reception Desk",
    PHARMACY: "Pharmacy",
    LABORATORY: "Laboratory",
    BILLING: "Billing Office",
  })[role];
