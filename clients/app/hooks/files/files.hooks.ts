import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { filesApi, type FileOwnerType } from "@/services/files/files.api";
import { errorMessage } from "@/services/api/api-error";
import { queryKeys } from "@/lib/query-keys";

export const usePatientDocuments = (
  patientId: string | null | undefined,
  params: { page?: number; pageSize?: number } = {},
) =>
  useQuery({
    queryKey: queryKeys.patients.documents(patientId ?? ""),
    queryFn: () => filesApi.patientDocuments(patientId as string, params),
    enabled: Boolean(patientId),
  });

export const useMyDocuments = (params: { page?: number; pageSize?: number } = {}) =>
  useQuery({ queryKey: ["files", "mine", params], queryFn: () => filesApi.myDocuments(params) });

export const useUploadFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      input,
    }: {
      file: File;
      input: { ownerType: FileOwnerType; ownerId?: string; patientId?: string };
    }) => filesApi.upload(file, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients.all });
      void queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("File uploaded");
    },
    onError: (error) => toast.error(errorMessage(error, "Upload failed.")),
  });
};

export const useUploadAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => filesApi.uploadAvatar(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me });
      toast.success("Photo updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not upload the photo.")),
  });
};

export const useDeleteFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => filesApi.remove(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files"] }),
  });
};
