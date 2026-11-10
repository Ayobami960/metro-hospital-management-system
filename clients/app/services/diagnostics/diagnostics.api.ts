import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/diagnostics.service.ts`. */

export type StudyStatus = "ORDERED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type EquipmentStatus = "Operational" | "Maintenance Due" | "Overdue" | "Out of Service";

export interface RadiologyOrder {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  dateOfBirth: string;
  studyType: string;
  bodyPart: string | null;
  priority: string;
  status: StudyStatus;
  scheduledAt: string | null;
  performedAt: string | null;
  orderedAt: string;
  orderingDoctor: string | null;
  reportId: string | null;
  reportSignedAt: string | null;
}

export interface Equipment {
  id: string;
  name: string;
  model: string | null;
  serial: string | null;
  location: string | null;
  lastCalibrationAt: string | null;
  nextDueAt: string | null;
  maintenanceIntervalDays: number | null;
  outOfService: boolean;
  outOfServiceReason: string | null;
  statusOverride: string | null;
  maintenanceCount: number;
  lastMaintenanceAt: string | null;
  daysUntilDue: number | null;
  status: EquipmentStatus;
}

export interface MaintenanceEntry {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: string;
  technician: string | null;
  performedAt: string;
  notes: string | null;
  result: string | null;
  nextDueAt: string | null;
}

export const diagnosticsApi = {
  radiologyOrders: async (
    params: ListParams & { status?: string } = {},
  ): Promise<Paginated<RadiologyOrder>> => {
    const response = await apiClient.get<RadiologyOrder[]>(
      API_ENDPOINTS.diagnostics.radiologyOrders,
      { params },
    );
    return unwrapPage(response.data);
  },

  updateRadiologyStatus: async (orderId: string, status: StudyStatus): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.diagnostics.radiologyStatus(orderId), { status });
  },

  submitRadiologyReport: async (
    orderId: string,
    input: { findings: string; impression?: string; recommendation?: string },
  ): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.diagnostics.radiologyReport(orderId), input);
  },

  equipment: async (): Promise<Equipment[]> => {
    const response = await apiClient.get<Equipment[]>(API_ENDPOINTS.diagnostics.equipment);
    return unwrap(response.data);
  },

  maintenanceLog: async (equipmentId?: string): Promise<MaintenanceEntry[]> => {
    const response = await apiClient.get<MaintenanceEntry[]>(
      API_ENDPOINTS.diagnostics.maintenance,
      { params: { equipmentId } },
    );
    return unwrap(response.data);
  },

  logMaintenance: async (
    equipmentId: string,
    input: { type: string; technician?: string; notes?: string; result?: string; nextDueAt?: string },
  ): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.diagnostics.equipmentMaintenance(equipmentId), input);
  },

  setEquipmentStatus: async (
    equipmentId: string,
    input: { outOfService: boolean; reason?: string },
  ): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.diagnostics.equipmentStatus(equipmentId), input);
  },
};
