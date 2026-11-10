import type { Request, Response } from "express";
import { currentActor } from "../middleware/authenticate.js";
import { requirePermission } from "../lib/authorize.js";
import { created, handle, ok, paginated, parseListQuery } from "../lib/http.js";
import {
  addQueueEntry,
  callNextPatient,
  listQueue,
  transitionQueueEntry,
  type QueueInput,
} from "../services/reception.service.js";

/** Thin HTTP layer: query parsing, permissions, envelopes. */

export const getQueue = handle(async (req: Request, res: Response) => {
  requirePermission(currentActor(req), "queue:read");
  const q = parseListQuery(req.query as Record<string, unknown>, ["checkInAt"], "checkInAt");
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const result = await listQueue({ page: q.page, pageSize: q.pageSize, offset: q.offset, status });
  // Positions are derived from ordering, never stored (requirement 3).
  paginated(res, result.rows, result.total, q.page, q.pageSize, { completedToday: 0 });
});

export const postQueueEntry = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "queue:manage");
  const body = req.body as QueueInput;
  const entry = await addQueueEntry(actor.id, actor.role, body, req.ip);
  created(res, { id: entry.id, ticketNumber: entry.ticketNumber, status: entry.status, priority: entry.priority });
});

export const postCallNext = handle(async (req: Request, res: Response) => {
  const actor = currentActor(req);
  requirePermission(actor, "queue:manage");
  const doctorId = typeof req.body?.doctorId === "string" ? req.body.doctorId : null;
  ok(res, await callNextPatient(actor.id, actor.role, doctorId, req.ip));
});

const transition =
  (to: "IN_PROGRESS" | "COMPLETED" | "REMOVED", from: string[], event: string) =>
  handle(async (req: Request, res: Response) => {
    const actor = currentActor(req);
    requirePermission(actor, "queue:manage");
    const row = await transitionQueueEntry(actor.id, actor.role, String(req.params.id), to, from, event, req.ip);
    ok(res, { id: row.id, status: row.status });
  });

export const postQueueStart = transition("IN_PROGRESS", ["CALLED"], "STARTED");
export const postQueueComplete = transition("COMPLETED", ["CALLED", "IN_PROGRESS"], "COMPLETED");
export const postQueueRemove = transition("REMOVED", ["WAITING", "CALLED"], "REMOVED");
