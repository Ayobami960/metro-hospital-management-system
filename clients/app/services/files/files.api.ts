import { apiClient, downloadFile } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/files.service.ts` (Cloudinary, private). */

export type FileOwnerType = "PATIENT" | "ENCOUNTER" | "MESSAGE" | "RADIOLOGY" | "REPORT" | "INVOICE";

export interface FileRecord {
  id: string;
  ownerType: string;
  ownerId: string | null;
  patientId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  provider: string;
  uploadedBy: string | null;
  createdAt: string;
  downloadUrl: string;
}

export const filesApi = {
  upload: async (file: File, input: { ownerType: FileOwnerType; ownerId?: string; patientId?: string }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("ownerType", input.ownerType);
    if (input.ownerId) form.append("ownerId", input.ownerId);
    if (input.patientId) form.append("patientId", input.patientId);
    const response = await apiClient.post<FileRecord>(API_ENDPOINTS.files.upload, form);
    return unwrap(response.data);
  },

  uploadAvatar: async (file: File): Promise<FileRecord> => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiClient.post<FileRecord>(API_ENDPOINTS.profile.avatar, form);
    return unwrap(response.data);
  },

  myAvatar: async (): Promise<FileRecord> => {
    const response = await apiClient.get<FileRecord>(API_ENDPOINTS.profile.avatar);
    return unwrap(response.data);
  },

  patientDocuments: async (
    patientId: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<FileRecord>> => {
    const response = await apiClient.get<FileRecord[]>(
      API_ENDPOINTS.patients.documents(patientId),
      { params },
    );
    return unwrapPage(response.data);
  },

  myDocuments: async (params: { page?: number; pageSize?: number } = {}): Promise<Paginated<FileRecord>> => {
    const response = await apiClient.get<FileRecord[]>(API_ENDPOINTS.files.myDocuments, {
      params,
    });
    return unwrapPage(response.data);
  },

  download: async (fileId: string, fileName = "document"): Promise<void> => {
    await downloadFile(API_ENDPOINTS.files.download(fileId), fileName);
  },

  remove: async (fileId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.files.byId(fileId));
  },
};
