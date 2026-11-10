import type { UserRole } from "../db/schema/enums.js";
import { can, type Permission } from "../config/permissions.js";
import type { AuthDb } from "./auth-types.js";
import { AppError, forbidden } from "./http.js";
import { authDb } from "./session.js";

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  patientId: string | null;
  doctorId: string | null;
}

export const requirePermission = (actor: Actor, permission: Permission): void => {
  if (!can(actor.role, permission)) {
    throw forbidden(`Role ${actor.role} lacks ${permission}`);
  }
};

/** 404 rather than 403 so a caller cannot probe for a patient's existence. */
export const assertPatientScope = (allowed: boolean): void => {
  if (!allowed) throw new AppError("NOT_FOUND", "Patient not found");
};

export const dbForActor = (_actor: Actor): AuthDb => authDb;
