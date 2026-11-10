import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { nursingApi, type MarStatus, type RecordVitalsInput } from "@/services/nursing/nursing.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const useAssignedPatients = (params: ListParams = {}) =>
  useQuery({
    queryKey: queryKeys.nursing.assigned(params),
    queryFn: () => nursingApi.assignedPatients(params),
  });

export const usePatientVitals = (patientId: string | null | undefined, params: ListParams = {}) =>
  useQuery({
    queryKey: [...queryKeys.nursing.vitals(patientId ?? ""), params] as const,
    queryFn: () => nursingApi.vitals(patientId as string, params),
    enabled: Boolean(patientId),
  });

export const usePatientNotes = (patientId: string | null | undefined, params: ListParams = {}) =>
  useQuery({
    queryKey: [...queryKeys.nursing.notes(patientId ?? ""), params] as const,
    queryFn: () => nursingApi.notes(patientId as string, params),
    enabled: Boolean(patientId),
  });

export const usePatientMedications = (patientId: string | null | undefined, params: ListParams = {}) =>
  useQuery({
    queryKey: [...queryKeys.nursing.medications(patientId ?? ""), params] as const,
    queryFn: () => nursingApi.medications(patientId as string, params),
    enabled: Boolean(patientId),
  });

export const useWardOverview = () =>
  useQuery({ queryKey: queryKeys.nursing.ward, queryFn: nursingApi.wardOverview });

export const useRecordVitals = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordVitalsInput) => nursingApi.recordVitals(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nursing.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.nurse });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.patient });
    },
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: nursingApi.createNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.nursing.all }),
  });
};

export const useAdministerMedication = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      medicationId,
      input,
    }: {
      medicationId: string;
      input: { status: MarStatus; holdReason?: string; notes?: string };
    }) => nursingApi.administer(medicationId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nursing.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.nurse });
    },
  });
};
