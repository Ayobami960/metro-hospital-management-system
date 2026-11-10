import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  billingApi,
  type ClaimStatus,
  type CreateInvoiceInput,
  type RecordPaymentInput,
} from "@/services/billing/billing.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const useInvoices = (
  params: ListParams & { status?: string; patientId?: string; from?: string; to?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.billing.invoices(params),
    queryFn: () => billingApi.invoices(params),
  });

export const useInvoice = (invoiceId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.billing.invoice(invoiceId ?? ""),
    queryFn: () => billingApi.invoice(invoiceId as string),
    enabled: Boolean(invoiceId),
  });

export const usePayments = (
  params: ListParams & { method?: string; kind?: string; patientId?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.billing.payments(params),
    queryFn: () => billingApi.payments(params),
  });

export const useOutstanding = (params: ListParams = {}) =>
  useQuery({
    queryKey: queryKeys.billing.outstanding(params),
    queryFn: () => billingApi.outstanding(params),
  });

export const useClaims = (params: ListParams & { status?: string; insurerId?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.billing.claims(params),
    queryFn: () => billingApi.claims(params),
  });

export const useBillingDashboard = () =>
  useQuery({ queryKey: queryKeys.billing.dashboard, queryFn: billingApi.dashboard });

export const useBillingReports = (from?: string, to?: string) =>
  useQuery({
    queryKey: queryKeys.billing.reports(from, to),
    queryFn: () => billingApi.reports(from, to),
  });

const useBillingInvalidation = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.admin });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.patient });
  };
};

export const useCreateInvoice = () => {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => billingApi.createInvoice(input),
    onSuccess: invalidate,
  });
};

export const useVoidInvoice = () => {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      billingApi.voidInvoice(invoiceId, reason),
    onSuccess: invalidate,
  });
};

export const useRecordPayment = () => {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) => billingApi.recordPayment(input),
    onSuccess: invalidate,
  });
};

export const useRefundPayment = () => {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({
      paymentId,
      input,
    }: {
      paymentId: string;
      input: { amountMinor: number; reason: string };
    }) => billingApi.refund(paymentId, input),
    onSuccess: invalidate,
  });
};

export const useCreateClaim = () => {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (input: { invoiceId: string; insurerId: string; planId?: string; claimedMinor: number }) =>
      billingApi.createClaim(input),
    onSuccess: invalidate,
  });
};

export const useUpdateClaim = () => {
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({
      claimId,
      input,
    }: {
      claimId: string;
      input: {
        status: ClaimStatus;
        approvedMinor?: number;
        denialReason?: string;
        externalRef?: string;
      };
    }) => billingApi.updateClaim(claimId, input),
    onSuccess: invalidate,
  });
};
