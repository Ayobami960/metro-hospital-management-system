import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  appointmentApi,
  type AppointmentListParams,
  type CreateAppointmentInput,
} from "@/services/appointments/appointment.api";
import { queryKeys } from "@/lib/query-keys";

export const useAppointments = (params: AppointmentListParams = {}) =>
  useQuery({
    queryKey: queryKeys.appointments.list(params),
    queryFn: () => appointmentApi.list(params),
  });

export const useAppointmentAvailability = (doctorId: string | null, date: string) =>
  useQuery({
    queryKey: queryKeys.appointments.availability(doctorId ?? "", date),
    queryFn: () => appointmentApi.availability(doctorId as string, date),
    enabled: Boolean(doctorId && date),
  });

const useAppointmentMutation = <TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.doctor });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.reception });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.patient });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.admin });
    },
  });
};

export const useCreateAppointment = () =>
  useAppointmentMutation((input: CreateAppointmentInput) => appointmentApi.create(input));

export const useApproveAppointment = () =>
  useAppointmentMutation((appointmentId: string) => appointmentApi.approve(appointmentId));

export const useCancelAppointment = () =>
  useAppointmentMutation(({ appointmentId, reason }: { appointmentId: string; reason?: string }) =>
    appointmentApi.cancel(appointmentId, reason),
  );
