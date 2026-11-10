import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap } from "@/services/api/response";

/** Contracts mirror `server/src/services/scheduling.service.ts`. */

export interface SchedulableDoctor {
  id: string;
  name: string;
  specialty: string | null;
  department: string | null;
}

export interface ScheduleBoardEntry {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  mode: string;
  priority: string;
  reason: string | null;
}

export interface AvailabilityWindow {
  id: string;
  doctorId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
}

export interface TimeOffEntry {
  id: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface ScheduleBoard {
  appointments: ScheduleBoardEntry[];
  availability: AvailabilityWindow[];
  timeOff: TimeOffEntry[];
  generatedAt?: string;
}

export const schedulingApi = {
  doctors: async (): Promise<SchedulableDoctor[]> => {
    const response = await apiClient.get<SchedulableDoctor[]>(API_ENDPOINTS.scheduling.doctors);
    return unwrap(response.data);
  },

  board: async (doctorId: string, from: string): Promise<ScheduleBoard> => {
    const response = await apiClient.get<ScheduleBoard>(API_ENDPOINTS.scheduling.board, {
      params: { doctorId, from },
    });
    return unwrap(response.data);
  },

  availability: async (doctorId: string): Promise<AvailabilityWindow[]> => {
    const response = await apiClient.get<{ availability?: AvailabilityWindow[]; windows?: AvailabilityWindow[] }>(
      API_ENDPOINTS.scheduling.availability,
      { params: { doctorId } },
    );
    const payload = unwrap(response.data);
    return payload.availability ?? payload.windows ?? [];
  },

  setAvailability: async (windows: AvailabilityWindow[]): Promise<void> => {
    await apiClient.put(API_ENDPOINTS.scheduling.availability, { windows });
  },

  timeOff: async (doctorId?: string): Promise<TimeOffEntry[]> => {
    const response = await apiClient.get<TimeOffEntry[]>(API_ENDPOINTS.scheduling.timeOff, {
      params: { doctorId },
    });
    return unwrap(response.data);
  },

  addTimeOff: async (input: { startsAt: string; endsAt: string; reason?: string }): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.scheduling.timeOff, input);
  },

  removeTimeOff: async (entryId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.scheduling.timeOffById(entryId));
  },
};
