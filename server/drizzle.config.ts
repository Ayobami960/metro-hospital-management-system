import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolveMigrationConnection } from "./src/db/schema-provisioning.js";

dotenv.config();

/** Drizzle Kit and runtime use the same DATABASE_URL from the environment. */
const connection = resolveMigrationConnection();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: connection.url },
  /*
   * drizzle-kit introspects only `public` unless told otherwise, while every
   * HMS table lives in `hms`. Without this, `push`/`diff` cannot see existing
   * hms objects and replays `CREATE TYPE ...`/`CREATE TABLE ...` against them
   * (`type "acuity" already exists`). `public` is excluded on purpose: the
   * legacy portfolio tables must never be dropped by a push.
   */
  schemaFilter: ["hms"],
  strict: true,
  verbose: true,
});
