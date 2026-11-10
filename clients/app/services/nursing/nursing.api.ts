import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/nursing.service.ts`. */

export type MarStatus = "DUE" | "GIVEN" | "HELD" | "REFUSED" | "MISSED";
export type NoteType = "SOAP" | "DAR" | "NARRATIVE" | "PROGRESS" | "CONSULT";

export interface AssignedPatient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  age: number;
  bedId: string | null;
}

export interface VitalsRow {
  id: string;
  patientId: string;
  recordedBy: string;
  recordedAt: string;
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  weightKg: number | null;
  heightCm: number | null;
  painScore: number | null;
  notes: string | null;
}

export interface RecordVitalsInput {
  patientId: string;
  encounterId?: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  temperatureC?: number;
  respiratoryRate?: number;
  spo2?: number;
  weightKg?: number;
  heightCm?: number;
  painScore?: number;
  notes?: string;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  encounterId: string | null;
  authorId: string;
  type: NoteType;
  title: string | null;
  content: string;
  status: string;
  currentVersion: number;
  signedAt: string | null;
  signedBy: string | null;
  createdAt: string;
}

export interface MarEntry {
  id: string;
  prescriptionItemId: string;
  patientId: string;
  scheduledFor: string;
  status: MarStatus;
  administeredAt: string | null;
  administeredBy: string | null;
  holdReason: string | null;
  notes: string | null;
  drug: string;
  dose: string;
  frequency: string;
  route: string;
}

export interface WardRoom {
  roomId: string;
  number: string;
  floor: string;
  type: string;
  department: string | null;
  bedCount: number;
  occupied: number;
  available: number;
  maintenance: number;
  status: "Available" | "Occupied" | "Maintenance";
}

export interface WardPatient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  bed: string | null;
  acuity: string;
  admittedAt: string | null;
  doctorName: string | null;
}

export interface WardOverview {
  beds: {
    total: number;
    occupied: number;
    available: number;
    maintenance: number;
    reserved: number;
    cleaning: number;
  };
  rooms: WardRoom[];
  patients: WardPatient[];
  generatedAt: string;
}

export const nursingApi = {
  assignedPatients: async (params: ListParams = {}): Promise<Paginated<AssignedPatient>> => {
    const response = await apiClient.get<AssignedPatient[]>(
      API_ENDPOINTS.nursing.assignedPatients,
      { params },
    );
    return unwrapPage(response.data);
  },

  vitals: async (patientId: string, params: ListParams = {}): Promise<Paginated<VitalsRow>> => {
    const response = await apiClient.get<VitalsRow[]>(API_ENDPOINTS.nursing.patientVitals(patientId), {
      params,
    });
    return unwrapPage(response.data);
  },

  recordVitals: async (input: RecordVitalsInput): Promise<VitalsRow> => {
    const response = await apiClient.post<VitalsRow>(API_ENDPOINTS.nursing.vitals, input);
    return unwrap(response.data);
  },

  notes: async (patientId: string, params: ListParams = {}): Promise<Paginated<ClinicalNote>> => {
    const response = await apiClient.get<ClinicalNote[]>(
      API_ENDPOINTS.nursing.patientNotes(patientId),
      { params },
    );
    return unwrapPage(response.data);
  },

  createNote: async (input: {
    patientId: string;
    title?: string;
    content: string;
    type?: NoteType;
    encounterId?: string;
  }): Promise<ClinicalNote> => {
    const response = await apiClient.post<ClinicalNote>(API_ENDPOINTS.nursing.notes, input);
    return unwrap(response.data);
  },

  medications: async (patientId: string, params: ListParams = {}): Promise<Paginated<MarEntry>> => {
    const response = await apiClient.get<MarEntry[]>(
      API_ENDPOINTS.nursing.medications(patientId),
      { params },
    );
    return unwrapPage(response.data);
  },

  administer: async (
    medicationId: string,
    input: { status: MarStatus; holdReason?: string; notes?: string },
  ): Promise<MarEntry> => {
    const response = await apiClient.post<MarEntry>(
      API_ENDPOINTS.nursing.administer(medicationId),
      input,
    );
    return unwrap(response.data);
  },

  wardOverview: async (): Promise<WardOverview> => {
    const response = await apiClient.get<WardOverview>(API_ENDPOINTS.nursing.wardOverview);
    return unwrap(response.data);
  },
};
