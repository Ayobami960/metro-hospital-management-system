import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/reception.service.ts`. */

export type QueueStatus = "WAITING" | "CALLED" | "IN_PROGRESS" | "COMPLETED" | "REMOVED";
export type QueuePriority = "ROUTINE" | "URGENT" | "STAT";

export interface QueueEntry {
  id: string;
  ticketNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  doctorId: string | null;
  priority: QueuePriority;
  status: QueueStatus;
  type: "WALK_IN" | "APPOINTMENT";
  checkInAt: string;
  calledAt: string | null;
  completedAt: string | null;
  position: number;
  waitMinutes: number;
}

export interface AddQueueInput {
  patientId: string;
  doctorId?: string;
  departmentId?: string;
  roomId?: string;
  type?: "WALK_IN" | "APPOINTMENT";
  priority?: QueuePriority;
  notes?: string;
  appointmentId?: string;
}

export const receptionApi = {
  queue: async (params: { page?: number; pageSize?: number; status?: string } = {}): Promise<
    Paginated<QueueEntry>
  > => {
    const response = await apiClient.get<QueueEntry[]>(API_ENDPOINTS.reception.queue, { params });
    return unwrapPage(response.data);
  },

  addToQueue: async (input: AddQueueInput): Promise<QueueEntry> => {
    const response = await apiClient.post<QueueEntry>(API_ENDPOINTS.reception.addToQueue, input);
    return unwrap(response.data);
  },

  callNext: async (doctorId?: string): Promise<QueueEntry> => {
    const response = await apiClient.post<QueueEntry>(API_ENDPOINTS.reception.callNext, { doctorId });
    return unwrap(response.data);
  },

  start: async (queueId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.reception.start(queueId), {});
  },

  complete: async (queueId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.reception.complete(queueId), {});
  },

  remove: async (queueId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.reception.remove(queueId), {});
  },
};
