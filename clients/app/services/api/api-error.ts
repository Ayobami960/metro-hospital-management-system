import axios from "axios";

/**
 * Normalised API failure. Every service call throws this instead of an Axios
 * error so components never depend on transport details.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field-level validation messages from the server (`details.fieldErrors`). */
  get fieldErrors(): Record<string, string> {
    const details = this.details as { fieldErrors?: Record<string, string>; issues?: { path?: string; message?: string }[] } | null;
    if (details?.fieldErrors) return details.fieldErrors;
    if (Array.isArray(details?.issues)) {
      const output: Record<string, string> = {};
      for (const issue of details.issues) {
        if (issue.path) output[issue.path] = issue.message ?? "Invalid value";
      }
      return output;
    }
    return {};
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** Authentication/validation failures must not be retried by TanStack Query. */
  get isRetryable(): boolean {
    if (this.status === 0) return true;
    if ([400, 401, 403, 404, 409, 412, 422].includes(this.status)) return false;
    return this.status >= 500;
  }
}

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: unknown };
}

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError<ErrorPayload>(error)) {
    const status = error.response?.status ?? 0;
    const payload = error.response?.data?.error;

    if (status === 0) {
      const timedOut = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
      return new ApiError(
        0,
        timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        timedOut
          ? "The request timed out. Check your connection and try again."
          : "Cannot reach the hospital service. Check your connection and try again.",
        null,
      );
    }

    return new ApiError(
      status,
      payload?.code ?? "REQUEST_FAILED",
      payload?.message ?? error.message ?? `Request failed with status ${status}`,
      payload?.details ?? null,
    );
  }

  if (error instanceof Error) return new ApiError(0, "UNKNOWN_ERROR", error.message, null);
  return new ApiError(0, "UNKNOWN_ERROR", "Something went wrong.", null);
};

/** Human-readable message safe to show in the UI (never a stack trace). */
export const errorMessage = (error: unknown, fallback = "Something went wrong."): string => {
  const apiError = toApiError(error);
  return apiError.message || fallback;
};
