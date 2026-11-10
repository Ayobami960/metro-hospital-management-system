import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/laboratory.service.ts`. */

export type LabOrderStatus =
  | "PENDING"
  | "COLLECTED"
  | "IN_PROGRESS"
  | "RESULTED"
  | "RELEASED"
  | "CANCELLED";
export type LabPriority = "ROUTINE" | "URGENT" | "STAT";
export type SpecimenStatus = "COLLECTED" | "IN_TRANSIT" | "RECEIVED" | "PROCESSING" | "ARCHIVED";

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  priority: LabPriority;
  status: LabOrderStatus;
  orderedAt: string;
  specimens: string[];
  itemCount: number;
}

export interface LabOrderDetail {
  id: string;
  patientId: string;
  orderingDoctorId: string | null;
  priority: LabPriority;
  status: LabOrderStatus;
  orderedAt: string;
  clinicalNotes: string | null;
  [key: string]: unknown;
}

export interface LabResultRow {
  id: string;
  labOrderId: string;
  labOrderItemId: string;
  patientId: string;
  analyteId: string;
  valueNumeric: string | number | null;
  valueText: string | null;
  unit: string | null;
  flag: string | null;
  critical: boolean;
  releasedAt: string | null;
  enteredAt: string;
  amendedAt: string | null;
}

export interface LabTest {
  id: string;
  name: string;
  code: string | null;
  department: string | null;
  specimenType: string | null;
  turnaroundHours: number | null;
  isPanel: boolean | null;
  priceMinor: number | null;
  /** The catalogue endpoint returns the analytes belonging to each test. */
  analytes: Array<{ id: string; name: string; unit: string | null; sortOrder: number }>;
}

export interface LabAnalyteRange {
  id: string;
  analyteId: string;
  analyteName: string;
  unit: string | null;
  referenceLow: string | number | null;
  referenceHigh: string | number | null;
}

export interface Specimen {
  id: string;
  labOrderId: string;
  barcode: string;
  specimenType: string;
  status: SpecimenStatus;
  collectedAt: string;
  collectedBy: string | null;
  location: string | null;
}

export interface SpecimenCustodyEvent {
  id: string;
  specimenId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string;
  location: string | null;
  notes: string | null;
  createdAt: string;
}

export interface LabDashboard {
  panels: Array<{ label: string; value: number; status: string }>;
  trends: {
    recentResults: Array<{
      at: string;
      value: number;
      patientId: string;
      flag: string | null;
    }>;
  };
}

export interface CreateLabOrderInput {
  patientId: string;
  testIds: string[];
  priority?: LabPriority;
  clinicalNotes?: string;
  encounterId?: string;
}

export const laboratoryApi = {
  orders: async (
    params: ListParams & { status?: string; priority?: string; patientId?: string } = {},
  ): Promise<Paginated<LabOrder>> => {
    const response = await apiClient.get<LabOrder[]>(API_ENDPOINTS.laboratory.orders, { params });
    return unwrapPage(response.data);
  },

  order: async (orderId: string): Promise<LabOrderDetail> => {
    const response = await apiClient.get<LabOrderDetail>(API_ENDPOINTS.laboratory.order(orderId));
    return unwrap(response.data);
  },

  createOrder: async (input: CreateLabOrderInput): Promise<LabOrder> => {
    const response = await apiClient.post<LabOrder>(API_ENDPOINTS.laboratory.orders, input);
    return unwrap(response.data);
  },

  cancelOrder: async (orderId: string, reason: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.laboratory.cancelOrder(orderId), { reason });
  },

  assignOrder: async (orderId: string, technicianId: string): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.laboratory.assignOrder(orderId), { technicianId });
  },

  collectSpecimen: async (
    orderId: string,
    input: { specimenType?: string; barcode?: string; collectedAt?: string; location?: string },
  ): Promise<Specimen> => {
    const response = await apiClient.post<Specimen>(
      API_ENDPOINTS.laboratory.specimens(orderId),
      input,
    );
    return unwrap(response.data);
  },

  enterResults: async (
    orderId: string,
    input: {
      itemId: string;
      values: Array<{ analyteId: string; valueNumeric?: number; valueText?: string; unit?: string }>;
    },
  ): Promise<{ inserted: LabResultRow[]; critical: boolean }> => {
    const response = await apiClient.post<{ inserted: LabResultRow[]; critical: boolean }>(
      API_ENDPOINTS.laboratory.results(orderId),
      input,
    );
    return unwrap(response.data);
  },

  release: async (
    orderId: string,
    input: { itemIds?: string[]; acknowledgedCriticalIds: string[] },
  ): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.laboratory.release(orderId), input);
  },

  results: async (
    params: ListParams & { patientId?: string; critical?: boolean; flag?: string } = {},
  ): Promise<Paginated<LabResultRow>> => {
    const response = await apiClient.get<LabResultRow[]>(API_ENDPOINTS.laboratory.allResults, {
      params,
    });
    return unwrapPage(response.data);
  },

  criticalResults: async (): Promise<LabResultRow[]> => {
    const response = await apiClient.get<LabResultRow[]>(
      API_ENDPOINTS.laboratory.criticalResults,
    );
    return unwrap(response.data);
  },

  amendResult: async (
    resultId: string,
    input: { valueNumeric?: number; valueText?: string; reason: string },
  ): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.laboratory.amendResult(resultId), input);
  },

  patientResults: async (patientId: string): Promise<unknown> => {
    const response = await apiClient.get<unknown>(API_ENDPOINTS.patients.labResults(patientId));
    return unwrap(response.data);
  },

  myResults: async (): Promise<unknown> => {
    const response = await apiClient.get<unknown>("/me/lab-results");
    return unwrap(response.data);
  },

  specimens: async (
    params: ListParams & { status?: string } = {},
  ): Promise<Paginated<Specimen>> => {
    const response = await apiClient.get<Specimen[]>(API_ENDPOINTS.laboratory.specimenList, {
      params,
    });
    return unwrapPage(response.data);
  },

  lookupSpecimen: async (barcode: string): Promise<Specimen | null> => {
    // The lookup endpoint answers with a placeholder row when nothing matches.
    const response = await apiClient.get<Specimen | { id: null }>(
      API_ENDPOINTS.laboratory.specimenLookup,
      { params: { barcode } },
    );
    const specimen = unwrap<Specimen | { id: null }>(response.data);
    return specimen.id ? specimen : null;
  },

  updateSpecimenStatus: async (
    specimenId: string,
    input: { status: SpecimenStatus; location?: string; notes?: string },
  ): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.laboratory.specimenStatus(specimenId), input);
  },

  specimenCustody: async (specimenId: string): Promise<SpecimenCustodyEvent[]> => {
    const response = await apiClient.get<SpecimenCustodyEvent[]>(
      API_ENDPOINTS.laboratory.specimenCustody(specimenId),
    );
    return unwrap(response.data);
  },

  tests: async (params: { search?: string; pageSize?: number } = {}): Promise<LabTest[]> => {
    const response = await apiClient.get<LabTest[]>(API_ENDPOINTS.laboratory.tests, { params });
    return unwrap(response.data);
  },

  testRanges: async (testId: string): Promise<LabAnalyteRange[]> => {
    const response = await apiClient.get<LabAnalyteRange[]>(
      API_ENDPOINTS.laboratory.testRanges(testId),
    );
    return unwrap(response.data);
  },

  dashboard: async (): Promise<LabDashboard> => {
    const response = await apiClient.get<LabDashboard>(API_ENDPOINTS.laboratory.dashboard);
    return unwrap(response.data);
  },

  notifyCritical: async (input: {
    labResultId: string;
    notifiedUserId: string;
    method?: "PHONE" | "IN_PERSON" | "PAGER" | "SMS";
    note?: string;
  }): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.laboratory.criticalNotification, input);
  },

  acknowledgeCritical: async (notificationId: string, notes?: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.laboratory.acknowledgeCritical(notificationId), { notes });
  },
};
