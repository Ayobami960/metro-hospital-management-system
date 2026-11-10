import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap } from "@/services/api/response";

/** Contracts mirror `server/src/services/dashboard.service.ts`. */

export interface AdminDashboard {
  stats: {
    totalPatients: number;
    activePatients: number;
    newPatientsThisMonth: number;
    activeDoctors: number;
    doctorsOnLeave: number;
    todayAppointments: number;
    todayConfirmed: number;
    monthRevenueMinor: number;
    revenueChangePercent: number | null;
    bedsAvailable: number;
    bedsTotal: number;
    occupancyPercent: number;
    emergencyCases: number;
    criticalCases: number;
    labTestsToday: number;
    labCompletedToday: number;
    claimsPending: number;
    claimsDenied: number;
  };
  revenueSeries: Array<{ month: string; key: string; revenue: number; expenses: number }>;
  appointmentTrend: Array<{ month: string; key: string; appointments: number }>;
  departmentDistribution: Array<{ dept: string; patients: number }>;
  doctorPerformance: Array<{
    id: string;
    name: string;
    dept: string;
    patients: number;
    rating: number | null;
    revenueMinor: number;
    status: string;
  }>;
  departments: Array<{
    id: string;
    name: string;
    head: string;
    doctors: number;
    beds: number;
    occupied: number;
    status: string;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    module: string;
    entityType: string;
    entityId: string | null;
    level: string;
    detail: unknown;
    createdAt: string;
  }>;
  generatedAt: string;
}

export interface DoctorDashboard {
  stats: {
    todayAppointments: number;
    completedToday: number;
    uniquePatientsToday: number;
    pendingLabOrders: number;
    activePrescriptions: number;
    rating: number | null;
    ratingCount: number;
    monthRevenueMinor: number;
  };
  appointmentSeries: Array<{ day: string; date: string; appointments: number }>;
  diagnosisDistribution: Array<{ name: string; value: number }>;
  todayPatients: Array<{
    appointmentId: string;
    patientId: string;
    name: string;
    mrn: string;
    age: number;
    at: string;
    status: string;
    reason: string | null;
    mode: string;
    priority: string;
  }>;
  pendingRequests: Array<{
    id: string;
    patientId: string;
    patientName: string;
    requestedFor: string;
    status: string;
    reason: string | null;
    mode: string;
  }>;
  recentPrescriptions: Array<{
    id: string;
    patientName: string;
    status: string;
    createdAt: string;
    drugNames: string[];
  }>;
  labOrders: Array<{
    id: string;
    patientName: string;
    status: string;
    priority: string;
    orderedAt: string;
    testNames: string[];
  }>;
  generatedAt: string;
}

export interface NurseDashboard {
  stats: {
    assignedPatients: number;
    medicationsDueToday: number;
    medicationsGivenToday: number;
    vitalsRecordedToday: number;
    criticalPatients: number;
    medicationsOverdue: number;
  };
  medicationSchedule: Array<{
    id: string;
    patientId: string;
    patientName: string;
    drug: string;
    dose: string;
    route: string;
    scheduledFor: string;
    time: string;
    status: string;
    holdReason: string | null;
  }>;
  patients: Array<{
    id: string;
    name: string;
    mrn: string;
    age: number;
    bed: string | null;
    acuity: string;
    admittedAt: string | null;
    allergies: string[];
  }>;
  generatedAt: string;
}

export interface PatientDashboard {
  stats: {
    upcomingAppointments: number;
    activePrescriptions: number;
    releasedLabResults: number;
    outstandingBalanceMinor: number;
    lastVisitAt: string | null;
  };
  upcomingAppointments: Array<{
    id: string;
    at: string;
    doctorName: string;
    specialty: string | null;
    status: string;
    mode: string;
    reason: string | null;
  }>;
  prescriptions: Array<{
    id: string;
    status: string;
    createdAt: string;
    doctorName: string;
    drugNames: string[];
  }>;
  labResults: Array<{
    id: string;
    testName: string;
    releasedAt: string | null;
    flag: string | null;
    valueText: string | null;
    unit: string | null;
  }>;
  bpSeries: Array<{ date: string; systolic: number; diastolic: number }>;
  weightSeries: Array<{ date: string; weight: number }>;
  metrics: Array<{
    type: string;
    recordedAt: string;
    value: number;
    secondaryValue: number | null;
    unit: string | null;
  }>;
  allergies: string[];
  problems: string[];
  careTeam: { doctorName: string | null; specialty: string | null; department: string | null } | null;
  generatedAt: string;
}

export interface ReceptionDashboard {
  stats: {
    inQueue: number;
    waiting: number;
    called: number;
    inProgress: number;
    avgWaitMinutes: number;
    todayAppointments: number;
    checkedIn: number;
    completedToday: number;
    noShowsToday: number;
    registeredToday: number;
  };
  queue: Array<{
    id: string;
    ticketNumber: string;
    patientId: string;
    patientName: string;
    mrn: string;
    priority: string;
    status: string;
    checkInAt: string;
    position: number;
    waitMinutes: number;
  }>;
  todayAppointments: Array<{
    id: string;
    at: string;
    patientName: string;
    mrn: string;
    doctorName: string;
    status: string;
    mode: string;
    reason: string | null;
  }>;
  pendingRequests: Array<{
    id: string;
    patientName: string;
    requestedFor: string;
    doctorName: string;
    mode: string;
    reason: string | null;
  }>;
  generatedAt: string;
}

export const dashboardApi = {
  admin: async (): Promise<AdminDashboard> => {
    const response = await apiClient.get<AdminDashboard>(API_ENDPOINTS.dashboards.admin);
    return unwrap(response.data);
  },

  doctor: async (): Promise<DoctorDashboard> => {
    const response = await apiClient.get<DoctorDashboard>(API_ENDPOINTS.dashboards.doctor);
    return unwrap(response.data);
  },

  nurse: async (): Promise<NurseDashboard> => {
    const response = await apiClient.get<NurseDashboard>(API_ENDPOINTS.dashboards.nurse);
    return unwrap(response.data);
  },

  patient: async (): Promise<PatientDashboard> => {
    const response = await apiClient.get<PatientDashboard>(API_ENDPOINTS.dashboards.patient);
    return unwrap(response.data);
  },

  reception: async (): Promise<ReceptionDashboard> => {
    const response = await apiClient.get<ReceptionDashboard>(API_ENDPOINTS.dashboards.reception);
    return unwrap(response.data);
  },

  operationCounts: async (): Promise<Record<string, number>> => {
    const response = await apiClient.get<Record<string, number>>(
      API_ENDPOINTS.dashboards.operationsCounts,
    );
    return unwrap(response.data);
  },

  systemHealth: async (): Promise<Record<string, unknown>> => {
    const response = await apiClient.get<Record<string, unknown>>(
      API_ENDPOINTS.dashboards.operationsHealth,
    );
    return unwrap(response.data);
  },
};
