/**
 * Schema provisioning for the `hms` PostgreSQL schema.
 *
 * Every HMS table lives in the `hms` schema (`pgSchema("hms")`), but the
 * generated Drizzle migration does not create that schema itself, and
 * `drizzle-kit migrate` cannot run SQL that references a missing namespace.
 * These helpers are the single implementation used by `db:ensure-schema` and
 * `db:bootstrap`, so the precondition and its diagnostics cannot drift apart.
 *
 * Two rules matter here:
 *  - never create or alter anything outside the requested schema;
 *  - never swallow a PostgreSQL error — surface its code/message/detail/cause,
 *    because pg reports connection failures as `AggregateError` with an empty
 *    message (which is how `Failed to ensure schema "hms":` lost the reason).
 */
import { Client } from "pg";
import {
  describeDatabaseUrl,
  normalizeDatabaseSsl,
  type DatabaseSslInfo,
  type DatabaseTarget,
} from "../config/database-ssl.js";

const SCHEMA_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

/** Connection-level failures that are worth retrying (Neon suspend/resume, proxies). */
const TRANSIENT_CODES: ReadonlySet<string> = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "57P03", // cannot_connect_now: server starting up
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
]);

/** PostgreSQL SQLSTATEs that mean "the current role may not create the schema". */
const PERMISSION_CODES: ReadonlySet<string> = new Set([
  "42501", // insufficient_privilege
  "3F000", // invalid_schema_name
]);

export interface MigrationConnection {
  /** Normalized connection string. Never log this value. */
  url: string;
  source: "DATABASE_URL";
  ssl: DatabaseSslInfo;
  target: DatabaseTarget | null;
}

export interface EnsureSchemaResult {
  schema: string;
  created: boolean;
  privileges: { usage: boolean; create: boolean };
}

export interface PgErrorDetails {
  name: string;
  code: string | null;
  message: string;
  detail: string | null;
  hint: string | null;
  severity: string | null;
  schema: string | null;
  table: string | null;
  column: string | null;
  constraint: string | null;
  cause: string | null;
  /** Per-address failures hidden inside an AggregateError (e.g. ETIMEDOUT). */
  addresses: Array<{ address: string; port: string | null; code: string }>;
}

export class SchemaProvisioningError extends Error {
  readonly code: string;

  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SchemaProvisioningError";
    this.code = code;
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const collectErrors = (error: unknown, into: unknown[] = []): unknown[] => {
  into.push(error);
  if (error instanceof AggregateError) {
    for (const inner of error.errors) collectErrors(inner, into);
  }
  const cause = asRecord(error)?.cause;
  if (cause !== undefined) collectErrors(cause, into);
  return into;
};

const errorCodes = (error: unknown): string[] => {
  const codes: string[] = [];
  for (const item of collectErrors(error)) {
    const code = readString(asRecord(item) ?? {}, "code");
    if (code) codes.push(code);
  }
  return [...new Set(codes)];
};

/** True for connection-level failures that are worth retrying. */
export const isTransientPgError = (error: unknown): boolean =>
  errorCodes(error).some((code) => TRANSIENT_CODES.has(code));

export const isPermissionError = (error: unknown): boolean =>
  errorCodes(error).some((code) => PERMISSION_CODES.has(code));

/**
 * Normalize a pg error into the fields an operator needs. Includes the
 * AggregateError address list so a TCP-level failure is not reported as "".
 */
export const describePgError = (error: unknown): PgErrorDetails => {
  const record = asRecord(error) ?? {};
  const codes = errorCodes(error);

  const addresses: PgErrorDetails["addresses"] = [];
  for (const item of collectErrors(error)) {
    const inner = asRecord(item);
    if (!inner) continue;
    const address = readString(inner, "address");
    const code = readString(inner, "code");
    if (address && code) {
      const port = readString(inner, "port");
      addresses.push({ address, port, code });
    }
  }

  const message = readString(record, "message");
  const causeRecord = asRecord(record.cause);

  return {
    name: typeof record.name === "string" ? record.name : error instanceof Error ? error.constructor.name : "UnknownError",
    code: readString(record, "code") ?? codes.at(0) ?? null,
    message:
      message ??
      (codes.length > 0
        ? `connection failed (${codes.join(", ")}); no message was provided by the driver`
        : "unknown error"),
    detail: readString(record, "detail"),
    hint: readString(record, "hint"),
    severity: readString(record, "severity"),
    schema: readString(record, "schema"),
    table: readString(record, "table"),
    column: readString(record, "column"),
    constraint: readString(record, "constraint"),
    cause:
      causeRecord !== null
        ? (readString(causeRecord, "message") ?? readString(causeRecord, "code"))
        : null,
    addresses,
  };
};

/** Human-readable, credential-free error report. */
export const formatPgError = (error: unknown): string => {
  const details = describePgError(error);
  const lines: string[] = [];

  lines.push(`  driver      : ${details.name}`);
  if (details.code) lines.push(`  code        : ${details.code}`);
  lines.push(`  message     : ${details.message}`);
  if (details.severity) lines.push(`  severity    : ${details.severity}`);
  if (details.detail) lines.push(`  detail      : ${details.detail}`);
  if (details.hint) lines.push(`  hint        : ${details.hint}`);
  if (details.schema) lines.push(`  schema      : ${details.schema}`);
  if (details.table) lines.push(`table: ${details.table}`);
  if (details.column) lines.push(`  column      : ${details.column}`);
  if (details.constraint) lines.push(`  constraint  : ${details.constraint}`);
  if (details.cause) lines.push(`  cause       : ${details.cause}`);

  if (details.addresses.length > 0) {
    const rendered = details.addresses
      .map(({ address, port, code }) => `${address}${port ? `:${port}` : ""} (${code})`)
      .join(", ");
    lines.push(`  addresses   : ${rendered}`);
  }

  return lines.join("\n");
};

/** Resolve the only configured database connection for runtime and DDL. */
export const resolveMigrationConnection = (): MigrationConnection => {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL is required to connect to the PostgreSQL database.");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (
    (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
    !parsed.hostname ||
    parsed.pathname.length < 2
  ) {
    throw new Error("DATABASE_URL must include a PostgreSQL host and database name.");
  }

  const normalized = normalizeDatabaseSsl(raw);

  return {
    url: normalized.url,
    source: "DATABASE_URL",
    ssl: normalized.info,
    target: describeDatabaseUrl(normalized.url),
  };
};

/** SQL for a database administrator when the application role lacks CREATE. */
export const schemaAdminSql = (schema: string, role: string): string[] => [
  `-- Run as the database owner (for Neon: the *_owner role of this database):`,
  `CREATE SCHEMA IF NOT EXISTS "${schema}";`,
  `-- Then let the application role use it (required for migrations and queries):`,
  `GRANT USAGE, CREATE ON SCHEMA "${schema}" TO "${role.replace(/"/g, '""')}";`,
  `-- Tables are owned/created by the application role, so no extra grants are needed.`,
];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const schemaExists = async (client: Client, schema: string): Promise<boolean> => {
  const { rows } = await client.query<{ exists: boolean }>(
    "select exists(select 1 from information_schema.schemata where schema_name = $1) as exists",
    [schema],
  );
  return rows[0]?.exists ?? false;
};

const connectWithRetry = async (
  connectionString: string,
  attempts: number,
  onRetry: ((attempt: number, error: unknown, retryInMs: number) => void) | undefined,
): Promise<Client> => {
  const retryInMs = 2_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = new Client({
      connectionString,
      // Neon suspends idle computes; the first connection can need several
      // seconds to resume. Stay well under an operator's patience.
      connectionTimeoutMillis: 30_000,
    });

    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);

      const hasNext = attempt < attempts;
      if (!hasNext || !isTransientPgError(error)) break;

      onRetry?.(attempt, error, retryInMs);
      await sleep(retryInMs);
    }
  }

  throw lastError ?? new Error("Could not connect to PostgreSQL");
};

/**
 * Create `schema` when missing, verify it exists, and report the privileges the
 * connection role has inside it. Existing schemas, tables and data are never
 * touched (`CREATE SCHEMA IF NOT EXISTS` semantics plus an existence pre-check).
 */
export const ensureSchema = async (
  connection: MigrationConnection,
  schema: string,
  options: {
    attempts?: number;
    onRetry?: (attempt: number, error: unknown, retryInMs: number) => void;
  } = {},
): Promise<EnsureSchemaResult> => {
  if (!SCHEMA_NAME_PATTERN.test(schema)) {
    throw new Error(`Refusing to use unexpected schema name: ${schema}`);
  }

  const client = await connectWithRetry(
    connection.url,
    options.attempts ?? 3,
    options.onRetry,
  );

  try {
    const existed = await schemaExists(client, schema);

    if (!existed) {
      const { rows } = await client.query<{ can_create: boolean; current_user: string }>(
        "select has_database_privilege(current_database(), 'CREATE') as can_create, current_user",
      );
      const canCreate = rows[0]?.can_create ?? false;

      if (!canCreate) {
        throw new SchemaProvisioningError(
          `The database user "${rows[0]?.current_user ?? "unknown"}" is not allowed to create schema "${schema}" in this database. ` +
            "Ask a database administrator to run the SQL printed below, then re-run this command.",
          "42501",
        );
      }

      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }

    if (!(await schemaExists(client, schema))) {
      throw new SchemaProvisioningError(
        `PostgreSQL did not create schema "${schema}"; the schema is still missing after CREATE SCHEMA.`,
        "3F000",
      );
    }

    const { rows } = await client.query<{ usage: boolean; create: boolean }>(
      "select has_schema_privilege(current_user, $1, 'USAGE') as usage, has_schema_privilege(current_user, $1, 'CREATE') as create",
      [schema],
    );

    return {
      schema,
      created: !existed,
      privileges: { usage: rows[0]?.usage ?? false, create: rows[0]?.create ?? false },
    };
  } finally {
    await client.end().catch(() => undefined);
  }
};
