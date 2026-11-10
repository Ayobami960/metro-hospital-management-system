# Authentication & Security (updated 2026-11-10)

The Daily Access Code is a **staff Room Access verification**, not a registration
code, password, or account-verification OTP. Four mechanisms are kept separate:

| Mechanism | Purpose | Who |
| --- | --- | --- |
| `EMAIL_VERIFICATION` | Prove control of the registered email after sign-up or invitation acceptance | New patients and invited staff |
| `DAILY_ROOM_ACCESS` | Prove control of a registered hospital email before the staff login form opens | DOCTOR, NURSE, RECEPTION, PHARMACY, LABORATORY, BILLING |
| `PATIENT_LOGIN` | Second step of a returning patient sign-in | PATIENT |
| `ADMIN_2FA` | Optional authenticator second factor | ADMIN, SUPER_ADMIN (only when enabled) |

ADMIN, SUPER_ADMIN and PATIENT never receive a Daily Access Code.

---

## 1. Flows

### New patient

`Register → EMAIL_VERIFICATION OTP → profile completion → patient dashboard`

- Public sign-up creates a `PATIENT` only; `role` is `input: false`.
- A session is created so the verification screen can work, but every dashboard
  route returns `403` with `reason: EMAIL_VERIFICATION_REQUIRED` until the code
  is verified.
- After verification the account is held at `ONBOARDING_REQUIRED` until the
  mandatory profile form is submitted (`hms.patient` row + MRN).

### New staff

`Administrator invitation → accept link + password → EMAIL_VERIFICATION OTP → profile completion → role dashboard`

- Staff cannot self-register.
- The invitation fixes the role and hospital ID; acceptance never accepts a role
  from the request body.
- Acceptance sets `emailVerified = false`, clears onboarding, and issues an
  `EMAIL_VERIFICATION` code.
- First-time staff may sign in without Room Access **only** while email
  verification or onboarding is outstanding. The dashboard remains gated by the
  progress service.

### Returning staff

`Room Access page → click verification card → hospital email → DAILY_ROOM_ACCESS OTP → role-specific login form → normal password → role dashboard`

- The Room Access page is `/room`. It shows the hospital verification banner and
  a clickable “Verify Your Hospital Identity” card. The email form opens only
  after the card is clicked.
- `POST /room-access/send` returns the same message for every address, so it does
  not disclose whether an account exists, its role, or its status.
- A successful code creates a short-lived, httpOnly Room Access authorization.
  It is **not** a better-auth session and cannot call protected endpoints.
- The role shown on the login form comes from the server-side authorization, not
  `?role=`. A valid doctor authorization cannot sign in a nurse account.
- The normal password is still required. The authorization is consumed atomically
  when the staff session is created; a token issued to another account or role is
  refused. Expired authorizations are refused.

### Returning patient

`Patient login → email + password → PATIENT_LOGIN OTP → patient dashboard`

Patients never see the Room Access page or receive a Daily Access Code.

### Administrator

`Normal login → email + password → READY (2FA disabled) | TOTP challenge (2FA enabled) → dashboard`

- 2FA is optional and managed from account security settings.
- Enrollment and management are restricted to ADMIN/SUPER_ADMIN.
- A password-only session cannot reach a dashboard while TOTP is enabled.
- Disabling or regenerating recovery codes requires the current password from a
  session that already cleared 2FA.
- TOTP secrets are AES-256-GCM encrypted; recovery codes are Argon2id digests and
  single use.

---

## 2. Server authority

`src/services/auth-progress.service.ts` is the single source of truth for the
remaining signed-in work:

`EMAIL_VERIFICATION → ONBOARDING → TOTP → PATIENT_OTP → READY`

`src/middleware/authenticate.ts` enforces it on every protected request and
returns `403` with a stable `error.details.reason`:
`EMAIL_VERIFICATION_REQUIRED`, `ONBOARDING_REQUIRED`, `TOTP_REQUIRED`, or
`PATIENT_OTP_REQUIRED`. `GET /me` and every dashboard endpoint stay closed until
`READY`.

The Room Access pre-login gate lives in the better-auth
`databaseHooks.session.create.before` hook in `src/lib/auth.ts`. It applies to
staff whose email is verified and whose onboarding is complete. It consumes the
Room Access authorization and clears its cookie.

---

## 3. Data model and migrations

- `hms.otp_code` — purpose-scoped codes: CSPRNG generation, Argon2id digest only,
  expiry, attempt counter, max attempts, single-use `consumed_at`, delivery
  status, created/sent timestamps.
- `hms.room_access_session` — SHA-256 digest of the random cookie token, user,
  server-side role, expiry, consumption.
- `hms.user.email_verified_at`, `hms.user.onboarding_completed_at`.
- `hms.otp_purpose` enum: `EMAIL_VERIFICATION`, `DAILY_ROOM_ACCESS`,
  `PATIENT_LOGIN`, `ADMIN_2FA`.
- `hms.email_purpose` gained the matching mail purposes.
- The legacy `hms.daily_verification_code` table is retained for existing data
  but no authentication path reads it.

Migrations (Drizzle, schema `hms`):

1. `drizzle/0000_bright_maggott.sql` — baseline.
2. `drizzle/0001_silky_lady_vermin.sql` — OTP/Room Access tables, enums, user
   verification/onboarding columns, backfills for existing accounts.
3. `drizzle/0002_patient_mrn_sequence.sql` — creates the missing
   `hms.patient_mrn_seq` used by patient onboarding and records its position after
   any existing MRNs.

Apply:

```bash
cd server
npm run db:migrate
```

All three migrations have been applied to the configured Neon database. The
migration preserves existing users, sessions, invitations and patient data.

---

## 4. Endpoints

Public / pre-login:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/auth/sign-up/email` | better-auth; creates PATIENT, issues email OTP |
| POST | `/api/v1/auth/sign-in/email` | better-auth; staff gate + progress gate |
| POST | `/api/v1/room-access/send` | public, generic response, eligible active verified staff only |
| POST | `/api/v1/room-access/verify` | public, issues Room Access cookie and role login path |
| GET | `/api/v1/room-access/session` | reads active Room Access authorization |
| DELETE | `/api/v1/room-access/session` | revokes authorization/cookie |
| GET | `/api/v1/invitations/:token` | invitation preview |
| POST | `/api/v1/invitations/accept` | single-use acceptance |

Session / onboarding:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/account/status` | current stage; issues pending email/patient code when allowed |
| POST | `/api/v1/account/verification/email` | `EMAIL_VERIFICATION` only |
| POST | `/api/v1/account/verification/email/resend` | cooldown/rate limited |
| POST | `/api/v1/account/verification/patient-otp` | `PATIENT_LOGIN` only |
| POST | `/api/v1/account/verification/patient-otp/resend` | cooldown/rate limited |
| POST | `/api/v1/account/verification/totp` | ADMIN 2FA |
| POST | `/api/v1/account/verification/recovery-code` | ADMIN recovery |
| POST | `/api/v1/account/totp/enroll` / `confirm` | admins only |
| POST | `/api/v1/account/totp/disable` | admins only, password confirmation |
| POST | `/api/v1/account/totp/recovery-codes` | admins only, password confirmation |
| GET/POST | `/api/v1/account/onboarding` | profile data / completion |
| POST | `/api/v1/account/onboarding/avatar` | optional profile image |
| POST | `/api/v1/account/patient-registration` | saves the five-step registration profile before verification |
| GET/PUT | `/api/v1/account/patient-profile/draft` | cross-device wizard draft; no patient record, cleared on completion |
| POST/GET/DELETE | `/api/v1/account/documents[/:id]` | private medical documents during registration/completion |

Administrator routes under `/api/v1/users` (all permission-checked server side):

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/users` | search, role/status/department/verification filters, sorting, pagination |
| GET | `/api/v1/users/statistics` | live totals, statuses, role counts, pending invitations |
| GET | `/api/v1/users/:id` | account, department, patient and invitation detail |
| POST | `/api/v1/users` / `/api/v1/users/invite` | create or invite staff/patient (invitation-backed) |
| PATCH | `/api/v1/users/:id` | name, phone, hospital ID, department, specialty, title |
| PATCH | `/api/v1/users/:id/role` | guarded role change; revokes sessions and resets onboarding |
| PATCH | `/api/v1/users/:id/status` | suspend/reactivate; revokes sessions and pending invitations |
| GET/POST/DELETE | `/api/v1/users/invitations[/:id[/resend]]` | list, resend and revoke single-use invitations |

Role login paths returned by Room Access:

| Role | Path |
| --- | --- |
| DOCTOR | `/login?role=doctor` |
| NURSE | `/login?role=nurse` |
| RECEPTION | `/login?role=reception` |
| PHARMACY | `/login?role=pharmacy` |
| LABORATORY | `/login?role=lab` |
| BILLING | `/login?role=billing` |

---

## 5. Frontend routes

- `/register` — five-step patient sign-up; lands on `/verify-email`.
- `/login` — role-aware sign-in. Staff portals require an active Room Access
  authorization; administrators and patients do not. A tampered `?role=` is
  corrected from the server-stored Room Access role.
- `/room` — hospital verification banner, clickable card, email form, code form,
  expiry/error states, resend countdown, automatic role redirect.
- `/verify-email` — email verification (`/login/verify` remains the challenge hub for TOTP and patient OTP).
- `/patient/complete-profile` — mandatory five-step patient profile wizard (`/complete-profile` also serves staff onboarding).
- `/accept-invitation` — invitation acceptance (the legacy `/activate-account` URL still works); signs in and continues to email
  verification.
- Protected layout sends `ONBOARDING_REQUIRED` to `/complete-profile` and other
  outstanding stages to `/login/verify`; patients are routed to
  `/patient/complete-profile` once their email is verified.
- `/administration/users` — Admin User Management (statistics, table, create/invite,
  view/edit, department, role, suspend/reactivate, invitation lifecycle).

---

## 6. Security properties

- Passwords remain better-auth credentials; no custom password storage.
- OTPs are CSPRNG-generated, Argon2id-hashed, purpose-bound, expiring,
  attempt-limited, resend-cooldown and hourly-limited, and single-use.
- Purpose is part of every OTP query, so an email-verification code cannot satisfy
  patient login or Room Access.
- Codes and invitation links are redacted from `hms.email_outbox` and never
  returned by the API or written to logs.
- Room Access codes are sent only to active, verified accounts in the six staff
  roles. The public response never reveals account existence, role or status.
- Room Access authorization is httpOnly, SameSite=Lax, Secure in production,
  short-lived, hashed at rest, one active authorization per account, and consumed
  on password sign-in.
- Staff roles always come from `hms.user` / `hms.room_access_session`, never from
  request parameters.
- Account status is checked when sending and verifying codes, creating sessions,
  reading Room Access authorizations, and consuming them.
- Admin 2FA is bound to `session.mfa_verified_at`; failed TOTP does not make the
  session READY.
- Better-auth `Origin` validation and httpOnly session cookies remain in place.
- Authentication events are audited (`auth.*`, `identity.*`).

---

## 7. Environment

Purpose-scoped OTP settings:

| Variable | Default |
| --- | --- |
| `OTP_TTL_MINUTES` | 15 (Room Access) |
| `EMAIL_VERIFICATION_TTL_MINUTES` | 60 |
| `PATIENT_LOGIN_TTL_MINUTES` | 10 |
| `ROOM_ACCESS_SESSION_TTL_MINUTES` | 10 |
| `OTP_MAX_ATTEMPTS` | 5 |
| `OTP_RESEND_COOLDOWN_SECONDS` | 45 |
| `INVITATION_TTL_HOURS` | 24 (never longer than 24 hours) |

Legacy `DAILY_CODE_*` and `AUTH_SCHEDULER_*` variables are still accepted so
existing deployments boot, but they no longer affect sign-in. No scheduler runs.

Mail: `EMAIL_PROVIDER` = `smtp` or `resend`; SMTP or Resend credentials and
`MAIL_FROM` are required for real delivery. `FIELD_ENCRYPTION_KEY` is required in
production for the TOTP secret.

---

## 8. Verification performed

- Server and client TypeScript checks pass.
- Neon migrations `0001` and `0002` applied successfully; sequence and new tables
  verified.
- 105 API checks passed against Neon through the running API, covering:
  patient registration/email OTP/onboarding, patient login OTP (wrong, expired,
  resend, valid, cross-purpose rejection), all six staff Room Access roles,
  role-specific redirects, no-session-without-password, cross-role refusal,
  used/expired code refusal, suspended/unverified/admin exclusion, admin 2FA
  disabled/enabled/wrong/valid/disable, SUPER_ADMIN login, and authorization
  boundaries.
- A separate 10-check staff invitation test passed: invite delivery, preview,
  acceptance, first-time sign-in without Room Access, email verification,
  onboarding, returning-staff Room Access requirement, and final dashboard.
- Temporary test users and patient rows were removed. The configured SMTP
  transport accepted a real delivery check to the hospital mailbox.
