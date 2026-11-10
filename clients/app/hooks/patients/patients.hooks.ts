import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { patientApi, type CreatePatientInput } from "@/services/patients/patient.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const usePatients = (params: ListParams & { sort?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.patients.list(params),
    queryFn: () => patientApi.list(params),
  });

export const usePatient = (patientId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.patients.detail(patientId ?? ""),
    queryFn: () => patientApi.getById(patientId as string),
    enabled: Boolean(patientId),
  });

export const usePatientEligibility = (patientId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.patients.eligibility(patientId ?? ""),
    queryFn: () => patientApi.eligibility(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 5 * 60_000,
  });

export const useCreatePatient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreatePatientInput;
      idempotencyKey: string;
    }) => patientApi.create(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.admin });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.reception });
    },
  });
};

export const useCheckPatientDuplicates = () =>
  useMutation({ mutationFn: patientApi.checkDuplicates });
