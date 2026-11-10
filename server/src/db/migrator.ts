
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  ensureSchema,
  isTransientPgError,
  type EnsureSchemaResult,
  type MigrationConnection,
} from "./schema-provisioning.js";

export interface MigrationRunOptions {
  migrationsFolder: string;
  schema?: string;
  attempts?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, error: unknown, retryInMs: number) => void;
  onSchemaReady?: (result: EnsureSchemaResult) => void;
}

export interface MigrationRunResult {
  schema: EnsureSchemaResult;
  attemptsUsed: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const applyMigrations = async (
  connection: MigrationConnection,
  options: MigrationRunOptions,
): Promise<MigrationRunResult> => {
  const schema = options.schema ?? "hms";
  const attempts = Math.max(1, options.attempts ?? 3);
  const retryDelayMs = options.retryDelayMs ?? 3_000;

  const schemaResult = await ensureSchema(connection, schema, {
    ...(options.onRetry ? { onRetry: options.onRetry } : {}),
  });
  options.onSchemaReady?.(schemaResult);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const pool = new Pool({
      connectionString: connection.url,
      max: 1,
      connectionTimeoutMillis: 30_000,
      keepAlive: true,
    });

    try {
      await migrate(drizzle(pool), { migrationsFolder: options.migrationsFolder });
      return { schema: schemaResult, attemptsUsed: attempt };
    } catch (error) {
      lastError = error;
      const hasNext = attempt < attempts;
      if (!hasNext || !isTransientPgError(error)) throw error;

      options.onRetry?.(attempt, error, retryDelayMs);
      await sleep(retryDelayMs);
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  throw lastError ?? new Error("Migration failed for an unknown reason");
};
