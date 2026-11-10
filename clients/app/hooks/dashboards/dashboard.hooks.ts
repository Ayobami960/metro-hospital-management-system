import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "@/services/dashboards/dashboard.api";
import { queryKeys } from "@/lib/query-keys";

/** Dashboards are aggregate views; poll gently so figures stay current. */
const DASHBOARD_OPTIONS = { staleTime: 30_000, refetchInterval: 60_000 } as const;

export const useAdminDashboard = () =>
  useQuery({ queryKey: queryKeys.dashboards.admin, queryFn: dashboardApi.admin, ...DASHBOARD_OPTIONS });

export const useDoctorDashboard = () =>
  useQuery({ queryKey: queryKeys.dashboards.doctor, queryFn: dashboardApi.doctor, ...DASHBOARD_OPTIONS });

export const useNurseDashboard = () =>
  useQuery({ queryKey: queryKeys.dashboards.nurse, queryFn: dashboardApi.nurse, ...DASHBOARD_OPTIONS });

export const usePatientDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboards.patient,
    queryFn: dashboardApi.patient,
    ...DASHBOARD_OPTIONS,
  });

export const useReceptionDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboards.reception,
    queryFn: dashboardApi.reception,
    ...DASHBOARD_OPTIONS,
  });

export const useSystemHealth = () =>
  useQuery({
    queryKey: queryKeys.dashboards.health,
    queryFn: dashboardApi.systemHealth,
    staleTime: 60_000,
  });
