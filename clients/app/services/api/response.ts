import type { ApiEnvelope, PageMeta, Paginated } from "@/types/api.types";

/**
 * Unwraps a single-resource envelope.
 *
 * Axios already types `response.data` as the payload, so services may pass
 * either the bare DTO or a `{ data }` envelope; both resolve to the DTO.
 */
export const unwrap = <T>(payload: T | ApiEnvelope<T>): T => {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "meta" in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
};

const EMPTY_META: PageMeta = {
  page: 1,
  pageSize: 0,
  total: 0,
  totalPages: 0,
  hasMore: false,
};

/** Unwraps a list envelope into `{ rows, meta }`, keeping any extra meta keys. */
export const unwrapPage = <T>(payload: T[] | ApiEnvelope<T[]>): Paginated<T> => {
  const isEnvelope =
    payload && !Array.isArray(payload) && typeof payload === "object" && "data" in payload;
  if (!isEnvelope) {
    const rows = payload as T[];
    return {
      rows,
      meta: { ...EMPTY_META, total: rows.length, pageSize: rows.length, totalPages: 1 },
    };
  }
  const envelope = payload as ApiEnvelope<T[]>;
  return {
    rows: envelope.data,
    meta: envelope.meta ?? {
      ...EMPTY_META,
      total: envelope.data.length,
      pageSize: envelope.data.length,
      totalPages: 1,
    },
  };
};

/** Reads an extra meta block (e.g. the room summary) with a typed fallback. */
export const metaBlock = <T>(envelope: ApiEnvelope<unknown>, key: string, fallback: T): T => {
  const value = envelope.meta?.[key];
  return (value as T | undefined) ?? fallback;
};
