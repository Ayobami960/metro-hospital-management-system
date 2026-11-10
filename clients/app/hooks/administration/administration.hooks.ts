import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  administrationApi,
  type CreateDepartmentInput,
  type CreateDoctorInput,
  type CreateRoomInput,
  type UpdateDoctorInput,
} from "@/services/administration/administration.api";
import { queryKeys } from "@/lib/query-keys";
import type { ListParams } from "@/types/api.types";

export const useDepartments = (params: ListParams = {}) =>
  useQuery({
    queryKey: queryKeys.administration.departments(params),
    queryFn: () => administrationApi.departments(params),
  });

export const useDepartment = (departmentId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.administration.department(departmentId ?? ""),
    queryFn: () => administrationApi.department(departmentId as string),
    enabled: Boolean(departmentId),
  });

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => administrationApi.createDepartment(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.administration.all }),
  });
};

export const useUpdateDepartment = (departmentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateDepartmentInput>) =>
      administrationApi.updateDepartment(departmentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.administration.all }),
  });
};

export const useSpecialties = (params: ListParams = {}) =>
  useQuery({
    queryKey: queryKeys.administration.specialties(params),
    queryFn: () => administrationApi.specialties(params),
  });

export const useDoctors = (
  params: ListParams & { specialtyId?: string; departmentId?: string; status?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.administration.doctors(params),
    queryFn: () => administrationApi.doctors(params),
  });

export const useDoctor = (doctorId: string | null | undefined) =>
  useQuery({
    queryKey: queryKeys.administration.doctor(doctorId ?? ""),
    queryFn: () => administrationApi.doctor(doctorId as string),
    enabled: Boolean(doctorId),
  });

export const useCreateDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDoctorInput) => administrationApi.createDoctor(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.administration.all }),
  });
};

export const useUpdateDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doctorId, input }: { doctorId: string; input: UpdateDoctorInput }) =>
      administrationApi.updateDoctor(doctorId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.administration.all }),
  });
};

export const useRooms = (
  params: ListParams & { floor?: string; type?: string; departmentId?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.administration.rooms(params),
    queryFn: () => administrationApi.rooms(params),
  });

export const useBeds = (
  params: ListParams & { roomId?: string; floor?: string; status?: string } = {},
) =>
  useQuery({
    queryKey: queryKeys.administration.beds(params),
    queryFn: () => administrationApi.beds(params),
  });

export const useCreateRoom = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) => administrationApi.createRoom(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.administration.all }),
  });
};

export const useBedActions = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.administration.all });

  const setStatus = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: Parameters<typeof administrationApi.setBedStatus>[1] }) =>
      administrationApi.setBedStatus(bedId, status),
    onSuccess: invalidate,
  });
  const assign = useMutation({
    mutationFn: ({ bedId, patientId }: { bedId: string; patientId: string }) =>
      administrationApi.assignBed(bedId, patientId),
    onSuccess: invalidate,
  });
  const release = useMutation({
    mutationFn: ({ bedId, reason }: { bedId: string; reason?: string }) =>
      administrationApi.releaseBed(bedId, reason),
    onSuccess: invalidate,
  });

  return { setStatus, assign, release };
};

export const useDirectoryUsers = (params: ListParams & { role?: string; status?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.administration.users(params),
    queryFn: () => administrationApi.users(params),
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: administrationApi.createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.administration.users() }),
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      input,
    }: {
      userId: string;
      input: { name?: string; phone?: string; status?: string; role?: string };
    }) => administrationApi.updateUser(userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.administration.all }),
  });
};

export const useReferenceDepartments = () =>
  useQuery({
    queryKey: queryKeys.reference.departments,
    queryFn: administrationApi.referenceDepartments,
    staleTime: 10 * 60_000,
  });

export const useReferenceSpecialties = () =>
  useQuery({
    queryKey: queryKeys.reference.specialties,
    queryFn: administrationApi.referenceSpecialties,
    staleTime: 10 * 60_000,
  });

export const useInsurers = () =>
  useQuery({
    queryKey: queryKeys.reference.insurers,
    queryFn: administrationApi.insurers,
    staleTime: 10 * 60_000,
  });

export const useInsurancePlans = (insurerId?: string) =>
  useQuery({
    queryKey: queryKeys.reference.plans(insurerId),
    queryFn: () => administrationApi.insurancePlans(insurerId),
    staleTime: 10 * 60_000,
  });
