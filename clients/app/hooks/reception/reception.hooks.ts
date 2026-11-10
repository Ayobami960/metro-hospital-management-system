import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { receptionApi, type AddQueueInput } from "@/services/reception/reception.api";
import { queryKeys } from "@/lib/query-keys";

export const useQueue = (params: { page?: number; pageSize?: number; status?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.reception.queue(params),
    queryFn: () => receptionApi.queue(params),
  });

const useQueueMutation = <TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reception.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.reception });
    },
  });
};

export const useAddToQueue = () =>
  useQueueMutation((input: AddQueueInput) => receptionApi.addToQueue(input));

export const useCallNextPatient = () =>
  useQueueMutation((doctorId?: string) => receptionApi.callNext(doctorId));

export const useStartQueueEntry = () =>
  useQueueMutation((queueId: string) => receptionApi.start(queueId));

export const useCompleteQueueEntry = () =>
  useQueueMutation((queueId: string) => receptionApi.complete(queueId));

export const useRemoveQueueEntry = () =>
  useQueueMutation((queueId: string) => receptionApi.remove(queueId));
