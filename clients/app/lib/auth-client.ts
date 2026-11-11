import { createAuthClient } from "better-auth/react";

import { API_ORIGIN } from "@/services/api/client";

/**
 * better-auth browser client. The server mounts better-auth at
 * `/api/v1/auth` (see `server/src/lib/auth.ts`), so the API origin is passed as
 * the base URL and the mount path as the base path.
 *
 * `API_ORIGIN` is pre-resolved: this module is evaluated during SSR, and
 * `new URL(API_BASE_URL)` threw at startup for a relative `VITE_API_URL`.
 */
export const authClient = createAuthClient({
  baseURL: API_ORIGIN,
  basePath: "/api/v1/auth",
  fetchOptions: { credentials: "include" },
});
