# HMS frontend → API integration status

Every screen in `clients/app` now reads and writes real backend data. The static
fixture layer that used to feed the dashboards (`clients/app/data/*`) is gone
except for navigation/role configuration, which is not server data.

## Stack

| Concern | Implementation |
| --- | --- |
| HTTP | one Axios instance — `services/api/client.ts` (base `VITE_API_URL`, bearer session, `unwrap` / `unwrapPage`) |
| Paths | `services/api/endpoints.ts` — no path is hardcoded in a component |
| Server state | TanStack Query — `hooks/<module>/<module>.hooks.ts`, keys in `lib/query-keys.ts` |
| Forms | react-hook-form + zod (`hooks/use-zod-form` style usage per screen) |
| Client state | Zustand — `stores/app.store.ts` (sidebar, theme, notification drawer) |
| Tables | server-side paging/search via `ServerPager` + `hooks/use-debounced-value` |
| Presentation | `lib/format.ts` (`money`, `compactMoney`, `pct`, `label`, `formatDate`, …) |
| Shared UI states | `components/globals/query-state.tsx` (`QueryLoading`, `QueryError`, `QueryEmpty`, `InlineEmpty`) |

## Module status

`src` = data source before the migration. "Static" means a `@/data` fixture;
"API" means React Query against the endpoint shown.

### Administration

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Admin dashboard | static | `GET /dashboards/admin`, `GET /operations/counts`, `GET /operations/health`, `GET /reports/overview` | API |
| Doctors | static | `GET/POST /doctors`, `PATCH /doctors/:id`, `GET /reference/specialties`, `GET /reference/departments` | API |
| Patients | static | `GET /patients` (server search/paging), `GET /patients/:id`, `GET /patients/:id/eligibility`, `GET /patients/:id/clinical-summary` | API |
| Departments | static | `GET/POST /departments`, `GET /reference/departments`, `GET /reference/specialties` | API |
| Appointments | static | `GET /appointments`, `POST /appointments`, `PATCH /appointments/:id/approve|cancel` | API |
| Billing & finance | static | `GET /billing/dashboard`, `GET /billing/reports`, `GET /invoices`, `GET /claims` | API |
| Rooms & beds | static | `GET/POST /rooms`, `GET /rooms/:id/beds`, `GET /beds`, `GET /beds` assign/release | API |
| Reports | static | `GET /reports/catalogue`, `GET /reports/financial`, `GET /reports/overview` | API |
| System logs | static | `GET /audit-logs` (server filters/paging), `GET /exports/audit-logs` | API |
| Settings | static | `GET/PATCH /me/profile`, `GET/PATCH /me/preferences`, `GET /me/sessions`, `DELETE /me/sessions/:id`, `PATCH /me/avatar`, `GET /settings/hospital` | API (shared `SettingsView`) |
| Messages | static | `GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations`, `POST /conversations/:id/messages`, `GET /messages/directory` | API (shared `MessagesView`) |

### Doctor

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Dashboard | static | `GET /dashboards/doctor`, `GET /appointments`, `GET /lab/orders` | API |
| Appointments | static | `GET /appointments` (+ `GET /appointments/availability`), approve/cancel/create | API |
| My patients | static | `GET /patients`, `GET /patients/:id/clinical-summary` | API |
| Prescriptions | static | `GET /prescriptions`, `POST /prescriptions`, `POST /prescriptions/:id/cancel`, `GET /refills`, `POST /refills/:id/decide`, `GET /reference/drugs` | API |
| Lab orders | static | `GET /lab/orders`, `POST /lab/orders`, `GET /lab/tests` | API |
| EMR / records | static | `GET /patients/:id/clinical-summary`, `/allergies`, `/problems`, `POST /notes`, `GET /vitals/:patientId`, `GET /patients/:id/documents` | API |
| Schedule | static | `GET /schedule/board`, `GET /schedule/time-off` | API |
| Analytics | static | `GET /reports/doctor-analytics` | API |
| Settings / Messages | static | shared views (see Administration) | API |

### Nurse

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Dashboard | static | `GET /dashboards/nurse`, `GET /ward/overview` | API |
| Assigned patients | static | `GET /nursing/assigned-patients`, `GET /patients/:id/clinical-summary` | API |
| Vitals entry | static | `POST /vitals`, `GET /vitals/:patientId` | API |
| Medications | static | `GET /medications/:patientId`, `POST /medications/:id/administer` | API |
| Progress notes | static | `GET /notes/:patientId`, `POST /notes` | API |
| Ward overview | static | `GET /ward/overview` | API |
| Settings / Messages | static | shared views | API |

### Patient

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Dashboard | static | `GET /dashboards/patient`, `GET /me/clinical-summary` | API |
| Appointments | static | `GET /appointments`, `GET /appointments/availability`, create/cancel | API |
| Medical records | static | `GET /me/clinical-summary`, `GET /me/allergies`, `GET /me/problems`, `GET /me/access-log`, `GET /me/documents`, `POST /files` | API |
| Lab results | static | `GET /lab/orders`, `GET /lab/results` (released results for the signed-in patient) | API |
| Prescriptions | static | `GET /prescriptions`, `GET /refills`, `POST /refills` | API |
| Bills & payments | static | `GET /invoices`, `GET /invoices/:id`, `POST /payments`, `GET /documents/invoices/:id.pdf` | API |
| Health insights | static | `GET /dashboards/patient`, `GET /me/clinical-summary` | API |
| Settings / Messages | static | shared views | API |

### Reception

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Dashboard | static | `GET /dashboards/reception`, `GET /queue`, `GET /appointments` | API |
| Register patient | static | `POST /patients`, `GET /patients/check-duplicates`, `GET /reference/insurers`, `POST /invoices`, `POST /payments` | API |
| Appointments | static | `GET /appointments`, `POST /appointments`, approve/cancel, `GET /doctors` | API |
| Queue manager | static | `GET /queue`, `POST /queue`, `POST /queue/call-next`, `POST /queue/:id/start|complete|remove` | API |
| Check-in | static | `GET /appointments`, `GET /patients`, eligibility, queue actions | API |
| Settings / Messages | static | shared views | API |

### Pharmacy

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Dashboard | static | `GET /pharmacy/dashboard`, `GET /inventory/alerts` | API |
| Prescriptions | static | `GET /pharmacy/orders`, process/ready/verify actions | API |
| Inventory | static | `GET /inventory`, `GET /inventory/:drugId/batches`, `POST /inventory/receipts`, `POST /inventory/adjustments`, `GET /inventory/alerts`, purchase orders | API |
| Dispense | static | `GET /pharmacy/orders`, `GET /pharmacy/dispense-log`, `POST /pharmacy/orders/:id/dispense` | API |
| Drug orders | static | `GET /pharmacy/orders`, `POST /pharmacy/orders/:id/process|ready` | API |
| Drug interactions | static | `GET /drugs`, `GET /drugs/interactions`, `POST /drugs/interactions/check` | API |
| Settings / Messages | static | shared views | API |

### Laboratory

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Dashboard | static | `GET /lab/dashboard`, `GET /lab/orders`, `GET /lab/results`, `GET /lab/results/critical` | API |
| Test requests | static | `GET /lab/orders` (status/priority/paging), `POST /lab/orders/:id/assign`, `GET /messages/directory` | API |
| Results entry | static | `GET /lab/orders`, `GET /lab/tests/:id/ranges`, `POST /lab/orders/:id/results`, `POST /lab/orders/:id/release` | API (see gap 1) |
| Sample tracking | static | `GET /specimens` (paging), `GET /specimens/lookup`, `GET /specimens/:id/custody`, `PATCH /specimens/:id/status` | API |
| Equipment log | static | `GET /equipment`, `GET /equipment/:id/maintenance`, `POST /equipment/maintenance` | API |
| Radiology | static | `GET /radiology/orders`, `POST /radiology/orders/:id/report`, `PATCH /radiology/orders/:id/status` | API |
| Settings / Messages | static | shared views | API |

### Billing

| Screen | src | Endpoint / hook | Status |
| --- | --- | --- | --- |
| Dashboard | static | `GET /billing/dashboard`, `GET /billing/reports`, `GET /invoices`, `GET /claims` | API |
| Invoices | static | `GET /invoices` (search/status/from/to), `GET /invoices/:id`, `POST /invoices`, `POST /invoices/:id/void`, `GET /documents/invoices/:id.pdf` | API |
| Payments | static | `GET /payments`, `POST /payments`, `GET /billing/reports` (method split), `GET /invoices?status=ISSUED` | API |
| Insurance claims | static | `GET /claims`, `POST /claims`, `PATCH /claims/:id`, `GET /reference/insurers`, `GET /reference/insurance-plans` | API |
| Outstanding | static | `GET /billing/outstanding` (rows + `meta.buckets`), `POST /conversations` for reminders | API (see gap 5) |
| Reports | static | `GET /billing/reports` (revenue by day/method, claim outcomes, ageing), `GET /billing/dashboard`, `GET /exports/invoices` | API (see gaps 3–4) |
| Settings / Messages | static | shared views | API |

## Documented substitutions

Where a screen showed a value the API does not expose, a real field was used and
the visual slot kept:

| Screen | Was | Now |
| --- | --- | --- |
| Admin → Doctors | "New this month" tile | "Inactive" count from `GET /doctors` status totals |
| Doctor → Appointments | "This week" counter | dropped (no week-scoped count; total + today's list shown) |
| Doctor → Appointments | doctor column | `AppointmentRow` has no `doctorName`; the signed-in doctor is implied |
| Nurse → Vitals | lbs / °F | kg / °C (the API stores metric) |
| Patient → Bills | weight-driven charges | invoice lines from `GET /invoices/:id` |
| Billing → Reports | "Gross revenue" KPI | "Collected" (`reports.collectedMinor`) |
| Billing → Reports | "Collection rate" KPI | "Claim approval rate" (`reports.claimOutcomes`) |
| Billing → Reports | "Revenue by department" chart | "Revenue by payment method" (`reports.revenueByMethod`) |
| Billing → Reports | revenue trend gross + collected | single collected series from `revenueByDay` |
| Billing → Outstanding | risk badges from fixture | derived from real `daysOverdue` (>60 High, >30 Medium) |
| Billing → Outstanding | reminder e-mail/SMS | in-app conversation with the patient's portal user (email/SMS gateways absent) |
| Billing → Outstanding | payment-plan creation | estimate only; no plans endpoint |
| Lab → Equipment | "Performed at" input | dropped — `POST /equipment/maintenance` accepts no date |
| Lab → Radiology | report text display | write-only endpoint returns no report body |
| Lab → Results entry | analyte list per order | derived from existing results (see gap 1) |

Money is always sent/received in integer minor units; form input in major units is
converted with `Math.round(value * 100)` and rendered through `money()` /
`compactMoney()`.

## Missing endpoints (blocked, not faked)

1. **Lab order items** — `GET /lab/orders/:id` returns only the order row and
   `POST /lab/orders/:id/results` requires an `itemId` (`lab_order_item` uuid),
   but no endpoint lists the items of an order. Result entry therefore only
   exposes analytes that already have a result, with an inline notice. Also, the
   server ignores `flag` / `critical` in the results body.
2. **Radiology report read-back** — only `POST …/report` exists; signed reports
   cannot be re-displayed.
3. **Gross revenue / department revenue** — `GET /billing/reports` exposes
   collections only (`collectedMinor`, `revenueByDay`, `revenueByMethod`,
   `claimOutcomes`, `ageing`), with no billed total or department dimension.
4. **Report exports** — only CSV (`GET /exports/invoices`, `patients`,
   `appointments`, `lab-results`, `audit-logs`); the PDF/Excel buttons report
   that those formats are unavailable instead of pretending to download.
5. **Outstanding pagination** — `GET /billing/outstanding` returns
   `meta.total = rows in page`, so the screen requests one page of 50 and omits
   paging controls.
6. **Payment plans, reminder delivery (e-mail/SMS)** — no endpoints; the modal
   produces an estimate / an in-app message instead.
7. **Cross-portal analytics the fixtures implied** (nurse ward census trends,
   patient health-score series, pharmacy stock forecasts) are not plotted; those
   cards now show only server-provided counts.

## Verification

- `cd clients && npx tsc --noEmit` — clean.
- `cd clients && npx vite build` — succeeds.
- `grep -rn "@/data" app --include=*.tsx` — only navigation/role config
  (`layout`, `navbar`, `sidebar`, `login`, `room`) and the audit-level vocabulary.
