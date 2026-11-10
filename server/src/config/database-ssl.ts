
export type PgSslMode =
  | "disable"
  | "allow"
  | "prefer"
  | "require"
  | "verify-ca"
  | "verify-full";

/** Modes pg currently treats as aliases for `verify-full`. */
const ALIAS_MODES: ReadonlySet<string> = new Set(["prefer", "require", "verify-ca"]);

const KNOWN_MODES: ReadonlySet<string> = new Set([
  "disable",
  "allow",
  "prefer",
  "require",
  "verify-ca",
  "verify-full",
]);

export interface DatabaseSslInfo {
  /** `sslmode` in the URL, or null when the URL does not set one. */
  mode: PgSslMode | null;
  /** Deprecated alias that was rewritten to `verify-full`, if any. */
  normalizedFrom: PgSslMode | null;
  /** The URL opts into libpq semantics via `uselibpqcompat=true`. */
  libpqCompat: boolean;
}

export interface NormalizedDatabaseUrl {
  /** Connection string to hand to pg / drizzle-kit. */
  url: string;
  info: DatabaseSslInfo;
  /** True when this call changed the connection string. */
  rewritten: boolean;
}

export interface DatabaseTarget {
  host: string;
  port: number | null;
  database: string;
  user: string;
}

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

/** Credential-free description of a connection string, safe to log. */
export const describeDatabaseUrl = (raw: string): DatabaseTarget | null => {
  const url = parseUrl(raw);
  if (!url) return null;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : null,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "(default)",
    user: decodeURIComponent(url.username),
  };
};

export const inspectDatabaseSsl = (raw: string): DatabaseSslInfo => {
  const url = parseUrl(raw);
  if (!url) return { mode: null, normalizedFrom: null, libpqCompat: false };

  const requested = url.searchParams.get("sslmode")?.trim().toLowerCase();
  return {
    mode: requested && KNOWN_MODES.has(requested) ? (requested as PgSslMode) : null,
    normalizedFrom: null,
    libpqCompat: (url.searchParams.get("uselibpqcompat") ?? "").trim().toLowerCase() === "true",
  };
};

/**
 * Replace a deprecated `sslmode` alias with explicit `verify-full`.
 *
 * Only the `sslmode` query value changes; host, port, database, credentials and
 * every other parameter (e.g. `channel_binding`) are preserved byte for byte,
 * so this does not "rewrite" the operator's database URL.
 */
export const normalizeDatabaseSsl = (raw: string): NormalizedDatabaseUrl => {
  const info = inspectDatabaseSsl(raw);

  if (!info.mode || info.libpqCompat || !ALIAS_MODES.has(info.mode)) {
    return { url: raw, info, rewritten: false };
  }

  const url = raw.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(?=&|#|$)/i,
    "$1sslmode=verify-full",
  );

  if (url === raw) return { url: raw, info, rewritten: false };

  return {
    url,
    info: { ...info, mode: "verify-full", normalizedFrom: info.mode },
    rewritten: true,
  };
};
