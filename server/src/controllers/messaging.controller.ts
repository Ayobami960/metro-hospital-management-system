import type { Request, Response } from "express";
import { z } from "zod";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { badRequest, created, handle, ok, paginated } from "../lib/http.js";
import { parseListQuery } from "../lib/http.js";
import {
  createConversation,
  listConversations,
  listMessages,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  messagingDirectory,
  sendMessage,
  unreadSummary,
} from "../services/messaging.service.js";

const pageOf = (req: Request, fallbackSize = 50) => {
  const q = parseListQuery(req.query as Record<string, unknown>, ["createdAt"], "createdAt");
  return { page: q.page, pageSize: req.query.pageSize ? q.pageSize : fallbackSize };
};

export const getConversations = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "message:read");
  ok(res, await listConversations(actor.id));
});

export const getConversationMessages = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "message:read");
  const { page, pageSize } = pageOf(req, 100);
  const result = await listMessages(String(req.params.id), actor.id, page, pageSize);
  paginated(res, result.rows, result.total, page, pageSize);
});

const sendSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  attachments: z
    .array(
      z.object({
        fileId: z.string().min(1),
        fileName: z.string().max(255).optional(),
        contentType: z.string().max(120).optional(),
        sizeBytes: z.string().max(32).optional(),
      }),
    )
    .max(5)
    .optional(),
});

export const postConversationMessage = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "message:send");
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid message", parsed.error.issues);
  const message = await sendMessage(String(req.params.id), actor.id, parsed.data.body, parsed.data.attachments);
  created(res, message);
});

const createSchema = z.object({
  participantIds: z.array(z.string().min(1)).min(1).max(20),
  subject: z.string().trim().max(160).optional(),
  patientId: z.string().uuid().optional(),
  body: z.string().trim().max(5000).optional(),
});

export const postConversation = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "message:send");
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid conversation", parsed.error.issues);
  const conversation = await createConversation(actor, parsed.data);
  created(res, conversation);
});

export const getNotifications = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:read");
  const { page, pageSize } = pageOf(req, 30);
  const unreadOnly = req.query.unread === "true";
  const result = await listNotifications(actor.id, page, pageSize, unreadOnly);
  paginated(res, result.rows, result.total, page, pageSize, { unreadCount: result.unreadCount });
});

export const postNotificationRead = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:read");
  ok(res, await markNotificationRead(String(req.params.id), actor.id));
});

export const postNotificationsReadAll = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:read");
  ok(res, await markAllNotificationsRead(actor.id));
});

export const getMessagingDirectory = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "message:read");
  ok(res, await messagingDirectory(actor));
});

export const getUnreadSummary = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:read");
  ok(res, await unreadSummary(actor.id));
});
