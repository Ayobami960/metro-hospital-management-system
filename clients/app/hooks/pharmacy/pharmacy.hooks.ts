import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { pharmacyApi, type DispenseInput } from "@/services/pharmacy/pharmacy.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const usePharmacyOrders = (
  params: ListParams & { status?: string; priority?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.pharmacy.orders(params),
    queryFn: () => pharmacyApi.orders(params),
  });

export const useDispenseVerification = (orderId: string | null) =>
  useQuery({
    queryKey: queryKeys.pharmacy.verify(orderId ?? ""),
    queryFn: () => pharmacyApi.verify(orderId as string),
    enabled: Boolean(orderId),
  });

export const useInventory = (
  params: ListParams & { category?: string; derivedStatus?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.pharmacy.inventory(params),
    queryFn: () => pharmacyApi.inventory(params),
  });

export const useInventoryAlerts = () =>
  useQuery({ queryKey: queryKeys.pharmacy.alerts, queryFn: pharmacyApi.inventoryAlerts });

export const useDrugBatches = (drugId: string | null) =>
  useQuery({
    queryKey: queryKeys.pharmacy.batches(drugId ?? ""),
    queryFn: () => pharmacyApi.batches(drugId as string),
    enabled: Boolean(drugId),
  });

export const useDispenseLog = (params: ListParams = {}) =>
  useQuery({
    queryKey: queryKeys.pharmacy.dispenseLog(params),
    queryFn: () => pharmacyApi.dispenseLog(params),
  });

export const usePurchaseOrders = (params: ListParams & { status?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.pharmacy.purchaseOrders(params),
    queryFn: () => pharmacyApi.purchaseOrders(params),
  });

export const usePharmacyDashboard = () =>
  useQuery({ queryKey: queryKeys.pharmacy.dashboard, queryFn: pharmacyApi.dashboard });

const usePharmacyInvalidation = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.pharmacy.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.admin });
  };
};

export const useProcessOrder = () => {
  const invalidate = usePharmacyInvalidation();
  return useMutation({ mutationFn: (orderId: string) => pharmacyApi.process(orderId), onSuccess: invalidate });
};

export const useMarkOrderReady = () => {
  const invalidate = usePharmacyInvalidation();
  return useMutation({ mutationFn: (orderId: string) => pharmacyApi.ready(orderId), onSuccess: invalidate });
};

export const useDispenseOrder = () => {
  const invalidate = usePharmacyInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: DispenseInput }) =>
      pharmacyApi.dispense(orderId, input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.clinical.all });
    },
  });
};

export const useReceiveStock = () => {
  const invalidate = usePharmacyInvalidation();
  return useMutation({ mutationFn: pharmacyApi.receiveStock, onSuccess: invalidate });
};

export const useAdjustStock = () => {
  const invalidate = usePharmacyInvalidation();
  return useMutation({ mutationFn: pharmacyApi.adjustStock, onSuccess: invalidate });
};

export const useUpdateInventoryItem = () => {
  const invalidate = usePharmacyInvalidation();
  return useMutation({
    mutationFn: ({
      drugId,
      input,
    }: {
      drugId: string;
      input: { reorderLevel: number; location?: string };
    }) => pharmacyApi.updateInventoryItem(drugId, input),
    onSuccess: invalidate,
  });
};

export const usePurchaseOrderActions = () => {
  const invalidate = usePharmacyInvalidation();
  return {
    create: useMutation({ mutationFn: pharmacyApi.createPurchaseOrder, onSuccess: invalidate }),
    submit: useMutation({ mutationFn: pharmacyApi.submitPurchaseOrder, onSuccess: invalidate }),
    ship: useMutation({ mutationFn: pharmacyApi.shipPurchaseOrder, onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: pharmacyApi.cancelPurchaseOrder, onSuccess: invalidate }),
  };
};
