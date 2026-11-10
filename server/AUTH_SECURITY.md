# Authentication & Security Upgrade (2026-11-09)

Password + optional TOTP + mandatory daily email secret code + hospital-ID Room
verification, enforced on the server. The existing UI, layouts, colours,
typography, spacing, animations, dashboards, React Router structure and database
conventions were kept; only the auth flow gained screens.

---

## 1. Features implemented

**Sign-in order (fixed, server-enforced)**
`password → TOTP (if enabled) → today's email code → hospital ID (staff, Room) → role dashboard`

The gate lives in `src/middleware/authenticate.ts`. Any protected request from a
session that has not finished a stage returns `403` with
`error.details.reason` = `TOTP_REQUIRED` | `DAILY_CODE_REQUIRED` |
`STAFF_ID_REQUIRED`. The client cannot skip a stage by navigating directly, and
`GET /me` (role, nav, permissions) stays closed until `READY`.

**Password layer** — reused better-auth (`/api/v1/auth/*`), unchanged tables.

**Public registration** — `POST /auth/sign-up/email` creates `PATIENT` only.
`role` and `status` are `input: false` additional fields and default to
`PATIENT`/`ACTIVE` in the schema.

**Staff provisioning** — no self-registration. An administrator with
`user:create` invites a staff member (`POST /users/invite`). The account is
created as `INVITED` with the role and hospital ID from the invitation; a
single-use token (SHA-256 digest at rest, 72 h TTL) is emailed as
`/activate-account?token=…`. Acceptance sets the password through better-auth's
own hasher and flips the account to `ACTIVE`. Re-use, expiry and revocation are
refused. Roles an inviter may grant: `SUPER_ADMIN` → ADMIN/DOCTOR/NURSE/
RECEPTION/PHARMACY/LABORATORY/BILLING; `ADMIN` → the same minus ADMIN. Neither
can create a SUPER_ADMIN, and a patient cannot invite at all.

**Optional TOTP 2FA** — enrollment (`POST /account/totp/enroll`) returns an
`otpauth://` URI and the base32 secret once. Settings → Security renders that
URI as a scannable QR code (`qrcode.react`, `QRCodeSVG`) with the base32 key as
a manual fallback; the secret is stored AES-256-GCM-encrypted
(`FIELD_ENCRYPTION_KEY`). Confirmation requires a valid
6-digit code and returns ten single-use recovery codes stored only as Argon2id
digests. Challenge verification is bound to the session row
(`session.mfa_verified_at`), so a password-only session never reaches a
dashboard. Five wrong codes lock the factor for 15 minutes.

**Mandatory daily email secret code** — 14 CSPRNG characters from an alphabet
without ambiguous glyphs (A–Z minus I/O, 2–9, configurable 12–16). One row per
user per hospital-local day (unique index), Argon2id digest only, single use via
a conditional `consumed_at IS NULL` update, 5 attempts, 24 h expiry, resend
limited, delivery status (`PENDING`/`SENT`/`FAILED`) and attempts recorded. The
plaintext is emailed once, never returned by an endpoint, never logged, and
redacted in the mail outbox.

**Hospital-ID Room verification** — separate from the daily code. The Room Page
(`/room`) shows the hospital-ID form for a signed-in staff account whose badge
is not yet verified. The value must match the authenticated account's
`user.hospital_id` (constant-time compare); it never grants access on its own,
and the gate keeps every staff API closed until it matches when an ID is on
file. Mismatches are audited.

**Administration UI** — `administration/users` lists staff, pending invitations
(resend/revoke), suspend/reactivate accounts, and can trigger the daily-code
batch manually.

---

## 2. Files

**New (server)**
| File | Purpose |
| --- | --- |
| `src/db/schema/security.ts` | `daily_verification_code`, `staff_invitation`, `job_lock`, `email_outbox` |
| `src/lib/secrets.ts` | CSPRNG code generation, Argon2id hash/verify, recovery codes |
| `src/lib/totp.ts` | TOTP/otpauth helpers over the encrypted secret |
| `src/services/email.service.ts` | SMTP / Resend / stub transport + delivery log |
| `src/services/daily-verification.service.ts` | Issue, verify (atomic), resend, batch dispatch |
| `src/services/two-factor.service.ts` | Enrollment, challenge, recovery codes, disable |
| `src/services/auth-progress.service.ts` | Stage evaluator + 403 reasons |
| `src/services/staff-invitation.service.ts` | Invite, resend, revoke, accept, status changes |
| `src/services/scheduler.service.ts` | DB-leased backend scheduler |
| `src/routes/account.routes.ts` | Account status, challenges, TOTP, hospital ID |
| `src/routes/users.routes.ts` | Staff directory, invitations, status, manual batch |
| `src/routes/invitations.routes.ts` | Public invitation preview + acceptance |
| `db/migrations/2026-11-09_auth_security.sql` | Migration for all of the above |
| `AUTH_SECURITY.md` | This document |

**Modified (server)**
`src/db/schema/identity.ts` (hospital ID, Room timestamp, session MFA columns,
2FA comment), `src/db/schema/enums.ts` (`DAILY_CODE` mail purpose),
`src/db/schema/index.ts`, `src/lib/auth.ts` (custom 2FA instead of the plaintext
plugin), `src/middleware/authenticate.ts` (gates + session MFA state),
`src/config/env.ts`, `src/app.ts`, `src/server.ts`, `env.example`.

**New (client)**
`routes/login-verify.tsx` (TOTP + daily code), `routes/activate-account.tsx`,
`routes/protected/administration/UsersPage.tsx`.

**Modified (client)**
`routes/login.tsx` (password → verify), `routes/register.tsx` (patient
registration form), `routes/room.tsx` (hospital-ID form), `routes.ts` (three
routes), `routes/protected/layout.tsx` (403 → verify screen),
`components/globals/settings-view.tsx` (2FA card + QR), `services/api/endpoints.ts`,
`services/auth/auth.api.ts`, `hooks/auth/use-session.ts`,
`types/api.types.ts`.

---

## 3. Migration

`server/db/migrations/2026-11-09_auth_security.sql`:

- `hms.user`: `hospital_id text` (+ unique index), `room_verified_at timestamptz`
- `hms.session`: `mfa_verified_at timestamptz`, `mfa_method text`
- `hms.email_purpose`: new value `DAILY_CODE` (outside the transaction)
- `hms.daily_verification_code` + unique `(user_id, verification_date)`
- `hms.staff_invitation` + unique `token_hash`, index on `lower(email)`
- `hms.job_lock`

Apply:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/2026-11-09_auth_security.sql
```

Review the current Neon schema against the Drizzle schema before applying any migration. No
migration is applied automatically at application startup.

---

## 4. Endpoints

**Reused (unchanged)**
`POST /api/v1/auth/sign-up/email`, `/auth/sign-in/email`, `/auth/sign-out`,
`/auth/get-session`, `/auth/change-password` (better-auth), `GET /api/v1/me`
(role, nav, permissions, scoping ids), the permission matrix in
`config/permissions.ts`, `writeAudit`/`writePhiAccess`, `hms.email_outbox`, and
the `{ data, meta }` envelope.

**Implemented**
| Method | Path | Access |
| --- | --- | --- |
| GET | `/account/status` | any session (challenge stage) |
| POST | `/account/verification/daily-code/verify` | session, TOTP cleared |
| POST | `/account/verification/daily-code/resend` | session, TOTP cleared |
| POST | `/account/verification/totp` | session |
| POST | `/account/verification/recovery-code` | session |
| POST | `/account/totp/enroll` | fully verified session |
| POST | `/account/totp/enroll/confirm` | fully verified session |
| POST | `/account/totp/disable` | fully verified session + password |
| POST | `/account/totp/recovery-codes` | fully verified session + password |
| GET | `/account/staff-id` | staff session |
| POST | `/account/staff-id/verify` | staff session |
| GET | `/users` | `user:read` |
| GET | `/users/roles` | `user:read` |
| GET | `/users/invitations` | `user:read` |
| POST | `/users/invite` | `user:create` |
| POST | `/users/invitations/:id/resend` | `user:create` |
| DELETE | `/users/invitations/:id` | `user:create` |
| PATCH | `/users/:id/status` | `user:deactivate` |
| POST | `/users/daily-codes/dispatch` | `settings:write` |
| GET | `/invitations/:token` | public |
| POST | `/invitations/accept` | public |

`GET /me` is unchanged and remains the only source of nav/permissions.

---

## 5. Scheduling

- Backend-only: `startAuthScheduler()` runs in the API process (no browser timers).
- First tick runs immediately on boot (catch-up after restart), then every
  `AUTH_SCHEDULER_INTERVAL_MS` (default 60 s).
- Work is only done once the hospital-local hour is at least
  `DAILY_CODE_SEND_HOUR` (default 06:00 in `CLINIC_TIMEZONE`); a manual run
  (`POST /users/daily-codes/dispatch`) overrides the hour.
- Concurrency: `acquireJobLock()` takes a `hms.job_lock` lease
  (`AUTH_JOB_LOCK_SECONDS`, default 120 s) with a conditional upsert, so only one
  replica sends. The lock row records `last_run_at`, `last_status`, `last_detail`.
- Durability/idempotency: `daily_code_user_date_uq` makes a re-run a no-op, so a
  crash mid-batch finishes the missing recipients on the next tick. Failed
  deliveries are retried up to `DAILY_CODE_RESEND_MAX + 2` attempts.
- A code is also issued on demand by `GET /account/status` (idempotent), so a
  sign-in before the send hour still receives mail.
- Disable with `AUTH_SCHEDULER_ENABLED=false` (e.g. worker-only deployments).

---

## 6. Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `EMAIL_PROVIDER` | `stub` | `smtp` or `resend` in real environments |
| `SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM` | — | required for `smtp` |
| `RESEND_API_KEY` | — | required for `resend` |
| `FIELD_ENCRYPTION_KEY` | — | base64 32 bytes; **required in production** (TOTP secret) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_ORIGIN` | dev defaults | production requires a real secret |
| `CLINIC_TIMEZONE` | `America/New_York` | drives the daily period |
| `DAILY_CODE_LENGTH` | `14` | clamped 12–16 |
| `DAILY_CODE_TTL_MINUTES` | `1440` | expiry |
| `DAILY_CODE_MAX_ATTEMPTS` | `5` | per issued code |
| `DAILY_CODE_SEND_HOUR` | `6` | hospital-local hour |
| `DAILY_CODE_RESEND_MAX` | `3` | additional sends per day |
| `AUTH_SCHEDULER_ENABLED` | `true` | |
| `AUTH_SCHEDULER_INTERVAL_MS` | `60000` | |
| `AUTH_JOB_LOCK_SECONDS` | `120` | lease length |
| `INVITATION_TTL_HOURS` | `72` | |
| `TOTP_ISSUER` | `HOSPITAL_NAME` | authenticator label |
| `TOTP_WINDOW` | `1` | ±30 s drift |
| `TOTP_MAX_ATTEMPTS` / `TOTP_LOCK_MINUTES` | `5` / `15` | lockout |
| `TOTP_RECOVERY_CODE_COUNT` | `10` | |

---

## 7. Security measures

- Argon2id (`m=19456, t=2, p=1`) for daily codes and recovery codes; AES-256-GCM
  for the TOTP secret; SHA-256 only for high-entropy invitation tokens.
- Daily code: never returned, never logged, redacted from `email_outbox`, single
  use enforced atomically, attempt-limited, expiring, resend-limited.
- Invitation: single use atomically, expiring, revocable, one active token per
  address (older ones revoked), token never stored in plaintext, role and hospital
  ID fixed by the invitation row.
- TOTP: failed-attempt counter + timed lock, single-use recovery codes removed on
  use, password re-checked before disabling/regenerating.
- Gates enforced in middleware, not in the client; responses carry stable reason
  codes. Every challenge and administrative action is audited.
- Suspension/deactivation revokes all sessions; self-status changes are blocked;
  SUPER_ADMIN accounts are protected from ADMIN edits.
- Hospital ID uses a constant-time comparison, is validated only against the
  authenticated account, and is audited on mismatch.
- HTTP rate limiting: global limiter plus 12 attempts / 15 min per account on
  `/account/*` (IP fallback via `ipKeyGenerator`).
- Better-auth `Origin` validation and httpOnly session cookies remain in force.

---

## 8. Remaining dependencies / known limitations

1. **Migration not applied to the configured database.** `.env` points at Neon;
   only the local dev database was migrated. Run the SQL before deploying.
2. **Email credentials.** `EMAIL_PROVIDER=stub` writes redacted outbox rows and
   delivers nothing. Set `smtp`/`resend` + credentials for real delivery.
3. **Sessions issued before deploy** have `mfa_verified_at = NULL`. Users without
   TOTP are unaffected; users with TOTP must clear the challenge once.
5. **Frontend checks are type/build only** — no browser click-through was run.
6. Existing seeded staff have no `hospital_id`, so the Room form is optional for
   them until an ID is assigned through an invitation or admin update.

---

## 9. Verification status

Database-mutating smoke fixtures have been removed. The existing automated tests can be run with
`npm test`; review the current Neon schema and the proposed migration before any database change.
