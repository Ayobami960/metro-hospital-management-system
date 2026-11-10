
import "dotenv/config";
import { resolve } from "node:path";
import { applyMigrations } from "../src/db/migrator.js";
import {
  describePgError,
  formatPgError,
  isPermissionError,
  resolveMigrationConnection,
  schemaAdminSql,
  SchemaProvisioningError,
} from "../src/db/schema-provisioning.js";

const schema = process.env.DB_SCHEMA?.trim() || "hms";
const migrationsFolder = resolve(process.cwd(), "drizzle");

const run = async (): Promise<number> => {
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
    `Applying migrations from ${migrationsFolder} to ${endpoint} ` +
      `(${connection.source}, sslmode=${connection.ssl.mode ?? "unset"}).`,
  );

  try {
    const result = await applyMigrations(connection, {
      migrationsFolder,
      schema,
      onSchemaReady: (ready) => {
        console.log(
          ready.created
            ? `Created schema "${schema}".`
            : `Schema "${schema}" already exists.`,
        );
      },
      onRetry: (attempt, error, retryInMs) => {
        const details = describePgError(error);
        console.warn(
          `Attempt ${attempt} failed (${details.code ?? details.name}: ${details.message}). ` +
            `Retrying in ${retryInMs / 1000}s...`,
        );
      },
    });

    console.log(
      `Migrations applied successfully (attempt ${result.attemptsUsed}).`,
    );
    return 0;
  } catch (error) {
    if (error instanceof SchemaProvisioningError) {
      console.error(`Cannot migrate schema "${schema}": ${error.message}`);
    } else {
      console.error(`Migration failed on ${endpoint}:`);
      console.error(formatPgError(error));
    }

    if (isPermissionError(error)) {
      for (const line of schemaAdminSql(schema, target?.user ?? "app_role")) {
        console.error(line);
      }
    }
    return 1;
  }
};

process.exitCode = await run();
