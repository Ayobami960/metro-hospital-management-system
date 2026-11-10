import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  clinicalApi,
  type CreateAllergyInput,
  type CreatePrescriptionInput,
  type CreateProblemInput,
} from "@/services/clinical/clinical.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const usePatientAllergies = (patientId: string | null | undefined, includeInactive = false) =>
  useQuery({
    queryKey: [...queryKeys.clinical.allergies(patientId ?? ""), includeInactive] as const,
    queryFn: () => clinicalApi.allergies(patientId as string, includeInactive),
    enabled: Boolean(patientId),
  });

export const useMyAllergies = () =>
  useQuery({
    queryKey: queryKeys.clinical.myAllergies,
    queryFn: clinicalApi.myAllergies,
  });

export const useAllergyFlag = (patientId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.clinical.allergyFlag(patientId ?? ""),
    queryFn: () => clinicalApi.allergyFlag(patientId as string),
    enabled: Boolean(patientId),
  });

export const usePatientProblems = (patientId: string | null | undefined, includeResolved = false) =>
  useQuery({
    queryKey: [...queryKeys.clinical.problems(patientId ?? ""), includeResolved] as const,
    queryFn: () => clinicalApi.problems(patientId as string, includeResolved),
    enabled: Boolean(patientId),
  });

export const useClinicalSummary = (patientId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.clinical.summary(patientId ?? ""),
    queryFn: () => clinicalApi.clinicalSummary(patientId as string),
    enabled: Boolean(patientId),
  });

export const useMyClinicalSummary = () =>
  useQuery({
    queryKey: queryKeys.clinical.mySummary,
    queryFn: clinicalApi.myClinicalSummary,
  });

const useClinicalInvalidation = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.clinical.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.doctor });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.patient });
  };
};

export const useCreateAllergy = () => {
  const invalidate = useClinicalInvalidation();
  return useMutation({
    mutationFn: (input: CreateAllergyInput & { patientId: string }) =>
      clinicalApi.createAllergy(input.patientId, input),
    onSuccess: invalidate,
  });
};

export const useVerifyAllergy = () => {
  const invalidate = useClinicalInvalidation();
  return useMutation({
    mutationFn: ({ patientId, allergyId }: { patientId: string; allergyId: string }) =>
      clinicalApi.verifyAllergy(patientId, allergyId),
    onSuccess: invalidate,
  });
};

export const useCreateProblem = () => {
  const invalidate = useClinicalInvalidation();
  return useMutation({
    mutationFn: (input: CreateProblemInput & { patientId: string }) =>
      clinicalApi.createProblem(input.patientId, input),
    onSuccess: invalidate,
  });
};

export const useUpdateProblem = () => {
  const invalidate = useClinicalInvalidation();
  return useMutation({
    mutationFn: ({
      patientId,
      problemId,
      input,
    }: {
      patientId: string;
      problemId: string;
      input: Partial<CreateProblemInput> & { reason?: string };
    }) => clinicalApi.updateProblem(patientId, problemId, input),
    onSuccess: invalidate,
  });
};

export const usePrescriptions = (params: ListParams & { status?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.clinical.prescriptions(params),
    queryFn: () => clinicalApi.prescriptions(params),
  });

export const usePrescription = (prescriptionId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.clinical.prescription(prescriptionId ?? ""),
    queryFn: () => clinicalApi.prescription(prescriptionId as string),
    enabled: Boolean(prescriptionId),
  });

export const useCreatePrescription = () => {
  const invalidate = useClinicalInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePrescriptionInput) => clinicalApi.createPrescription(input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.pharmacy.all });
    },
  });
};

export const useCancelPrescription = () => {
  const invalidate = useClinicalInvalidation();
  return useMutation({
    mutationFn: ({ prescriptionId, reason }: { prescriptionId: string; reason: string }) =>
      clinicalApi.cancelPrescription(prescriptionId, reason),
    onSuccess: invalidate,
  });
};

export const useDrugs = (search?: string) =>
  useQuery({
    queryKey: queryKeys.clinical.drugs(search),
    queryFn: () => clinicalApi.drugs(search),
    staleTime: 5 * 60_000,
  });

export const useDrugInteractionCheck = () =>
  useMutation({ mutationFn: (drugIds: string[]) => clinicalApi.interactions(drugIds) });

export const useInteractionCheck = (drugIds: string[]) =>
  useQuery({
    queryKey: queryKeys.clinical.interactions(drugIds),
    queryFn: () => clinicalApi.interactions(drugIds),
    enabled: drugIds.length >= 2,
  });

export const useIcd10 = (search?: string) =>
  useQuery({
    queryKey: queryKeys.clinical.icd10(search),
    queryFn: () => clinicalApi.icd10(search),
    staleTime: 5 * 60_000,
  });

export const useAllergenReference = (search?: string) =>
  useQuery({
    queryKey: queryKeys.clinical.allergens(search),
    queryFn: () => clinicalApi.allergenReference(search),
    staleTime: 5 * 60_000,
  });

export const useRefillRequests = (status?: string) =>
  useQuery({
    queryKey: ["clinical", "refills", status ?? "all"] as const,
    queryFn: () => clinicalApi.refills(status),
  });

export const useDecideRefill = () => {
  const invalidate = useClinicalInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      refillId,
      input,
    }: {
      refillId: string;
      input: { decision: "APPROVED" | "DENIED"; note?: string };
    }) => clinicalApi.decideRefill(refillId, input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["clinical", "refills"] });
    },
  });
};

export const useRequestRefill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prescriptionItemId, reason }: { prescriptionItemId: string; reason?: string }) =>
      clinicalApi.requestRefill(prescriptionItemId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clinical", "refills"] }),
  });
};

export const useAccessLog = (params: ListParams = {}) =>
  useQuery({
    queryKey: queryKeys.clinical.accessLog(params),
    queryFn: () => clinicalApi.accessLog(params),
  });

export const useAuditLogs = (params: ListParams & { module?: string; level?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.clinical.auditLogs(params),
    queryFn: () => clinicalApi.auditLogs(params),
  });
