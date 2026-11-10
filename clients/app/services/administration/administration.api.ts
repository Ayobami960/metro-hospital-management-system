import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ApiEnvelope, ListParams, PageMeta, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/admin.service.ts` and `directory.service.ts`. */

export type StaffStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE";
export type RoomType = "STANDARD" | "PRIVATE" | "ICU" | "EMERGENCY" | "ISOLATION";
export type BedStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "CLEANING";

export interface Department {
  id: string;
  name: string;
  code: string | null;
  floor: string | null;
  location: string | null;
  bedCapacity: number;
  headDoctorId: string | null;
  head: string | null;
  staffCount: number;
  bedCount: number;
  bedsOccupied: number;
  bedsMaintenance: number;
  roomsCount: number;
  occupancyPercent: number;
  status: "Operational" | "High Volume" | "Under Maintenance";
  createdAt: string;
}

export interface DepartmentDetail extends Department {
  doctors: Array<{ id: string; name: string; specialty: string | null; status: StaffStatus }>;
  rooms: Array<{ id: string; number: string; type: RoomType; floor: string }>;
}

export interface Specialty {
  id: string;
  name: string;
  description: string | null;
  doctors: number;
}

export interface Doctor {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  accountStatus: string;
  specialtyId: string | null;
  specialty: string | null;
  departmentId: string | null;
  department: string | null;
  license: string;
  licenseExpiry: string | null;
  status: StaffStatus;
  credentials: string | null;
  bio: string | null;
  consultationFeeMinor: number;
  ratingAvg: string | number | null;
  ratingCount: number;
  createdAt: string;
  patients: number;
}

export interface CreateDoctorInput {
  name: string;
  email: string;
  phone?: string;
  licenseNumber: string;
  licenseExpiry?: string;
  departmentId?: string;
  specialtyId?: string;
  consultationFeeMinor?: number;
  credentials?: string;
  bio?: string;
}

export interface UpdateDoctorInput extends Partial<Omit<CreateDoctorInput, "email">> {
  status?: StaffStatus;
}

export interface RoomOccupant {
  patientId: string;
  name: string;
  mrn: string;
  bedId: string;
  label: string;
}

export interface Room {
  id: string;
  number: string;
  floor: string;
  type: RoomType;
  departmentId: string | null;
  department: string | null;
  beds: number;
  occupied: number;
  available: number;
  status: "Available" | "Occupied" | "Maintenance" | "Reserved";
  patients: RoomOccupant[];
  patient: string | null;
}

export interface RoomSummary {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  maintenanceBeds: number;
  reservedBeds: number;
  occupancyRate: number;
}

export interface RoomListResult extends Paginated<Room> {
  meta: PageMeta;
  summary: RoomSummary;
}

export interface Bed {
  id: string;
  label: string;
  status: BedStatus;
  roomId: string;
  roomNumber: string;
  floor: string;
  roomType: RoomType;
  patientId: string | null;
  patientName: string | null;
  mrn: string | null;
  assignedAt: string | null;
}

export interface CreateRoomInput {
  number: string;
  floor: string;
  type?: RoomType;
  departmentId?: string;
  bedCount?: number;
  bedLabels?: string[];
}

export interface CreateDepartmentInput {
  name: string;
  code?: string;
  floor?: string;
  location?: string;
  headDoctorId?: string;
  bedCapacity?: number;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  image: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  doctorId: string | null;
  licenseNumber: string | null;
  department: string | null;
  specialty: string | null;
  title: string | null;
  employeeId: string | null;
  avatarInitials: string;
}

export interface ReferenceOption {
  id: string;
  name: string;
  [key: string]: unknown;
}

export const administrationApi = {
  departments: async (params: ListParams = {}): Promise<Paginated<Department>> => {
    const response = await apiClient.get<Department[]>(API_ENDPOINTS.administration.departments, {
      params,
    });
    return unwrapPage(response.data);
  },

  department: async (departmentId: string): Promise<DepartmentDetail> => {
    const response = await apiClient.get<DepartmentDetail>(
      API_ENDPOINTS.administration.department(departmentId),
    );
    return unwrap(response.data);
  },

  createDepartment: async (input: CreateDepartmentInput): Promise<{ id: string; name: string }> => {
    const response = await apiClient.post<{ id: string; name: string }>(
      API_ENDPOINTS.administration.departments,
      input,
    );
    return unwrap(response.data);
  },

  updateDepartment: async (
    departmentId: string,
    input: Partial<CreateDepartmentInput>,
  ): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.administration.department(departmentId), input);
  },

  specialties: async (params: ListParams = {}): Promise<Paginated<Specialty>> => {
    const response = await apiClient.get<Specialty[]>(API_ENDPOINTS.administration.specialties, {
      params,
    });
    return unwrapPage(response.data);
  },

  doctors: async (
    params: ListParams & { specialtyId?: string; departmentId?: string; status?: string } = {},
  ): Promise<Paginated<Doctor>> => {
    const response = await apiClient.get<Doctor[]>(API_ENDPOINTS.administration.doctors, { params });
    return unwrapPage(response.data);
  },

  doctor: async (doctorId: string): Promise<Doctor> => {
    const response = await apiClient.get<Doctor>(API_ENDPOINTS.administration.doctor(doctorId));
    return unwrap(response.data);
  },

  createDoctor: async (input: CreateDoctorInput): Promise<Doctor> => {
    const response = await apiClient.post<Doctor>(API_ENDPOINTS.administration.doctors, input);
    return unwrap(response.data);
  },

  updateDoctor: async (doctorId: string, input: UpdateDoctorInput): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.administration.doctor(doctorId), input);
  },

  rooms: async (
    params: ListParams & { floor?: string; type?: string; departmentId?: string } = {},
  ): Promise<RoomListResult> => {
    const response = await apiClient.get<Room[]>(API_ENDPOINTS.administration.rooms, { params });
    const envelope = response.data as unknown as ApiEnvelope<Room[]>;
    const page = unwrapPage(envelope);
    const summary = (envelope.meta?.summary as RoomSummary | undefined) ?? {
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
      maintenanceBeds: 0,
      reservedBeds: 0,
      occupancyRate: 0,
    };
    return { ...page, summary };
  },

  createRoom: async (input: CreateRoomInput): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.administration.rooms, input);
  },

  updateRoom: async (roomId: string, input: Partial<CreateRoomInput>): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.administration.room(roomId), input);
  },

  addBed: async (roomId: string, label: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.administration.roomBeds(roomId), { label });
  },

  beds: async (
    params: ListParams & { roomId?: string; floor?: string; status?: string } = {},
  ): Promise<Paginated<Bed>> => {
    const response = await apiClient.get<Bed[]>(API_ENDPOINTS.administration.beds, { params });
    return unwrapPage(response.data);
  },

  setBedStatus: async (bedId: string, status: BedStatus): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.administration.bed(bedId), { status });
  },

  assignBed: async (bedId: string, patientId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.administration.assignBed(bedId), { patientId });
  },

  releaseBed: async (bedId: string, reason?: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.administration.releaseBed(bedId), { reason });
  },

  users: async (params: ListParams & { role?: string; status?: string } = {}): Promise<
    Paginated<DirectoryUser>
  > => {
    const response = await apiClient.get<DirectoryUser[]>(API_ENDPOINTS.administration.users, {
      params,
    });
    return unwrapPage(response.data);
  },

  createUser: async (input: {
    name: string;
    email: string;
    role: string;
    phone?: string;
    title?: string;
    employeeId?: string;
  }): Promise<DirectoryUser> => {
    const response = await apiClient.post<DirectoryUser>(
      API_ENDPOINTS.administration.users,
      input,
    );
    return unwrap(response.data);
  },

  updateUser: async (
    userId: string,
    input: { name?: string; phone?: string; status?: string; role?: string },
  ): Promise<void> => {
    await apiClient.patch(API_ENDPOINTS.administration.user(userId), input);
  },

  referenceDepartments: async (): Promise<ReferenceOption[]> => {
    const response = await apiClient.get<ReferenceOption[]>(API_ENDPOINTS.reference.departments);
    return unwrap(response.data);
  },

  referenceSpecialties: async (): Promise<ReferenceOption[]> => {
    const response = await apiClient.get<ReferenceOption[]>(API_ENDPOINTS.reference.specialties);
    return unwrap(response.data);
  },

  insurers: async (): Promise<ReferenceOption[]> => {
    const response = await apiClient.get<ReferenceOption[]>(API_ENDPOINTS.reference.insurers);
    return unwrap(response.data);
  },

  insurancePlans: async (insurerId?: string): Promise<ReferenceOption[]> => {
    const response = await apiClient.get<ReferenceOption[]>(API_ENDPOINTS.reference.insurancePlans, {
      params: { insurerId },
    });
    return unwrap(response.data);
  },

  cptCodes: async (search?: string): Promise<ReferenceOption[]> => {
    const response = await apiClient.get<ReferenceOption[]>(API_ENDPOINTS.reference.cpt, {
      params: { search },
    });
    return unwrap(response.data);
  },
};
