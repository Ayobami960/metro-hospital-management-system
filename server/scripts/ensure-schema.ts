/**
 * Ensures the Postgres schema that every HMS table lives in exists.
 *
 * `drizzle-kit migrate` (and `push`) cannot run the generated SQL before the
 * `hms` namespace exists, because the migration creates `"hms"` types/tables
 * without a `CREATE SCHEMA` statement. The `db:*` scripts run this file first.
 *
 * - Uses only `DATABASE_URL`, the same connection configured for the API.
 * - Creates the schema only when missing; existing schemas, tables and data are
 *   left untouched.
 * - Never hides the driver error: prints SQLSTATE, message, detail, hint, schema
 *   and cause (pg reports TCP failures as `AggregateError` with an empty
 *   message, which previously produced `Failed to ensure schema "hms":`).
 * - Never grants privileges. When the role is not allowed to create the schema,
 *   prints the exact SQL an administrator must run.
 *
 * Usage: npm run db:ensure-schema
 */
import "dotenv/config";
import {
  describePgError,
  ensureSchema,
  formatPgError,
  isPermissionError,
  resolveMigrationConnection,
  schemaAdminSql,
  SchemaProvisioningError,
  type MigrationConnection,
} from "../src/db/schema-provisioning.js";

const schema = process.env.DB_SCHEMA?.trim() || "hms";

const targetLabel = (connection: MigrationConnection): string => {
  const { target } = connection;
  if (!target) return "the configured database";
  const port = target.port ? `:${target.port}` : "";
  return `${target.user}@${target.host}${port}/${target.database}`;
};

const printAdminSql = (connection: MigrationConnection): void => {
  for (const line of schemaAdminSql(schema, connection.target?.user ?? "app_role")) {
    console.error(line);
  }
};

const run = async (): Promise<number> => {
  let connection: MigrationConnection;
  try {
    connection = resolveMigrationConnection();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  console.log(
    `Ensuring schema "${schema}" on ${targetLabel(connection)} ` +
      `(${connection.source}, sslmode=${connection.ssl.mode ?? "unset"}).`,
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
    console.log(
      `Current role privileges in "${schema}": USAGE=${result.privileges.usage}, CREATE=${result.privileges.create}.`,
    );

    if (!result.privileges.usage || !result.privileges.create) {
      console.error(
        `Schema "${schema}" exists, but the application role cannot use/create objects in it, ` +
          "so migrations would fail. Ask a database administrator to run:",
      );
      printAdminSql(connection);
      return 1;
    }

    return 0;
  } catch (error) {
    if (error instanceof SchemaProvisioningError) {
      console.error(`Failed to ensure schema "${schema}": ${error.message}`);
    } else {
      console.error(`Failed to ensure schema "${schema}" on ${targetLabel(connection)}:`);
      console.error(formatPgError(error));
    }

    if (isPermissionError(error)) printAdminSql(connection);
    return 1;
  }
};

process.exitCode = await run();
