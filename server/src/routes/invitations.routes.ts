import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { handle, ok } from "../lib/http.js";
import { acceptInvitation, validateInvitation } from "../services/staff-invitation.service.js";

/**
 * Public invitation endpoints. Only the single-use token can activate a staff
 * account, and the role is read from the invitation row — never from the body.
 */
export const invitationsRouter = Router();

invitationsRouter.get(
  "/invitations/:token",
  handle(async (req, res) => {
    ok(res, await validateInvitation(String(req.params.token ?? "")));
  }),
);

invitationsRouter.post(
  "/invitations/accept",
  validate({
    body: z.object({
      token: z.string().min(20).max(200),
      password: z.string().min(12).max(256),
      name: z.string().trim().min(2).max(120).optional(),
    }),
  }),
  handle(async (req, res) => {
    const result = await acceptInvitation(
      req.body as { token: string; password: string; name?: string },
    );
    ok(res, result);
  }),
);
