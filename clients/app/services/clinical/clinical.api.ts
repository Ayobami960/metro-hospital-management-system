import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/clinical.service.ts` and `prescribing.service.ts`. */

export type AllergySeverity = "MILD" | "MODERATE" | "SEVERE" | "LIFE_THREATENING";
export type AllergyStatus = "ACTIVE" | "INACTIVE" | "ENTERED_IN_ERROR";
export type ProblemStatus = "ACTIVE" | "MONITORING" | "RESOLVED";

export interface Allergy {
  id: string;
  patientId: string;
  allergen: string;
  reaction: string | null;
  severity: AllergySeverity;
  status: AllergyStatus;
  source: string;
  active: boolean;
  onsetDate: string | null;
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface AllergyFlag {
  patientId: string;
  noKnownAllergies: boolean;
  hasAllergies: boolean;
  count: number;
  hasSevere: boolean;
}

export interface CreateAllergyInput {
  allergen: string;
  reaction?: string;
  severity?: AllergySeverity;
  status?: AllergyStatus;
  onsetDate?: string;
  notes?: string;
}

export interface Problem {
  id: string;
  patientId: string;
  diagnosis: string;
  icd10Id: string | null;
  icd10Code: string | null;
  icd10Description: string | null;
  onsetDate: string | null;
  status: ProblemStatus;
  source: string;
  managedBy: string | null;
  managedByName: string | null;
  lastReviewedAt: string | null;
  resolvedAt: string | null;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface CreateProblemInput {
  diagnosis: string;
  icd10Code?: string;
  icd10Id?: string;
  onsetDate?: string;
  status?: ProblemStatus;
  managedBy?: string;
  notes?: string;
}

export interface VitalObservation {
  id: string;
  patientId: string;
  encounterId: string | null;
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
  temperatureC: string | number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  weightKg: string | number | null;
  heightCm: string | number | null;
  painScore: number | null;
  notes: string | null;
  recordedAt: string;
  recordedBy: string;
}

export interface ActiveMedication {
  id: string;
  prescriptionId: string;
  drugName: string;
  dose: string;
  frequency: string;
  route: string;
  quantity: string | number;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface EncounterSummary {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  chiefComplaint: string | null;
}

export interface ClinicalSummary {
  patientId: string;
  noKnownAllergies: boolean;
  counts: {
    activeAllergies: number;
    severeAllergies: number;
    activeProblems: number;
    activeMedications: number;
  };
  allergies: Allergy[];
  problems: Problem[];
  latestVitals: VitalObservation | null;
  activeMedications: ActiveMedication[];
  recentEncounters: EncounterSummary[];
}

export type PrescriptionStatus =
  | "DRAFT"
  | "SIGNED"
  | "SENT"
  | "PARTIALLY_DISPENSED"
  | "DISPENSED"
  | "CANCELLED"
  | "EXPIRED";

export interface PrescriptionRow {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  dateOfBirth: string;
  age: number;
  doctorId: string;
  doctorName: string;
  status: PrescriptionStatus;
  notes: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  itemCount: number;
  drugNames: string[];
  pharmacyOrderStatus: string | null;
  hasOpenRefill: boolean;
}

export interface PrescriptionItem {
  id: string;
  drugId: string;
  drugName: string;
  genericName: string | null;
  strength: string | null;
  form: string | null;
  dose: string;
  frequency: string;
  route: string;
  durationDays: number | null;
  quantity: string | number;
  unit: string;
  refillsAuthorized: number;
  refillsUsed: number;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  discontinuedAt: string | null;
}

export interface PrescriptionDetail extends Omit<PrescriptionRow, "age" | "itemCount" | "drugNames" | "pharmacyOrderStatus" | "hasOpenRefill"> {
  items: PrescriptionItem[];
  interactions: Array<{ drugA: string; drugB: string; severity: string; description: string | null }>;
}

export interface CreatePrescriptionItemInput {
  drugId: string;
  dose: string;
  frequency: string;
  route?: "PO" | "IV" | "SQ" | "IM" | "TOPICAL" | "INHALED" | "RECTAL" | "OPHTHALMIC";
  durationDays?: number;
  quantity: number;
  unit?: string;
  refillsAuthorized?: number;
  instructions?: string;
  startDate?: string;
}

export interface CreatePrescriptionInput {
  patientId: string;
  encounterId?: string;
  notes?: string;
  priority?: "ROUTINE" | "URGENT" | "STAT";
  allergyOverride?: boolean;
  overrideReason?: string;
  items: CreatePrescriptionItemInput[];
}

export interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  form: string | null;
  category: string | null;
  unit: string | null;
  [key: string]: unknown;
}

export interface DrugInteraction {
  drugAId: string;
  drugBId: string;
  drugA?: string;
  drugB?: string;
  severity: string;
  mechanism: string | null;
  management: string | null;
}

export interface AccessLogRow {
  id: string;
  actorId: string;
  actorRole: string;
  patientId: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
}

/** Row shape of `GET /refills` (`server/src/services/prescribing.service.ts`). */
export interface RefillRequest {
  id: string;
  prescriptionItemId: string;
  patientId: string;
  patientName: string;
  drug: string;
  dose: string;
  refillsAuthorized: number;
  refillsUsed: number;
  status: "REQUESTED" | "APPROVED" | "DENIED";
  reason: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/** Row shape of `GET /audit-logs` (`server/src/services/clinical.service.ts`). */
export interface AuditLogRow {
  id: number;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  level: "INFO" | "WARNING" | "DANGER" | "SUCCESS";
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export const clinicalApi = {
  allergies: async (patientId: string, includeInactive = false): Promise<Allergy[]> => {
    const response = await apiClient.get<Allergy[]>(API_ENDPOINTS.clinical.allergies(patientId), {
      params: { includeInactive },
    });
    return unwrap(response.data);
  },

  myAllergies: async (): Promise<Allergy[]> => {
    const response = await apiClient.get<Allergy[]>(API_ENDPOINTS.clinical.myAllergies);
    return unwrap(response.data);
  },

  allergyFlag: async (patientId: string): Promise<AllergyFlag> => {
    const response = await apiClient.get<AllergyFlag>(
      API_ENDPOINTS.clinical.allergyFlag(patientId),
    );
    return unwrap(response.data);
  },

  createAllergy: async (patientId: string, input: CreateAllergyInput): Promise<Allergy> => {
    const response = await apiClient.post<Allergy>(
      API_ENDPOINTS.clinical.allergies(patientId),
      input,
    );
    return unwrap(response.data);
  },

  updateAllergy: async (
    patientId: string,
    allergyId: string,
    input: Partial<CreateAllergyInput> & { reason?: string },
  ): Promise<Allergy> => {
    const response = await apiClient.patch<Allergy>(
      API_ENDPOINTS.clinical.allergy(patientId, allergyId),
      input,
    );
    return unwrap(response.data);
  },

  verifyAllergy: async (patientId: string, allergyId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.clinical.verifyAllergy(patientId, allergyId), {});
  },

  setNoKnownAllergies: async (patientId: string, noKnownAllergies: boolean, reason?: string) => {
    await apiClient.post(API_ENDPOINTS.clinical.noKnownAllergies(patientId), {
      noKnownAllergies,
      reason,
    });
  },

  problems: async (patientId: string, includeResolved = false): Promise<Problem[]> => {
    const response = await apiClient.get<Problem[]>(API_ENDPOINTS.clinical.problems(patientId), {
      params: { includeResolved },
    });
    return unwrap(response.data);
  },

  myProblems: async (): Promise<Problem[]> => {
    const response = await apiClient.get<Problem[]>(API_ENDPOINTS.clinical.myProblems);
    return unwrap(response.data);
  },

  createProblem: async (patientId: string, input: CreateProblemInput): Promise<Problem> => {
    const response = await apiClient.post<Problem>(
      API_ENDPOINTS.clinical.problems(patientId),
      input,
    );
    return unwrap(response.data);
  },

  updateProblem: async (
    patientId: string,
    problemId: string,
    input: Partial<CreateProblemInput> & { reason?: string },
  ): Promise<Problem> => {
    const response = await apiClient.patch<Problem>(
      API_ENDPOINTS.clinical.problem(patientId, problemId),
      input,
    );
    return unwrap(response.data);
  },

  clinicalSummary: async (patientId: string): Promise<ClinicalSummary> => {
    const response = await apiClient.get<ClinicalSummary>(
      API_ENDPOINTS.patients.clinicalSummary(patientId),
    );
    return unwrap(response.data);
  },

  myClinicalSummary: async (): Promise<ClinicalSummary> => {
    const response = await apiClient.get<ClinicalSummary>(API_ENDPOINTS.clinical.mySummary);
    return unwrap(response.data);
  },

  prescriptions: async (
    params: ListParams & { status?: string } = {},
  ): Promise<Paginated<PrescriptionRow>> => {
    const response = await apiClient.get<PrescriptionRow[]>(API_ENDPOINTS.clinical.prescriptions, {
      params,
    });
    return unwrapPage(response.data);
  },

  prescription: async (prescriptionId: string): Promise<PrescriptionDetail> => {
    const response = await apiClient.get<PrescriptionDetail>(
      API_ENDPOINTS.clinical.prescription(prescriptionId),
    );
    return unwrap(response.data);
  },

  createPrescription: async (
    input: CreatePrescriptionInput,
  ): Promise<{ prescription: { id: string; status: string }; overrideUsed: boolean }> => {
    const response = await apiClient.post<{
      prescription: { id: string; status: string };
      overrideUsed: boolean;
    }>(API_ENDPOINTS.clinical.prescriptions, input);
    return unwrap(response.data);
  },

  cancelPrescription: async (prescriptionId: string, reason: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.clinical.cancelPrescription(prescriptionId), { reason });
  },

  drugs: async (search?: string): Promise<Drug[]> => {
    const response = await apiClient.get<Drug[]>(API_ENDPOINTS.reference.drugs, {
      params: { search },
    });
    return unwrap(response.data);
  },

  interactions: async (drugIds: string[]): Promise<DrugInteraction[]> => {
    const response = await apiClient.post<{ interactions: DrugInteraction[] }>(
      API_ENDPOINTS.reference.checkInteractions,
      { drugIds },
    );
    return unwrap(response.data).interactions;
  },

  allergenReference: async (search?: string): Promise<Array<{ id: string; name: string }>> => {
    const response = await apiClient.get<Array<{ id: string; name: string }>>(
      API_ENDPOINTS.clinical.allergens,
      { params: { search } },
    );
    return unwrap(response.data);
  },

  icd10: async (
    search?: string,
  ): Promise<Array<{ id: string; code: string; description: string }>> => {
    const response = await apiClient.get<Array<{ id: string; code: string; description: string }>>(
      API_ENDPOINTS.clinical.icd10,
      { params: { search } },
    );
    return unwrap(response.data);
  },

  accessLog: async (params: ListParams = {}): Promise<Paginated<AccessLogRow>> => {
    const response = await apiClient.get<AccessLogRow[]>(API_ENDPOINTS.clinical.myAccessLog, {
      params,
    });
    return unwrapPage(response.data);
  },

  refills: async (status?: string): Promise<RefillRequest[]> => {
    const response = await apiClient.get<RefillRequest[]>(API_ENDPOINTS.clinical.refills, {
      params: { status },
    });
    return unwrap(response.data);
  },

  decideRefill: async (
    refillId: string,
    input: { decision: "APPROVED" | "DENIED"; note?: string },
  ): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.clinical.decideRefill(refillId), input);
  },

  requestRefill: async (prescriptionItemId: string, reason?: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.clinical.refills, { prescriptionItemId, reason });
  },

  auditLogs: async (
    params: ListParams & { module?: string; level?: string } = {},
  ): Promise<Paginated<AuditLogRow>> => {
    const response = await apiClient.get<AuditLogRow[]>(API_ENDPOINTS.clinical.auditLogs, {
      params,
    });
    return unwrapPage(response.data);
  },
};
