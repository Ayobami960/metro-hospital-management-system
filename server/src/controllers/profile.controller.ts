import type { Request, Response } from "express";
import { z } from "zod";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { badRequest, handle, ok } from "../lib/http.js";
import {
  getHospitalSettings,
  getNotificationPreferences,
  getProfile,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  updateHospitalSettings,
  updateNotificationPreferences,
  updateProfile,
} from "../services/profile.service.js";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  image: z.string().url().max(2048).nullable().optional(),
});

export const getMeProfile = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:read");
  ok(res, await getProfile(actor.id));
});

export const patchMeProfile = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:write");
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid profile payload", parsed.error.issues);
  ok(res, await updateProfile(actor.id, parsed.data));
});

const preferencesSchema = z.object({
  appointments: z.boolean().optional(),
  labResults: z.boolean().optional(),
  prescriptions: z.boolean().optional(),
  bills: z.boolean().optional(),
  messages: z.boolean().optional(),
  emailChannel: z.boolean().optional(),
  smsChannel: z.boolean().optional(),
  pushChannel: z.boolean().optional(),
  privacyShareForResearch: z.boolean().optional(),
  privacyShareWithFamily: z.boolean().optional(),
  privacyAnalytics: z.boolean().optional(),
});

export const getMePreferences = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:read");
  ok(res, await getNotificationPreferences(actor.id));
});

export const patchMePreferences = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:write");
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid preference payload", parsed.error.issues);
  ok(res, await updateNotificationPreferences(actor.id, parsed.data));
});

export const getMeSessions = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:read");
  ok(res, await listSessions(actor.id));
});

export const deleteMeSession = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:write");
  ok(res, await revokeSession(actor.id, String(req.params.id)));
});

export const deleteMeOtherSessions = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "me:write");
  const keep = typeof req.query.keep === "string" ? req.query.keep : undefined;
  ok(res, await revokeOtherSessions(actor.id, keep));
});

const hospitalSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  postalCode: z.string().trim().max(16).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  email: z.string().email().nullable().optional(),
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().length(3).optional(),
  mrnPrefix: z.string().trim().max(8).optional(),
  invoiceDueDays: z.coerce.number().int().min(0).max(365).optional(),
  nearExpiryDays: z.coerce.number().int().min(1).max(3650).optional(),
  auditRetentionYears: z.coerce.number().int().min(1).max(50).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const getHospital = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "settings:read");
  ok(res, await getHospitalSettings());
});

export const patchHospital = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "settings:write");
  const parsed = hospitalSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Invalid hospital settings payload", parsed.error.issues);
  ok(res, await updateHospitalSettings(parsed.data));
});
