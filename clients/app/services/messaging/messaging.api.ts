import { apiClient } from "@/services/api/client";
import { API_ENDPOINTS } from "@/services/api/endpoints";
import { unwrap, unwrapPage } from "@/services/api/response";
import type { ApiEnvelope, Paginated } from "@/types/api.types";

/** Contracts mirror `server/src/services/messaging.service.ts`. */

export interface ConversationParticipant {
  id: string;
  name: string;
  role: string;
  avatarInitials: string;
}

export interface Conversation {
  id: string;
  subject: string | null;
  type: string;
  patientId: string | null;
  patientName: string | null;
  lastMessageAt: string;
  lastReadAt: string | null;
  unreadCount: number;
  lastMessage: string | null;
  lastSenderId: string | null;
  participants: ConversationParticipant[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResult extends Paginated<NotificationRow> {
  unreadCount: number;
}

export interface MessagingDirectory {
  staff: Array<{ id: string; name: string; role: string; subtitle: string | null }>;
  patients: Array<{ id: string; name: string; mrn: string; userId: string | null }>;
}

export interface UnreadSummary {
  unreadMessages: number;
  conversationsWithUnread: number;
}

export const messagingApi = {
  conversations: async (): Promise<Conversation[]> => {
    const response = await apiClient.get<Conversation[]>(API_ENDPOINTS.messaging.conversations);
    return unwrap(response.data);
  },

  messages: async (
    conversationId: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<Message>> => {
    const response = await apiClient.get<Message[]>(
      API_ENDPOINTS.messaging.messages(conversationId),
      { params },
    );
    return unwrapPage(response.data);
  },

  send: async (conversationId: string, body: string): Promise<Message> => {
    const response = await apiClient.post<Message>(
      API_ENDPOINTS.messaging.messages(conversationId),
      { body },
    );
    return unwrap(response.data);
  },

  startConversation: async (input: {
    participantIds: string[];
    subject?: string;
    patientId?: string;
    type?: string;
  }): Promise<Conversation> => {
    const response = await apiClient.post<Conversation>(
      API_ENDPOINTS.messaging.conversations,
      input,
    );
    return unwrap(response.data);
  },

  directory: async (): Promise<MessagingDirectory> => {
    const response = await apiClient.get<MessagingDirectory>(
      API_ENDPOINTS.messaging.directory,
    );
    return unwrap(response.data);
  },

  unread: async (): Promise<UnreadSummary> => {
    const response = await apiClient.get<UnreadSummary>(API_ENDPOINTS.messaging.unread);
    return unwrap(response.data);
  },

  notifications: async (
    params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
  ): Promise<NotificationsResult> => {
    const response = await apiClient.get<NotificationRow[]>(
      API_ENDPOINTS.messaging.notifications,
      { params },
    );
    const envelope = response.data as unknown as ApiEnvelope<NotificationRow[]>;
    const page = unwrapPage(envelope);
    return { ...page, unreadCount: Number(envelope.meta?.unreadCount ?? 0) };
  },

  markRead: async (notificationId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.messaging.readNotification(notificationId), {});
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.messaging.readAllNotifications, {});
  },
};
