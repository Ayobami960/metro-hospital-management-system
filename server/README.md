# Hospital Management System — API (`server/`)

Node 20+ · TypeScript · Express 5 · Drizzle ORM · PostgreSQL (Neon) · better-auth · Zod · EdgeStore.

The API source, Drizzle schema, and migration runner are under `src/` and `drizzle/`.

- Decisions: `../docs/decisions.md`
- Permission matrix: `../docs/permissions.md`
- API reference: `../docs/api.md` (machine-readable: `GET /api/v1/openapi.json`)
- Frontend follow-ups: `../docs/frontend-changes.md`

## Quick start

Set `DATABASE_URL` and the other required settings in `.env` first. Review the current Neon schema
against the committed migrations before choosing to apply any migration.

```bash
cd server
npm install
npm run dev                   # http://localhost:8011
```

Verify: `curl localhost:8011/api/v1/health` → `{"data":{"status":"ok",...},"meta":null}` and
`curl localhost:8011/api/v1/health/ready` → `database: "ok"` plus the applied-table count.

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `start` | Run the API |
| `build` / `typecheck` | Compile and typecheck the backend |
| `test` | Run the existing Node test files without a database override |
| `db:ensure-schema` | Check/create the `hms` schema on `DATABASE_URL` |
| `db:generate` | Generate a migration from the Drizzle schema |
| `db:migrate` | Apply reviewed migrations on `DATABASE_URL` |
| `db:diagnose` | Diagnose the configured database connection |
| `db:studio` | Open Drizzle Studio on `DATABASE_URL` |

`db:push` is an alias for the reviewed migration runner; it does not run `drizzle-kit push`.

## Environment

Every variable is validated at boot by `src/config/env.ts`. The API refuses to start if
`DATABASE_URL` is missing, malformed, or the database cannot be reached. Production additionally
requires `FIELD_ENCRYPTION_KEY`, a real `BETTER_AUTH_SECRET`, and the configured Cloudinary keys.

Secrets that must never appear in code or logs: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`FIELD_ENCRYPTION_KEY`, `RESEND_API_KEY`, `SMTP_PASS`, `STRIPE_SECRET_KEY`, `EDGESTORE_*`.

## Database and Neon branches

Runtime, Drizzle Kit, and migration scripts all resolve the same `DATABASE_URL` from `.env`.
Review generated migration SQL and compare it with the existing Neon schema before applying it.
Migrations are never generated or applied automatically at API startup.

## Tests

Run `npm test` for the repository's existing tests. No test database is configured or injected by
the test runner.

## Deploy

1. Build with `npm run build`; start with `npm start`.
2. Review and apply `npm run db:migrate` against the target Neon database before switching traffic.
3. Set `NODE_ENV=production`, `TRUST_PROXY` to match the platform, and `FRONTEND_ORIGIN` to the
   deployed SPA origin (CORS allows only that origin).
4. Health check: `GET /api/v1/health/ready` (503 until the database is reachable and migrated).

## Conventions to keep

- Parameterised queries only (Drizzle builder or `sql` templates); no string-built SQL.
- Multi-step writes inside transactions; list endpoints paginate, sort and filter server-side.
- Derived values (age, BMI, queue position, wait time, invoice status, flags) are computed on read.
- Money is integer minor units; timestamps are UTC `timestamptz` with a configurable clinic zone.
- PHI never reaches the logs; the pino redaction list is the guard. Chart reads write a PHI access row.
- Signed clinical records are immutable; corrections are amendments that link to the original.

## Legacy portfolio API

The original README content for the portfolio/CMS API (setup on port 8000/8080, ImageKit uploads,
Socket.IO chat, Vercel notes) is preserved in git history and in `../docs/legacy-modules.md`. That
service is not deployed from this tree any more and its code remains as-is pending a decision.
