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
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8011/api/v1";

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
