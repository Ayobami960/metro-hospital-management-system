import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { closeDatabase, connectDatabase } from "./db/client.js";

await connectDatabase();
const app = createApp();

// `sslmode` aliases are normalized to explicit `verify-full` at config load; say
// so once at boot, and flag the one deliberate exception (libpq compatibility).
const databaseSsl = env.databaseSsl.runtime;
if (databaseSsl.normalizedFrom) {
  logger.info(
    { sslmode: databaseSsl.mode, normalizedFrom: databaseSsl.normalizedFrom },
    "PostgreSQL SSL mode normalized to explicit verify-full",
  );
}
if (databaseSsl.libpqCompat) {
  logger.warn(
    "uselibpqcompat=true is set: PostgreSQL TLS follows libpq semantics instead of full certificate verification",
  );
}

const server = app.listen(env.port, () => {
  logger.info({ port: env.port, env: env.nodeEnv }, "HMS API listening");
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, "shutting down");
  server.close(() => {
    void closeDatabase().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
