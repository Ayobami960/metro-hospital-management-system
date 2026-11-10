import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/services/api/api-error";

/**
 * Shared QueryClient configuration.
 *
 * Dashboards are polled, lists are paginated and mutations invalidate the
 * queries they affect, so defaults stay conservative: five minutes of cache,
 * one background retry for recoverable failures only.
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) return error.isRetryable && failureCount < 2;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Keep the previous page visible while a new page loads.
        placeholderData: (previous: unknown) => previous,
      },
      mutations: {
        retry: false,
      },
    },
  });
