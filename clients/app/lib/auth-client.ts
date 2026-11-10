import { createAuthClient } from "better-auth/react";

import { API_BASE_URL } from "@/services/api/client";

/**
 * better-auth browser client. The server mounts better-auth at
 * `/api/v1/auth` (see `server/src/lib/auth.ts`), so the API origin is passed as
 * the base URL and the mount path as the base path.
 */
export const authClient = createAuthClient({
  baseURL: new URL(API_BASE_URL).origin,
  basePath: "/api/v1/auth",
  fetchOptions: { credentials: "include" },
});
