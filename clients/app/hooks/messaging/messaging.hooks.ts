import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { messagingApi } from "@/services/messaging/messaging.api";
import { queryKeys } from "@/lib/query-keys";

export const useConversations = () =>
  useQuery({
    queryKey: queryKeys.messaging.conversations,
    queryFn: messagingApi.conversations,
    refetchInterval: 60_000,
  });

export const useConversationMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: queryKeys.messaging.messages(conversationId ?? ""),
    queryFn: () => messagingApi.messages(conversationId as string),
    enabled: Boolean(conversationId),
    refetchInterval: 30_000,
  });

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      messagingApi.send(conversationId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all }),
  });
};

export const useStartConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      participantIds: string[];
      subject?: string;
      patientId?: string;
      type?: string;
    }) => messagingApi.startConversation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all }),
  });
};

export const useMessagingDirectory = () =>
  useQuery({
    queryKey: queryKeys.messaging.directory,
    queryFn: messagingApi.directory,
    staleTime: 5 * 60_000,
  });

export const useUnreadMessages = () =>
  useQuery({
    queryKey: queryKeys.messaging.unread,
    queryFn: messagingApi.unread,
    refetchInterval: 60_000,
  });

export const useNotifications = (
  params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.messaging.notifications(params),
    queryFn: () => messagingApi.notifications(params),
    refetchInterval: 60_000,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => messagingApi.markRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messagingApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.messaging.all }),
  });
};
