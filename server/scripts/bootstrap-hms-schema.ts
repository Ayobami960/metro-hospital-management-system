/**
 * One-command bootstrap for a fresh HMS database.
 *
 * Creates the `hms` schema (idempotently) through the same code path as
 * `db:ensure-schema`, then applies the committed Drizzle migrations, so a
 * brand-new database can be used by the API, the user-creation scripts and any
 * other HMS tooling without copy-pasting `psql` commands.
 *
 * The previous implementation shelled out to `psql`, which fails when the
 * binary is absent (and hid its error behind an exit code). This version uses
 * pg directly and reports the underlying PostgreSQL error if provisioning
 * fails.
 *
 * Usage: DATABASE_URL=... npm run db:bootstrap
 */
import "dotenv/config";
import { resolve } from "node:path";
import { applyMigrations } from "../src/db/migrator.js";
import {
  describePgError,
  ensureSchema,
  formatPgError,
  isPermissionError,
  resolveMigrationConnection,
  schemaAdminSql,
  SchemaProvisioningError,
} from "../src/db/schema-provisioning.js";

const schema = process.env.DB_SCHEMA?.trim() || "hms";
const migrationsFolder = resolve(process.cwd(), "drizzle");

const run = async (): Promise<number> => {
  console.log("Bootstrapping the HMS schema in the target database...");

  let connection;
  try {
    connection = resolveMigrationConnection();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const { target } = connection;
  const endpoint = target
    ? `${target.user}@${target.host}${target.port ? `:${target.port}` : ""}/${target.database}`
    : "the configured database";

  console.log(
    `Target: ${endpoint} (${connection.source}, sslmode=${connection.ssl.mode ?? "unset"}).`,
  );

  try {
    const result = await ensureSchema(connection, schema, {
      onRetry: (attempt, error, retryInMs) => {
        const details = describePgError(error);
        console.warn(
          `Connection attempt ${attempt} failed (${details.code ?? details.name}: ${details.message}). ` +
            `Retrying in ${retryInMs / 1000}s...`,
        );
      },
    });

    console.log(
      result.created
        ? `Created schema "${schema}".`
        : `Schema "${schema}" already exists; nothing to create.`,
    );

    if (!result.privileges.usage || !result.privileges.create) {
      console.error(
        `The current role cannot use/create objects in schema "${schema}", so migrations cannot run. ` +
          "Ask a database administrator to run:",
      );
      for (const line of schemaAdminSql(schema, target?.user ?? "app_role")) console.error(line);
      return 1;
    }
  } catch (error) {
    if (error instanceof SchemaProvisioningError) {
      console.error(`Failed to ensure schema "${schema}": ${error.message}`);
    } else {
      console.error(`Failed to ensure schema "${schema}" on ${endpoint}:`);
      console.error(formatPgError(error));
    }

    if (isPermissionError(error)) {
      for (const line of schemaAdminSql(schema, target?.user ?? "app_role")) console.error(line);
    }
    return 2;
  }

  console.log("Applying migrations via drizzle-orm...");
  try {
    await applyMigrations(connection, {
      migrationsFolder,
      schema,
      onRetry: (attempt, error, retryInMs) => {
        const details = describePgError(error);
        console.warn(
          `Attempt ${attempt} failed (${details.code ?? details.name}: ${details.message}). ` +
            `The migration rolled back; retrying in ${retryInMs / 1000}s...`,
        );
      },
    });
  } catch (error) {
    console.error("Migration failed.");
    console.error(formatPgError(error));
    return 3;
  }

  console.log("HMS schema is ready.");
  return 0;
};

process.exitCode = await run();
