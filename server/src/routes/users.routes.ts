import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { authenticate, currentActor } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { handle, ok, paginated } from "../lib/http.js";
import { requirePermission } from "../lib/authorize.js";
import { env } from "../config/env.js";
import { userRole, userStatus, type UserRole, type UserStatus } from "../db/schema/enums.js";
import {
  changeUserRole,
  getManagedUser,
  getUserStatistics,
  inviteStaff,
  invitableRolesFor,
  listManagedUsers,
  pendingInvitations,
  resendInvitation,
  revokeInvitation,
  setUserStatus,
  updateManagedUser,
} from "../services/staff-invitation.service.js";

const roleValues = userRole.enumValues as unknown as [UserRole, ...UserRole[]];
const statusValues = userStatus.enumValues as unknown as [UserStatus, ...UserStatus[]];

const invitationLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: (req) => req.actor?.id ?? ipKeyGenerator(req.ip ?? "0.0.0.0"),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  role: z.enum(roleValues).optional(),
  status: z.enum(statusValues).optional(),
  departmentId: z.string().uuid().optional(),
  verified: z.enum(["true", "false"]).optional(),
  profileComplete: z.enum(["true", "false"]).optional(),
  sort: z.enum(["name", "email", "role", "status", "createdAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  role: z.enum(roleValues),
  hospitalId: z.string().trim().min(3).max(40).optional(),
  phone: z.string().trim().max(32).optional(),
  departmentId: z.string().uuid().optional(),
  specialtyId: z.string().uuid().optional(),
  employeeId: z.string().trim().max(40).optional(),
  title: z.string().trim().max(120).optional(),
  licenseNumber: z.string().trim().max(80).optional(),
  /** Accepted for the Create User flow; both modes provision an invitation. */
  mode: z.enum(["CREATE", "INVITE"]).optional(),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  hospitalId: z.string().trim().max(40).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  specialtyId: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  employeeId: z.string().trim().max(40).nullable().optional(),
  ward: z.string().trim().max(80).nullable().optional(),
  licenseNumber: z.string().trim().max(80).nullable().optional(),
});

/** Directory and invitation management (administrators only). */
export const usersRouter = Router();

usersRouter.get(
  "/users",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:read");
    const query = listQuerySchema.parse(req.query);
    const { rows, total } = await listManagedUsers({
      ...query,
      verified: query.verified === undefined ? undefined : query.verified === "true",
      profileComplete:
        query.profileComplete === undefined ? undefined : query.profileComplete === "true",
    });
    paginated(res, rows, total, query.page, query.pageSize);
  }),
);

usersRouter.get(
  "/users/statistics",
  authenticate,
  handle(async (req, res) => {
    requirePermission(currentActor(req), "user:read");
    ok(res, await getUserStatistics());
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
    requirePermission(currentActor(req), "user:read");
    ok(res, { invitations: await pendingInvitations() });
  }),
);

usersRouter.post(
  "/users",
  authenticate,
  invitationLimiter,
  validate({ body: inviteSchema }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:create");
    const body = req.body as z.infer<typeof inviteSchema>;
    const result = await inviteStaff(actor, body);
    ok(res, { ...result, mode: body.mode ?? "INVITE" });
  }),
);

usersRouter.post(
  "/users/invite",
  authenticate,
  invitationLimiter,
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
  invitationLimiter,
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

usersRouter.get(
  "/users/:id",
  authenticate,
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:read");
    ok(res, await getManagedUser(String(req.params.id)));
  }),
);

usersRouter.patch(
  "/users/:id",
  authenticate,
  validate({ body: updateUserSchema }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:create");
    await updateManagedUser(actor, String(req.params.id), req.body as z.infer<typeof updateUserSchema>);
    ok(res, await getManagedUser(String(req.params.id)));
  }),
);

usersRouter.patch(
  "/users/:id/role",
  authenticate,
  validate({ body: z.object({ role: z.enum(roleValues) }) }),
  handle(async (req, res) => {
    const actor = currentActor(req);
    requirePermission(actor, "user:role");
    await changeUserRole(actor, String(req.params.id), (req.body as { role: UserRole }).role);
    ok(res, await getManagedUser(String(req.params.id)));
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
