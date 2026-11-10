import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/patients.service.ts`. */

export type SexAtBirth = "MALE" | "FEMALE" | "INTERSEX" | "UNKNOWN";
export type BloodType =
  | "A_POS"
  | "A_NEG"
  | "B_POS"
  | "B_NEG"
  | "AB_POS"
  | "AB_NEG"
  | "O_POS"
  | "O_NEG"
  | "UNKNOWN";
export type PatientStatus = "ACTIVE" | "INACTIVE" | "DECEASED" | "MERGED";

export interface PatientListRow {
  id: string;
  mrn: string;
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  sexAtBirth: SexAtBirth;
  bloodType: BloodType;
  phone: string | null;
  email: string | null;
  status: PatientStatus;
  bmi: number | null;
  ssnLast4: string | null;
}

export interface Patient extends PatientListRow {
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  heightCm: number | null;
  weightKg: number | null;
}

export interface CreatePatientInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  sexAtBirth: SexAtBirth;
  bloodType: BloodType;
  phone?: string;
  email?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  heightCm?: number;
  weightKg?: number;
  ssnLast4?: string;
  primaryDoctorId?: string;
  allowDuplicate?: boolean;
}

export interface PatientDuplicateCandidate {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface EligibilityResult {
  eligible: boolean;
  status: string;
  insurer?: string;
  plan?: string;
  policyNumber?: string;
  copayMinor?: number;
  coveragePercent?: number;
  reason?: string;
  currency: string;
  checkedAt?: string;
}

export const patientApi = {
  list: async (params: ListParams & { sort?: string } = {}): Promise<Paginated<PatientListRow>> => {
    const response = await apiClient.get<PatientListRow[]>(API_ENDPOINTS.patients.list, { params });
    return unwrapPage(response.data);
  },

  getById: async (patientId: string): Promise<Patient> => {
    const response = await apiClient.get<Patient>(API_ENDPOINTS.patients.byId(patientId));
    return unwrap(response.data);
  },

  create: async (
    input: CreatePatientInput,
    idempotencyKey: string,
  ): Promise<PatientListRow> => {
    const response = await apiClient.post<PatientListRow>(API_ENDPOINTS.patients.create, input, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return unwrap(response.data);
  },

  checkDuplicates: async (input: {
    firstName?: string;
    lastName: string;
    dateOfBirth: string;
  }): Promise<PatientDuplicateCandidate[]> => {
    const response = await apiClient.post<PatientDuplicateCandidate[]>(
      API_ENDPOINTS.patients.duplicates,
      input,
    );
    return unwrap(response.data);
  },

  eligibility: async (patientId: string): Promise<EligibilityResult> => {
    const response = await apiClient.post<EligibilityResult>(
      API_ENDPOINTS.patients.eligibility(patientId),
      {},
    );
    return unwrap(response.data);
  },
};
