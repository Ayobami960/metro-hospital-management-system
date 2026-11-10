import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { schedulingApi, type AvailabilityWindow } from "@/services/scheduling/scheduling.api";
import { queryKeys } from "@/lib/query-keys";

export const useSchedulableDoctors = () =>
  useQuery({
    queryKey: queryKeys.scheduling.doctors,
    queryFn: schedulingApi.doctors,
    staleTime: 5 * 60_000,
  });

export const useScheduleBoard = (doctorId: string | null, from: string) =>
  useQuery({
    queryKey: queryKeys.scheduling.board(doctorId ?? "", from),
    queryFn: () => schedulingApi.board(doctorId as string, from),
    enabled: Boolean(doctorId && from),
  });

export const useDoctorAvailability = (doctorId: string | null) =>
  useQuery({
    queryKey: queryKeys.scheduling.availability(doctorId ?? ""),
    queryFn: () => schedulingApi.availability(doctorId as string),
    enabled: Boolean(doctorId),
  });

export const useTimeOff = (doctorId?: string) =>
  useQuery({
    queryKey: queryKeys.scheduling.timeOff(doctorId),
    queryFn: () => schedulingApi.timeOff(doctorId),
  });

const useSchedulingInvalidation = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.all });
};

export const useSetAvailability = () => {
  const invalidate = useSchedulingInvalidation();
  return useMutation({
    mutationFn: (windows: AvailabilityWindow[]) => schedulingApi.setAvailability(windows),
    onSuccess: invalidate,
  });
};

export const useAddTimeOff = () => {
  const invalidate = useSchedulingInvalidation();
  return useMutation({
    mutationFn: (input: { startsAt: string; endsAt: string; reason?: string }) =>
      schedulingApi.addTimeOff(input),
    onSuccess: invalidate,
  });
};

export const useRemoveTimeOff = () => {
  const invalidate = useSchedulingInvalidation();
  return useMutation({
    mutationFn: (entryId: string) => schedulingApi.removeTimeOff(entryId),
    onSuccess: invalidate,
  });
};
