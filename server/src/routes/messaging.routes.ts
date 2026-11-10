import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getConversationMessages,
  getConversations,
  getMessagingDirectory,
  getNotifications,
  getUnreadSummary,
  postConversation,
  postConversationMessage,
  postNotificationRead,
  postNotificationsReadAll,
} from "../controllers/messaging.controller.js";

export const messagingRouter = Router();

messagingRouter.get("/conversations", authenticate, getConversations);
messagingRouter.post("/conversations", authenticate, postConversation);
messagingRouter.get("/conversations/:id/messages", authenticate, getConversationMessages);
messagingRouter.post("/conversations/:id/messages", authenticate, postConversationMessage);
messagingRouter.get("/messages/directory", authenticate, getMessagingDirectory);
messagingRouter.get("/messages/unread", authenticate, getUnreadSummary);

messagingRouter.get("/notifications", authenticate, getNotifications);
messagingRouter.post("/notifications/:id/read", authenticate, postNotificationRead);
messagingRouter.post("/notifications/read-all", authenticate, postNotificationsReadAll);
