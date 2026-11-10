/**
 * Database diagnostics.
 *
 * Separates the failures that look alike in logs but have unrelated fixes:
 * DNS, TCP reachability (IPv4/IPv6), TLS verification, PostgreSQL
 * authentication, privileges, and schema/migration state. `ETIMEDOUT` on the
 * TCP step is an operator/network problem; it is never a schema problem.
 *
 * Credentials are never printed: only user, host, port and database are shown.
 *
 * Usage: npm run db:diagnose
 */
import "dotenv/config";
import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { Client } from "pg";
import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import ws from "ws";
import { describeDatabaseUrl } from "../src/config/database-ssl.js";
import {
  describePgError,
  formatPgError,
  resolveMigrationConnection,
} from "../src/db/schema-provisioning.js";

const schema = process.env.DB_SCHEMA?.trim() || "hms";
const TCP_TIMEOUT_MS = 8_000;

const results: Array<{ step: string; status: "ok" | "warn" | "fail"; detail: string }> = [];
const record = (step: string, status: "ok" | "warn" | "fail", detail: string): void => {
  results.push({ step, status, detail });
  const marker = status === "ok" ? "OK  " : status === "warn" ? "WARN" : "FAIL";
  console.log(`[${marker}] ${step}: ${detail}`);
};

const tcpProbe = (
  host: string,
  port: number,
  family: 4 | 6,
): Promise<{ ok: boolean; ms: number; error?: string }> =>
  new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect({ host, port, family, timeout: TCP_TIMEOUT_MS });
    const done = (result: { ok: boolean; ms: number; error?: string }): void => {
      socket.destroy();
      resolve(result);
    };
    socket.once("connect", () => done({ ok: true, ms: Date.now() - started }));
    socket.once("timeout", () => done({ ok: false, ms: Date.now() - started, error: "ETIMEDOUT" }));
    socket.once("error", (error: NodeJS.ErrnoException) =>
      done({ ok: false, ms: Date.now() - started, error: error.code ?? error.message }),
    );
  });

const tlsProbe = (
  host: string,
  port: number,
): Promise<{ ok: boolean; detail: string }> =>
  new Promise((resolve) => {
    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: true, timeout: TCP_TIMEOUT_MS },
      () => {
        const certificate = socket.getPeerCertificate();
        const subject = certificate?.subject?.CN ?? "(no CN)";
        const authorized = socket.authorized;
        const reason = authorized ? "" : ` (${String(socket.authorizationError)})`;
        const protocol = socket.getProtocol() ?? "unknown TLS";
        socket.destroy();
        resolve({
          ok: authorized,
          detail: `authorized=${authorized}${reason}, CN=${subject}, ${protocol}`,
        });
      },
    );
    socket.once("timeout", () => {
      socket.destroy();
      resolve({ ok: false, detail: "TLS handshake timed out" });
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      resolve({
        ok: false,
        detail: `TLS handshake failed: ${error.code ?? "unknown"}${error.message ? ` (${error.message})` : ""}`,
      });
    });
  });

/** Runtime path: Neon serverless over WebSocket (443), same as src/db/client.ts. */
const runtimeProbe = async (connectionString: string): Promise<void> => {
  net.setDefaultAutoSelectFamilyAttemptTimeout(5_000);
  neonConfig.webSocketConstructor = ws;
  const pool = new NeonPool({ connectionString, connectionTimeoutMillis: 15_000 });
  try {
    const { rows } = await pool.query<{ now: string }>("select now()::text as now");
    record(
      "runtime transport (Neon WebSocket)",
      "ok",
      `query succeeded, server time ${rows[0]?.now ?? "unknown"}`,
    );
  } catch (error) {
    record(
      "runtime transport (Neon WebSocket)",
      "fail",
      `${describePgError(error).code ?? "error"}: ${describePgError(error).message}`,
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
};

const run = async (): Promise<number> => {
  console.log("HMS database diagnostics (credentials hidden)\n");

  let connection;
  try {
    connection = resolveMigrationConnection();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const target = connection.target ?? describeDatabaseUrl(connection.url);
  if (!target) {
    console.error("The configured database URL could not be parsed as postgresql://");
    return 1;
  }
  const port = target.port ?? 5432;

  console.log(
    `migration target: ${target.user}@${target.host}:${port}/${target.database} ` +
      `(source ${connection.source}, sslmode=${connection.ssl.mode ?? "unset"})`,
  );
  if (connection.ssl.mode === "require") {
    console.log("note: sslmode=require is normalized to verify-full in memory (full verification).");
  }
  console.log("");

  // 1. DNS
  const [v4, v6] = await Promise.all([
    dns.resolve4(target.host).catch((error: NodeJS.ErrnoException) => error.code ?? "error"),
    dns.resolve6(target.host).catch((error: NodeJS.ErrnoException) => error.code ?? "error"),
  ]);
  const ipv4 = Array.isArray(v4) ? v4 : [];
  const ipv6 = Array.isArray(v6) ? v6 : [];
  record(
    "DNS",
    ipv4.length > 0 ? "ok" : "fail",
    `A=${ipv4.join(", ") || String(v4)}; AAAA=${ipv6.join(", ") || String(v6)}`,
  );

  // 2. TCP per address, IPv4 and IPv6 kept apart so a v6-only local preference
  // cannot mask a working IPv4 route (and vice versa).
  const tcpOutcomes = await Promise.all([
    ...ipv4.map(async (address) => ({ address, family: 4 as const, ...(await tcpProbe(address, port, 4)) })),
    ...ipv6.map(async (address) => ({ address, family: 6 as const, ...(await tcpProbe(address, port, 6)) })),
  ]);
  // A working family is enough: Node's autoSelectFamily falls back to it. An
  // unreachable IPv6 route on an IPv4-only network is common and not an error.
  const anyTcp = tcpOutcomes.some((outcome) => outcome.ok);
  for (const outcome of tcpOutcomes) {
    record(
      `TCP ${outcome.family === 6 ? "IPv6" : "IPv4"} ${outcome.address}:${port}`,
      outcome.ok ? "ok" : anyTcp ? "warn" : "fail",
      outcome.ok
        ? `connected in ${outcome.ms}ms`
        : `${outcome.error} after ${outcome.ms}ms` +
            (anyTcp ? " (other addresses reachable; not fatal)" : ""),
    );
  }

  // 3. TLS (independent of PostgreSQL auth)
  if (anyTcp) {
    const tlsResult = await tlsProbe(target.host, port);
    record("TLS", tlsResult.ok ? "ok" : "fail", tlsResult.detail);
  } else {
    record("TLS", "warn", "skipped: no TCP route to the endpoint");
  }

  // 4. PostgreSQL authentication + server identity
  const client = new Client({
    connectionString: connection.url,
    connectionTimeoutMillis: 20_000,
  });
  let connected = false;
  try {
    await client.connect();
    connected = true;
    const { rows } = await client.query<{
      user: string;
      database: string;
      version: string;
    }>(
      "select current_user as user, current_database() as database, current_setting('server_version') as version",
    );
    record(
      "PostgreSQL authentication",
      "ok",
      `authenticated as "${rows[0]?.user}" on "${rows[0]?.database}" (server ${rows[0]?.version})`,
    );
  } catch (error) {
    const details = describePgError(error);
    record(
      "PostgreSQL authentication",
      "fail",
      `${details.code ?? details.name}: ${details.message}`,
    );
    console.log(formatPgError(error));
  }

  // 5. Privileges + schema state (only meaningful once authenticated)
  if (connected) {
    try {
      const { rows } = await client.query<{
        can_create: boolean;
        schema_exists: boolean;
        usage: boolean | null;
        create: boolean | null;
      }>(
        `
          select has_database_privilege(current_database(), 'CREATE') as can_create,
                 exists(select 1 from information_schema.schemata where schema_name = $1) as schema_exists,
                 (select has_schema_privilege(current_user, $1, 'USAGE')) as usage,
                 (select has_schema_privilege(current_user, $1, 'CREATE')) as create
        `,
        [schema],
      );
      const row = rows[0];
      record(
        "database CREATE privilege",
        row?.can_create ? "ok" : "fail",
        row?.can_create ? "role may create schemas" : "role may not create schemas",
      );
      record(
        `schema "${schema}"`,
        row?.schema_exists ? "ok" : "fail",
        row?.schema_exists
          ? `exists; USAGE=${row.usage}, CREATE=${row.create}`
          : "missing (run npm run db:ensure-schema)",
      );
    } catch (error) {
      record("privileges", "fail", describePgError(error).message);
    }

    // 6. Migration bookkeeping + HMS object counts
    try {
      const { rows } = await client.query<{
        tables: number;
        enums: number;
        migrations: number | null;
        job_lock: string | null;
      }>(
        `
          select (select count(*)::int from information_schema.tables
                   where table_schema = $1 and table_type = 'BASE TABLE') as tables,
                 (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
                   where n.nspname = $1 and t.typtype = 'e') as enums,
                 (case when to_regclass('drizzle.__drizzle_migrations') is null then null
                       else (select count(*)::int from drizzle.__drizzle_migrations) end) as migrations,
                 to_regclass($1 || '.job_lock')::text as job_lock
        `,
        [schema],
      );
      const row = rows[0];
      record(
        "migration state",
        row && (row.tables ?? 0) > 0 ? "ok" : "fail",
        `${row?.tables ?? 0} tables, ${row?.enums ?? 0} enum types, ` +
          `${row?.migrations ?? "no"} recorded migration(s), job_lock=${row?.job_lock ?? "missing"}`,
      );
    } catch (error) {
      record("migration state", "fail", describePgError(error).message);
    }
  }

  await client.end().catch(() => undefined);

  // 7. Runtime transport (what the API actually uses)
  await runtimeProbe(connection.url);

  const failed = results.filter((result) => result.status === "fail");
  console.log("");
  if (failed.length > 0) {
    console.log(`${failed.length} check(s) failed: ${failed.map((f) => f.step).join(", ")}`);
    const tcpFailed = failed.some((f) => f.step.startsWith("TCP"));
    if (tcpFailed) {
      console.log(
        "No TCP route to Neon on port 5432 exists from this machine.\n" +
          "That is local network/egress (firewall, VPN, or a blocked port), not a schema problem.\n" +
          "The API uses WebSocket 443 and is unaffected; migrations need a route to 5432.",
      );
    }
    return 1;
  }

  console.log("All checks passed.");
  return 0;
};

process.exitCode = await run();
