import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_PATIENT_SUSPECTED"
  | "SLOT_TAKEN"
  | "INSUFFICIENT_STOCK"
  | "ALLERGY_CONFLICT"
  | "CRITICAL_VALUE_UNACKNOWLEDGED"
  | "ANALYZER_OUT_OF_SERVICE"
  | "INVALID_TRANSITION"
  | "PRECONDITION_FAILED"
  | "IDEMPOTENCY_MISMATCH"
  | "RATE_LIMITED"
  | "NOT_IMPLEMENTED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

const statusFor: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_PATIENT_SUSPECTED: 409,
  SLOT_TAKEN: 409,
  INSUFFICIENT_STOCK: 409,
  ALLERGY_CONFLICT: 409,
  CRITICAL_VALUE_UNACKNOWLEDGED: 409,
  ANALYZER_OUT_OF_SERVICE: 409,
  INVALID_TRANSITION: 409,
  PRECONDITION_FAILED: 412,
  IDEMPOTENCY_MISMATCH: 409,
  RATE_LIMITED: 429,
  NOT_IMPLEMENTED: 501,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = statusFor[code];
    this.details = details ?? null;
  }
}

export const badRequest = (m: string, d?: unknown) => new AppError("BAD_REQUEST", m, d);
export const notFound = (m = "Resource not found") => new AppError("NOT_FOUND", m);
export const forbidden = (m = "Not permitted") => new AppError("FORBIDDEN", m);
export const conflict = (m: string, d?: unknown) => new AppError("CONFLICT", m, d);
export const unauthenticated = (m = "Authentication required") =>
  new AppError("UNAUTHENTICATED", m);
export const invalidTransition = (from: string, to: string) =>
  new AppError("INVALID_TRANSITION", `Cannot move from ${from} to ${to}`, { from, to });

/** Wraps an async handler so rejections reach the error middleware (Express 5 does this natively). */
export const handle =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req as T, res, next)).catch(next);
  };

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export const ok = <T>(res: Response, data: T, meta: unknown = null): void => {
  res.status(200).json({ data, meta });
};

export const created = <T>(res: Response, data: T, meta: unknown = null): void => {
  res.status(201).json({ data, meta });
};

export const noContent = (res: Response): void => {
  res.status(204).send();
};

export const paginated = <T>(
  res: Response,
  rows: T[],
  total: number,
  page: number,
  pageSize: number,
  extra: Record<string, unknown> = {},
): void => {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  const meta: PageMeta & Record<string, unknown> = {
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page * pageSize < total,
    ...extra,
  };
  res.status(200).json({ data: rows, meta });
};

export interface ListQuery {
  page: number;
  pageSize: number;
  offset: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

const MAX_PAGE_SIZE = 100;

/**
 * Normalises page/pageSize/search/sort for the frontend DataTable. `sortFields`
 * is the allowlist; an unknown field throws instead of reaching SQL.
 */
export const parseListQuery = (
  query: Record<string, unknown>,
  sortFields: readonly string[],
  defaultSort = "createdAt",
): ListQuery => {
  const page = Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1);
  const rawSize = Number.parseInt(String(query.pageSize ?? "20"), 10) || 20;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  const search = String(query.search ?? "").trim().slice(0, 200);
  const requested = String(query.sort ?? defaultSort);
  if (!sortFields.includes(requested)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported sort field", {
      field: "sort",
      allowed: sortFields,
    });
  }
  const order = String(query.order ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
  return { page, pageSize, offset: (page - 1) * pageSize, search, sort: requested, order };
};

export const errorBody = (error: AppError): { error: { code: string; message: string; details: unknown } } => ({
  error: { code: error.code, message: error.message, details: error.details },
});

export const isZodError = (error: unknown): error is ZodError => error instanceof ZodError;
