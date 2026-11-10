import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap } from "@/services/api/response";

/** Contracts mirror `server/src/services/profile.service.ts`. */

export interface DoctorProfile {
  id: string;
  licenseNumber: string;
  licenseExpiry: string | null;
  credentials: string | null;
  bio: string | null;
  status: string;
  department: string | null;
  specialty: string | null;
  consultationFeeMinor: number;
}

export interface PatientProfile {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sexAtBirth: string;
  bloodType: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  [key: string]: unknown;
}

export interface MyProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  image: string | null;
  avatarInitials: string;
  doctor: DoctorProfile | null;
  patient: PatientProfile | null;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  appointmentReminders: boolean;
  labResults: boolean;
  billingAlerts: boolean;
  marketing: boolean;
  [key: string]: unknown;
}

export interface UserSession {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface HospitalSettings {
  id: number;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
  mrnPrefix: string;
  invoiceDueDays: number;
  nearExpiryDays: number;
  auditRetentionYears: number;
  settings: Record<string, unknown>;
}

export const profileApi = {
  me: async (): Promise<MyProfile> => {
    const response = await apiClient.get<MyProfile>(API_ENDPOINTS.profile.profile);
    return unwrap(response.data);
  },

  update: async (input: { name?: string; phone?: string | null; image?: string | null }): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.profile.profile, input);
  },

  preferences: async (): Promise<NotificationPreferences> => {
    const response = await apiClient.get<NotificationPreferences>(
      API_ENDPOINTS.profile.preferences,
    );
    return unwrap(response.data);
  },

  updatePreferences: async (
    input: Partial<Omit<NotificationPreferences, "id" | "userId">>,
  ): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.profile.preferences, input);
  },

  sessions: async (): Promise<UserSession[]> => {
    const response = await apiClient.get<UserSession[]>(API_ENDPOINTS.profile.sessions);
    return unwrap(response.data);
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.profile.session(sessionId));
  },

  revokeOtherSessions: async (): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.profile.sessions);
  },

  hospital: async (): Promise<HospitalSettings> => {
    const response = await apiClient.get<HospitalSettings>(API_ENDPOINTS.profile.hospital);
    return unwrap(response.data);
  },

  updateHospital: async (input: Partial<HospitalSettings>): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.profile.hospital, input);
  },
};
