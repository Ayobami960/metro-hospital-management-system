import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/appointments.service.ts`. */

export type AppointmentStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";
export type AppointmentPriority = "ROUTINE" | "URGENT" | "STAT";
export type AppointmentMode = "IN_PERSON" | "VIRTUAL";

export interface AppointmentRow {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  patientDob: string;
  doctorId: string;
  at: string;
  endsAt: string;
  mode: AppointmentMode;
  type: string;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  reason: string | null;
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

export interface CreateAppointmentInput {
  patientId: string;
  doctorId: string;
  startsAt: string;
  mode?: AppointmentMode;
  type?: string;
  priority?: AppointmentPriority;
  reason?: string;
  symptoms?: string;
  requestApproval?: boolean;
}

export interface AppointmentListParams extends ListParams {
  status?: string;
  date?: string;
  patientId?: string;
  doctorId?: string;
}

export const appointmentApi = {
  list: async (params: AppointmentListParams = {}): Promise<Paginated<AppointmentRow>> => {
    const response = await apiClient.get<AppointmentRow[]>(API_ENDPOINTS.appointments.list, {
      params,
    });
    return unwrapPage(response.data);
  },

  availability: async (doctorId: string, date: string): Promise<AvailabilitySlot[]> => {
    const response = await apiClient.get<AvailabilitySlot[]>(
      API_ENDPOINTS.appointments.availability,
      { params: { doctorId, date } },
    );
    return unwrap(response.data);
  },

  create: async (input: CreateAppointmentInput): Promise<AppointmentRow> => {
    const response = await apiClient.post<AppointmentRow>(API_ENDPOINTS.appointments.create, input);
    return unwrap(response.data);
  },

  approve: async (appointmentId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.appointments.approve(appointmentId), {});
  },

  cancel: async (appointmentId: string, reason?: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.appointments.cancel(appointmentId), { reason });
  },
};
