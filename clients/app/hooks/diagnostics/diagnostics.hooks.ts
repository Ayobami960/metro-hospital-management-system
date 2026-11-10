import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { diagnosticsApi, type StudyStatus } from "@/services/diagnostics/diagnostics.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const useRadiologyOrders = (params: ListParams & { status?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.diagnostics.radiology(params),
    queryFn: () => diagnosticsApi.radiologyOrders(params),
  });

export const useEquipment = () =>
  useQuery({ queryKey: queryKeys.diagnostics.equipment, queryFn: diagnosticsApi.equipment });

export const useMaintenanceLog = (equipmentId?: string) =>
  useQuery({
    queryKey: queryKeys.diagnostics.maintenance(equipmentId),
    queryFn: () => diagnosticsApi.maintenanceLog(equipmentId),
  });

const useDiagnosticsInvalidation = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.all });
};

export const useUpdateRadiologyStatus = () => {
  const invalidate = useDiagnosticsInvalidation();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: StudyStatus }) =>
      diagnosticsApi.updateRadiologyStatus(orderId, status),
    onSuccess: invalidate,
  });
};

export const useSubmitRadiologyReport = () => {
  const invalidate = useDiagnosticsInvalidation();
  return useMutation({
    mutationFn: ({
      orderId,
      input,
    }: {
      orderId: string;
      input: { findings: string; impression?: string; recommendation?: string };
    }) => diagnosticsApi.submitRadiologyReport(orderId, input),
    onSuccess: invalidate,
  });
};

export const useLogMaintenance = () => {
  const invalidate = useDiagnosticsInvalidation();
  return useMutation({
    mutationFn: ({
      equipmentId,
      input,
    }: {
      equipmentId: string;
      input: { type: string; technician?: string; notes?: string; result?: string; nextDueAt?: string };
    }) => diagnosticsApi.logMaintenance(equipmentId, input),
    onSuccess: invalidate,
  });
};

export const useSetEquipmentStatus = () => {
  const invalidate = useDiagnosticsInvalidation();
  return useMutation({
    mutationFn: ({
      equipmentId,
      input,
    }: {
      equipmentId: string;
      input: { outOfService: boolean; reason?: string };
    }) => diagnosticsApi.setEquipmentStatus(equipmentId, input),
    onSuccess: invalidate,
  });
};
