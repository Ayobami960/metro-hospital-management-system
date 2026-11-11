import axios, { type AxiosRequestConfig } from "axios";

import { API_ENDPOINTS } from "./endpoints";
import { ApiError, toApiError } from "./api-error";

/**
 * The one Axios instance used by every service module.
 *
 * - Base URL and timeout live here (override with `VITE_API_URL`).
 * - `withCredentials` keeps the better-auth session cookie on every call.
 * - Responses are returned unchanged (`{ data, meta }` envelope) so services
 *   stay thin; failures are normalised into `ApiError`.
 */
const LOCAL_API_URL = "http://localhost:8011/api/v1";

const isBrowser = typeof window !== "undefined";

const isAbsoluteUrl = (value: string): boolean =>
  /^[a-z][a-z\d+\-.]*:/i.test(value) || value.startsWith("//");

/** Only absolute values can serve as a base; a relative one would throw. */
const serverApiOrigin =
  (typeof process !== "undefined" &&
    [process.env.API_ORIGIN, process.env.VITE_API_URL]
      .map((value) => value?.trim())
      .find((value): value is string => typeof value === "string" && isAbsoluteUrl(value))) ||
  LOCAL_API_URL;

const defaultApiUrl = isBrowser ? `${window.location.origin}/api/v1` : LOCAL_API_URL;

const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

/**
 * Resolve a URL without ever throwing. This module is imported by the SSR route
 * tree: `new URL("/api/v1")` on a relative `VITE_API_URL` crashed the serverless
 * function at startup with `TypeError: Invalid URL` (500
 * FUNCTION_INVOCATION_FAILED). Accepts absolute (`https://host/api/v1`),
 * protocol-relative (`//host/api/v1`), bare host (`host/api/v1`) and relative
 * (`/api/v1`) values.
 */
const resolveApiUrl = (value: string): URL => {
  try {
    if (isAbsoluteUrl(value)) return new URL(value.startsWith("//") ? `https:${value}` : value);
    if (!value.startsWith("/")) return new URL(`https://${value}`);
    return new URL(value, isBrowser ? window.location.origin : serverApiOrigin);
  } catch {
    // Last resort: keep module evaluation (and therefore the SSR function) alive.
    return new URL(LOCAL_API_URL);
  }
};

/** A relative value stays relative so browser calls go to the app's own origin. */
export const API_BASE_URL = configuredApiUrl || defaultApiUrl;

/** Absolute origin for clients (better-auth) that require one. */
export const API_ORIGIN = resolveApiUrl(API_BASE_URL).origin;

export const UNAUTHORIZED_EVENT = "hms:unauthorized";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use((config) => {
  // Let the browser set the multipart boundary; only JSON bodies get a header.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    if (apiError.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(apiError);
  },
);

/** Errors that are expected to be handled inline (404 "none recorded"). */
export const isNotFound = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 404;

/**
 * Downloads a binary endpoint (CSV/Excel/PDF) and triggers the browser save.
 * The server controls the filename through `Content-Disposition`.
 */
export const downloadFile = async (
  path: string,
  fallbackName: string,
  config?: AxiosRequestConfig,
): Promise<void> => {
  const response = await apiClient.get<Blob>(path, {
    ...config,
    responseType: "blob",
  });

  const disposition = String(response.headers["content-disposition"] ?? "");
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : fallbackName;

  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/** Opens a binary endpoint (PDF) inline in a new tab. */
export const openFile = async (path: string): Promise<void> => {
  const response = await apiClient.get<Blob>(path, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export { API_ENDPOINTS };
