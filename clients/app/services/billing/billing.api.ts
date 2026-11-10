import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ListParams, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/billing.service.ts`. Money is minor units. */

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID" | "OVERDUE";
export type PaymentMethod = "CASH" | "CHECK" | "CARD" | "INSURANCE" | "TRANSFER";
export type ClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PARTIALLY_APPROVED"
  | "DENIED"
  | "APPEALED";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  overdue: boolean;
  notes: string | null;
  itemCount: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  serviceDate: string | null;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
  allocations: Array<{ id: string; paymentId: string; amountMinor: number; createdAt: string }>;
  claims: Claim[];
}

export interface Payment {
  id: string;
  paymentNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  kind: string;
  status: string;
  provider: string;
  receivedAt: string;
  receivedBy: string | null;
  reference: string | null;
  reversesPaymentId: string | null;
  allocatedMinor: number;
}

export interface Claim {
  id: string;
  claimNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  insurerId: string;
  insurer: string;
  status: ClaimStatus;
  claimedMinor: number;
  approvedMinor: number | null;
  submittedAt: string | null;
  decidedAt: string | null;
  denialReason: string | null;
  appealDeadline: string | null;
}

export interface OutstandingRow {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  status: InvoiceStatus;
  dueAt: string;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  daysOverdue: number;
}

/** Ageing summary returned in the `meta.buckets` block of the outstanding list. */
export interface AgingBuckets {
  current: number;
  d1to30: number;
  d31to60: number;
  d61to90: number;
  over90: number;
  total: number;
}

export interface OutstandingPage extends Paginated<OutstandingRow> {
  buckets: AgingBuckets;
}

export interface BillingDashboard {
  stats: {
    collectedTodayMinor: number;
    outstandingMinor: number;
    overdueMinor: number;
    claimsPending: number;
    invoicedThisMonthMinor: number;
    collectedThisMonthMinor: number;
  };
  recentPayments: Array<{
    id: string;
    paymentNumber: string;
    patientName: string;
    amountMinor: number;
    method: PaymentMethod;
    kind: string;
    receivedAt: string;
  }>;
  revenueSeries: Array<{ day: string; amountMinor: number }>;
}

export interface BillingReports {
  range: { from: string; to: string };
  revenueByDay: Array<{ day: string; amountMinor: number; count: number }>;
  revenueByMethod: Array<{ method: PaymentMethod; amountMinor: number; count: number }>;
  claimOutcomes: Array<{ status: ClaimStatus; count: number; claimedMinor: number; approvedMinor: number }>;
  ageing: { current: number; d1to30: number; d31to60: number; d61to90: number; over90: number };
  collectedMinor: number;
}

export interface CreateInvoiceInput {
  patientId: string;
  encounterId?: string;
  dueAt?: string;
  taxMinor?: number;
  notes?: string;
  items: Array<{
    description: string;
    cptId?: string;
    quantity?: number;
    unitPriceMinor: number;
    serviceDate?: string;
  }>;
}

export interface RecordPaymentInput {
  patientId?: string;
  amountMinor: number;
  method: PaymentMethod;
  reference?: string;
  provider?: string;
  providerRef?: string;
  notes?: string;
  allocations?: Array<{ invoiceId: string; amountMinor: number }>;
}

const EMPTY_BUCKETS: AgingBuckets = { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0 };

/** The ageing summary arrives as an untyped `meta.buckets` JSON block. */
const readAgingBuckets = (value: unknown): AgingBuckets => {
  if (!value || typeof value !== "object") return EMPTY_BUCKETS;
  const candidate = value as Record<string, unknown>;
  const pick = (key: keyof AgingBuckets): number => {
    const entry = candidate[key];
    return typeof entry === "number" && Number.isFinite(entry) ? entry : 0;
  };
  return {
    current: pick("current"),
    d1to30: pick("d1to30"),
    d31to60: pick("d31to60"),
    d61to90: pick("d61to90"),
    over90: pick("over90"),
    total: pick("total"),
  };
};

export const billingApi = {
  invoices: async (
    params: ListParams & { status?: string; patientId?: string; from?: string; to?: string } = {},
  ): Promise<Paginated<Invoice>> => {
    const response = await apiClient.get<Invoice[]>(API_ENDPOINTS.billing.invoices, { params });
    return unwrapPage(response.data);
  },

  invoice: async (invoiceId: string): Promise<InvoiceDetail> => {
    const response = await apiClient.get<InvoiceDetail>(API_ENDPOINTS.billing.invoice(invoiceId));
    return unwrap(response.data);
  },

  createInvoice: async (input: CreateInvoiceInput): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>(API_ENDPOINTS.billing.invoices, input);
    return unwrap(response.data);
  },

  voidInvoice: async (invoiceId: string, reason: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.billing.voidInvoice(invoiceId), { reason });
  },

  payments: async (
    params: ListParams & { method?: string; kind?: string; patientId?: string } = {},
  ): Promise<Paginated<Payment>> => {
    const response = await apiClient.get<Payment[]>(API_ENDPOINTS.billing.payments, { params });
    return unwrapPage(response.data);
  },

  recordPayment: async (input: RecordPaymentInput): Promise<Payment> => {
    const response = await apiClient.post<Payment>(API_ENDPOINTS.billing.payments, input);
    return unwrap(response.data);
  },

  refund: async (
    paymentId: string,
    input: { amountMinor: number; reason: string },
  ): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.billing.refund(paymentId), input);
  },

  outstanding: async (params: ListParams = {}): Promise<OutstandingPage> => {
    const response = await apiClient.get<OutstandingRow[]>(API_ENDPOINTS.billing.outstanding, {
      params,
    });
    const page = unwrapPage(response.data);
    return { ...page, buckets: readAgingBuckets(page.meta.buckets) };
  },

  claims: async (
    params: ListParams & { status?: string; insurerId?: string } = {},
  ): Promise<Paginated<Claim>> => {
    const response = await apiClient.get<Claim[]>(API_ENDPOINTS.billing.claims, { params });
    return unwrapPage(response.data);
  },

  createClaim: async (input: {
    invoiceId: string;
    insurerId: string;
    planId?: string;
    claimedMinor: number;
  }): Promise<Claim> => {
    const response = await apiClient.post<Claim>(API_ENDPOINTS.billing.claims, input);
    return unwrap(response.data);
  },

  updateClaim: async (
    claimId: string,
    input: { status: ClaimStatus; approvedMinor?: number; denialReason?: string; externalRef?: string },
  ): Promise<Claim> => {
    const response = await apiClient.patch<Claim>(API_ENDPOINTS.billing.claim(claimId), input);
    return unwrap(response.data);
  },

  dashboard: async (): Promise<BillingDashboard> => {
    const response = await apiClient.get<BillingDashboard>(API_ENDPOINTS.billing.dashboard);
    return unwrap(response.data);
  },

  reports: async (from?: string, to?: string): Promise<BillingReports> => {
    const response = await apiClient.get<BillingReports>(API_ENDPOINTS.billing.reports, {
      params: { from, to },
    });
    return unwrap(response.data);
  },
};
