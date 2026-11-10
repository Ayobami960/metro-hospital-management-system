import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap } from "@/services/api/response";

/** Contracts mirror `server/src/services/report.service.ts`. */

export interface ReportsOverview {
  kpis: {
    revenueThisMonthMinor: number;
    revenueChangePercent: number | null;
    billedThisMonthMinor: number;
    collectedThisMonthMinor: number;
    collectionRatePercent: number | null;
    satisfaction: number;
    bedOccupancyPercent: number;
    occupiedBeds: number;
    totalBeds: number;
    avgLengthOfStayDays: number;
    readmissionRatePercent: number | null;
    appointmentsLast30: number;
    completedLast30: number;
    noShowLast30: number;
    openClaims: number;
    deniedClaims: number;
    pendingLabOrders: number;
  };
  generatedAt: string;
}

export interface DoctorAnalytics {
  range: { days: number };
  appointmentsPerDay: Array<{ date: string; appointments: number; completed: number }>;
  satisfactionTrend: Array<{ month: string; key: string; rating: number; responses: number }>;
  appointmentTypeDistribution: Array<{ type: string; total: number }>;
  topDiagnoses: Array<{ name: string; value: number }>;
  totals: {
    appointments: number;
    completed: number;
    cancellations: number;
    noShows: number;
    uniquePatients: number;
  };
  generatedAt: string;
}

/**
 * Financial, clinical, operational and staff reports return several named
 * aggregate blocks. Typed per screen where the page renders them.
 */
export interface FinancialReport {
  range: { days: number };
  revenueSeries: Array<{ month: string; key: string; collectedMinor: number; refundedMinor: number }>;
  departmentRevenue: Array<{
    department: string;
    billedMinor: number;
    collectedMinor: number;
    invoiceCount: number;
  }>;
  payerMix: Array<{ method: string; amountMinor: number; payments: number }>;
  receivableAging: Array<{ bucket: string; amountMinor: number; invoices: number }>;
  outstandingMinor: number;
  refundedMinor: number;
  generatedAt: string;
}

/** One downloadable export the caller is allowed to fetch. */
export interface ReportCatalogueEntry {
  id: string;
  name: string;
  category: string;
  endpoint: string;
  format: string;
}

export type ReportDocument = Record<string, unknown>;

export const reportApi = {
  overview: async (): Promise<ReportsOverview> => {
    const response = await apiClient.get<ReportsOverview>(API_ENDPOINTS.reports.overview);
    return unwrap(response.data);
  },

  financial: async (days?: number): Promise<FinancialReport> => {
    const response = await apiClient.get<FinancialReport>(API_ENDPOINTS.reports.financial, {
      params: { days },
    });
    return unwrap(response.data);
  },

  clinical: async (days?: number): Promise<ReportDocument> => {
    const response = await apiClient.get<ReportDocument>(API_ENDPOINTS.reports.clinical, {
      params: { days },
    });
    return unwrap(response.data);
  },

  operational: async (days?: number): Promise<ReportDocument> => {
    const response = await apiClient.get<ReportDocument>(API_ENDPOINTS.reports.operational, {
      params: { days },
    });
    return unwrap(response.data);
  },

  staff: async (days?: number): Promise<ReportDocument> => {
    const response = await apiClient.get<ReportDocument>(API_ENDPOINTS.reports.staff, {
      params: { days },
    });
    return unwrap(response.data);
  },

  catalogue: async (): Promise<ReportCatalogueEntry[]> => {
    const response = await apiClient.get<ReportCatalogueEntry[]>(API_ENDPOINTS.reports.catalogue);
    return unwrap(response.data);
  },

  doctorAnalytics: async (days?: number): Promise<DoctorAnalytics> => {
    const response = await apiClient.get<DoctorAnalytics>(
      API_ENDPOINTS.reports.doctorAnalytics,
      { params: { days } },
    );
    return unwrap(response.data);
  },
};
