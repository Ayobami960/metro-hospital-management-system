import { useQuery } from "@tanstack/react-query";

import { reportApi } from "@/services/reports/report.api";
import { queryKeys } from "@/lib/query-keys";

export const useReportsOverview = () =>
  useQuery({ queryKey: queryKeys.reports.overview, queryFn: reportApi.overview });

export const useFinancialReport = (days?: number) =>
  useQuery({
    queryKey: queryKeys.reports.financial(days),
    queryFn: () => reportApi.financial(days),
  });

export const useClinicalReport = (days?: number) =>
  useQuery({
    queryKey: queryKeys.reports.clinical(days),
    queryFn: () => reportApi.clinical(days),
  });

export const useOperationalReport = (days?: number) =>
  useQuery({
    queryKey: queryKeys.reports.operational(days),
    queryFn: () => reportApi.operational(days),
  });

export const useStaffReport = (days?: number) =>
  useQuery({ queryKey: queryKeys.reports.staff(days), queryFn: () => reportApi.staff(days) });

export const useReportCatalogue = () =>
  useQuery({ queryKey: queryKeys.reports.catalogue, queryFn: reportApi.catalogue });

export const useDoctorAnalytics = (days?: number) =>
  useQuery({
    queryKey: queryKeys.reports.doctorAnalytics(days),
    queryFn: () => reportApi.doctorAnalytics(days),
  });
