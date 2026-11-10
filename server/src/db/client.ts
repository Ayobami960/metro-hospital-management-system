
import net from "node:net";
import ws from "ws";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";

import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

const databaseErrorSummary = (error: unknown): string => {
  const record = error as { code?: unknown; message?: unknown; name?: unknown };
  const code = typeof record?.code === "string" ? record.code : undefined;
  const name = typeof record?.name === "string" ? record.name : "DatabaseError";
  const message = typeof record?.message === "string" ? record.message : "connection failed";
  const safeMessage = message.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[database URL]");
  return `${code ?? name}: ${safeMessage}`;
};

// --------------------------------------------------
// 1. NEON WEBSOCKET CONFIGURATION
// --------------------------------------------------

net.setDefaultAutoSelectFamilyAttemptTimeout(5_000);

neonConfig.webSocketConstructor = ws;

// --------------------------------------------------
// 2. DATABASE CONNECTION POOL
// --------------------------------------------------

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

// Handle unexpected PostgreSQL pool errors.
pool.on("error", (error: Error) => {
  console.error("Unexpected PostgreSQL pool error:", databaseErrorSummary(error));
});

// --------------------------------------------------
// 3. DRIZZLE ORM INITIALIZATION
// --------------------------------------------------

export const db = drizzle(pool, {
  schema,
  casing: "snake_case",
});

export type Database = typeof db;

// --------------------------------------------------
// 4. RETRY HELPER
// --------------------------------------------------

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// --------------------------------------------------
// 5. DATABASE HEALTH CHECK
// --------------------------------------------------

export const checkDatabase = async (): Promise<boolean> => {
  try {
    await pool.query("SELECT 1");

    return true;
  } catch (error) {
    console.error("Database health check failed:", databaseErrorSummary(error));

    return false;
  }
};

// --------------------------------------------------
// 6. DATABASE CONNECTION WITH AUTOMATIC RETRIES
// --------------------------------------------------

export const connectDatabase = async (
  maxAttempts = 5,
): Promise<void> => {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");

      console.info(
        "Neon PostgreSQL database connected successfully",
      );

      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        console.error(
          "Failed to connect to the configured Neon PostgreSQL database after all retry attempts:",
          databaseErrorSummary(error),
        );

        throw new Error("Unable to connect to the configured Neon PostgreSQL database.");
      }

      const delay = Math.min(
        500 * 2 ** (attempt - 1),
        5_000,
      );

      console.warn(
        `Database connection attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms.`,
      );

      await sleep(delay);
    }
  }
};

// --------------------------------------------------
// 7. CHECK WHETHER HMS SCHEMA EXISTS
// --------------------------------------------------

export const schemaExists = async (): Promise<boolean> => {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.schemata
        WHERE schema_name = 'hms'
      ) AS exists
    `,
  );

  return result.rows[0]?.exists ?? false;
};

// --------------------------------------------------
// 8. DATABASE MIGRATION / TABLE STATE
// --------------------------------------------------

export const migrationState = async (): Promise<{
  applied: number;
  latest: string | null;
}> => {
  const result = await pool.query<{
    count: string;
    latest: string | null;
  }>(
    `
      SELECT
        COUNT(*)::text AS count,
        MAX(table_name) AS latest
      FROM information_schema.tables
      WHERE table_schema = 'hms'
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '\\_%'
    `,
  );

  return {
    applied: Number(result.rows[0]?.count ?? 0),
    latest: result.rows[0]?.latest ?? null,
  };
};

// --------------------------------------------------
// 9. GRACEFUL DATABASE SHUTDOWN
// --------------------------------------------------

export const closeDatabase = async (): Promise<void> => {
  try {
    await pool.end();

    console.info("Neon PostgreSQL database connections closed");
  } catch (error) {
    console.error("Failed to close database connections:", databaseErrorSummary(error));

    throw error;
  }
};

// --------------------------------------------------
// 10. DRIZZLE SQL EXPORT
// --------------------------------------------------

export { sql };
