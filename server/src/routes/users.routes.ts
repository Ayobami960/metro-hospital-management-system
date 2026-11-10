import { Router } from "express";
import { z } from "zod";
import { authenticate, currentActor } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { handle, ok, paginated } from "../lib/http.js";
import { requirePermission } from "../lib/authorize.js";
import { userRole, userStatus, type UserRole, type UserStatus } from "../db/schema/enums.js";
import {
  inviteStaff,
  invitableRolesFor,
  listStaff,
  pendingInvitations,
  resendInvitation,
  revokeInvitation,
  setUserStatus,
} from "../services/staff-invitation.service.js";

const roleValues = userRole.enumValues as unknown as [UserRole, ...UserRole[]];
const statusValues = userStatus.enumValues as unknown as [UserStatus, ...UserStatus[]];

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  role: z.enum(roleValues).optional(),
  status: z.enum(statusValues).optional(),
});

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  role: z.enum(roleValues),
  hospitalId: z.string().trim().min(3).max(40),
  phone: z.string().trim().max(32).optional(),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().trim().max(40).optional(),
});

/** Staff directory and invitation management (administrators only). */
export const usersRouter = Router();

usersRouter.get(
  "/users",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:read");
    const query = listQuerySchema.parse(req.query);
    const { rows, total } = await listStaff(query);
    paginated(res, rows, total, query.page, query.pageSize);
  }),
);

usersRouter.get(
  "/users/roles",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:read");
    ok(res, { roles: invitableRolesFor(actor.role) });
  }),
);

usersRouter.get(
  "/users/invitations",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:read");
    ok(res, { invitations: await pendingInvitations() });
  }),
);

usersRouter.post(
  "/users/invite",
  authenticate,
  validate({ body: inviteSchema }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:create");
    const result = await inviteStaff(actor, req.body as z.infer<typeof inviteSchema>);
    ok(res, result);
  }),
);

usersRouter.post(
  "/users/invitations/:id/resend",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:create");
    const result = await resendInvitation(actor, String(req.params.id));
    ok(res, result);
  }),
);

usersRouter.delete(
  "/users/invitations/:id",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:create");
    await revokeInvitation(actor, String(req.params.id));
    ok(res, { revoked: true });
  }),
);

usersRouter.patch(
  "/users/:id/status",
  authenticate,
  validate({ body: z.object({ status: z.enum(statusValues) }) }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:deactivate");
    await setUserStatus(actor, String(req.params.id), (req.body as { status: UserStatus }).status);
    ok(res, { updated: true });
  }),
);
