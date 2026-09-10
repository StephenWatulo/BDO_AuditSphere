# 06 - Testing

## Test layers

| Layer | Where | Runner | Needs a database |
|---|---|---|---|
| Unit: domain rules (roles, permissions, workflows, risk scoring, ageing) | `packages/shared/src/*.test.ts` | Vitest | no |
| Unit: API services and guards | `apps/api/src/**/*.spec.ts` | Jest | no (Prisma mocked) |
| End-to-end: API over HTTP | `apps/api/test/**/*.e2e-spec.ts` | Jest + supertest | yes, migrated and seeded |
| Seed smoke tests | `pnpm db:seed:demo` and the checks below | tsx / node | yes |
| Web | `apps/web` (lint + typecheck; component tests as they are added) | ESLint, tsc | no |

## Running tests

```bash
pnpm -r test                          # every package with a test script
pnpm --filter @auditsphere/shared test
pnpm --filter @auditsphere/api test
pnpm --filter @auditsphere/api test:e2e    # requires a migrated and seeded database (see below)
pnpm -r typecheck && pnpm -r run --if-present lint
pnpm verify                          # shared builds, typecheck, lint, unit tests, production builds
pnpm verify:full                     # same checks plus HTTP tests; requires E2E_DATABASE_URL
```

### End-to-end tests

The e2e suite runs against a real PostgreSQL with the demo seed loaded, so authentication,
tenancy and workflow guards are exercised as in production.

Start a separate test cluster in one PowerShell terminal:

```powershell
$env:LOCAL_PG_DIR = "$PWD/.local-dev/test-postgres"
$env:LOCAL_PG_PORT = '5433'
$env:LOCAL_PG_DATABASE = 'auditsphere_test'
pnpm db:local
```

In another terminal, migrate and seed only that disposable test database:

```powershell
$env:E2E_DATABASE_URL = 'postgresql://auditsphere:auditsphere@localhost:5433/auditsphere_test?schema=public'
$env:DATABASE_URL = $env:E2E_DATABASE_URL
pnpm db:deploy
pnpm db:seed:demo
pnpm verify:full
```

Do not run migrations or the demo seed against an existing working audit database. The
HTTP test setup requires an explicit `E2E_DATABASE_URL`, a loopback host, the public schema,
and a database named `auditsphere_test` or `auditsphere_test_<suffix>`. Missing or unsafe
configuration fails the suite rather than silently skipping it. It never takes the database
from the application's `.env`. Test uploads go under `.local-dev/test-storage/`; outbound AI,
email, Microsoft sign-in and background jobs are disabled. Unit tests exercise these guards.

The HTTP suite also covers both executive dashboards, the four audit intelligence acceptance
queries with unchanged finding status/rating, private context uploads and access checks, complete
PDF/Word/Excel downloads, authenticated manual access, session refresh and logout.

Tests must not depend on row counts from the seed (other tests may add data); they should create
what they need under a unique reference and assert on it. Mutations should use a dedicated
engagement created by the test.

CI (`.github/workflows/ci.yml`) provisions a `postgres:16` service with `auditsphere_test_ci`, runs `pnpm db:deploy`,
`pnpm db:seed:demo`, checks the schema is in sync with the migration history, runs `pnpm -r test`,
then runs the API e2e suite (`pnpm --filter @auditsphere/api test:e2e`) against the same
database before building.

### Restoring test tools

Jest, ts-jest, Vitest, Playwright and TypeScript are already pinned in the workspace manifests
and `pnpm-lock.yaml`; no additional test package is required. Run `pnpm install --frozen-lockfile
--prod=false` when development tools are missing. Do not change dependency versions to repair
an incomplete local installation. Keep database files, uploads, environment values and browser
artifacts out of Git. The existing `scripts/verify-*.mjs` files provide deeper desktop/mobile
acceptance checks against a permitted demo instance; see their `SMOKE_*` environment settings.

### Seed-based smoke tests

After `pnpm db:seed:demo` the following should hold. They double as a manual acceptance checklist for
a fresh environment.

1. Re-running `pnpm db:seed:demo` completes and prints the same counts (idempotent upserts).
2. `pnpm db:status` reports "Database schema is up to date!".
3. Login `POST /api/v1/auth/login` with `admin@bdo-ea.com` / `Admin123!` returns the user with
   `roles: ["GLOBAL_ADMIN"]` and every permission key.
4. `GET /api/v1/engagements` as `senior@bdo-ea.com` returns eight seeded engagements across
   the lifecycle, including `IA-2026-001` (FIELDWORK), `IA-2026-003` (REPORTING),
   `IA-2026-004` (REVIEW), `IA-2026-005` (PROGRAMME), `IA-2026-006` (ON_HOLD),
   `IA-2026-007` (CLOSED) and `IA-2025-014` (CLOSED).
5. `GET /api/v1/findings?engagementId=<IA-2026-001>` returns F-01 DRAFT, F-02
   MANAGEMENT_REVIEW and F-03 AGREED; F-03 has `isRepeat: true` pointing at IA-2025-014 F-03.
6. `GET /api/v1/engagements/<IA-2026-001>/workpapers` returns six workpapers covering every
   `WorkpaperStatus`; B.3.1 has one OPEN and one ADDRESSED review note.
7. As `owner@client.example`, `GET /api/v1/requests?mine=true` shows DR-001 ACCEPTED, DR-002
   SUBMITTED, DR-003 OPEN (due in 5 days), and `GET /api/v1/findings?mine=true` shows F-02
   MANAGEMENT_REVIEW and F-03 AGREED. Signing in as this user in the browser lands on the
   client portal at `/portal` with the same items; `node scripts/verify-portal.mjs` checks this
   end to end (see [docs/client-portal.md](client-portal.md)).
8. `GET /api/v1/universe/coverage` reports 19 entities with 3 never audited (Retail Banking
   Tanzania, ERP, Savanna Cloud Hosting).
9. `GET /api/v1/risks/heatmap` has cells in HIGH/CRITICAL for R-009, R-010, R-017, R-020.
10. `GET /api/v1/library/items?type=AUDIT_PROGRAM` returns three PUBLISHED programmes with
    `content.sections[].steps[]`.
11. Database guard rails (run with `psql` or `node -e` and `pg`):
    - `UPDATE "AuditTrail" SET action='x' WHERE id=1` fails with
      `AuditTrail rows are immutable`.
    - A non-owner role with `SELECT` sees zero rows from `"Engagement"` until
      `SET app.tenant_id = '<tenant uuid>'`.

## Demo accounts

All seeded users share the password `Admin123!`, are ACTIVE, use local authentication and
have MFA disabled. They exist only for local and CI databases.

| Email | Role | Name | Used for |
|---|---|---|---|
| admin@bdo-ea.com | Global Administrator | Grace Wanjiru | tenant settings, users, everything |
| partner@bdo-ea.com | Audit Partner | David Mwangi | partner dashboard, report issue, plan approval |
| cae@bdo-ea.com | Chief Audit Executive | Amina Hassan | plan ownership, library approval, committee dashboard |
| manager@bdo-ea.com | Audit Manager | Peter Ochieng | engagement management, programme approval, sign-off, validation |
| senior@bdo-ea.com | Senior Auditor | Faith Njeri | lead on IA-2026-001, workpaper review, finding submission |
| junior@bdo-ea.com | Junior Auditor | Brian Kiptoo | workpaper preparation, evidence, document requests |
| owner@client.example | Business Owner | Samuel Otieno | management responses, document request portal (Head of Procurement) |
| reviewer@client.example | Management Reviewer | Lydia Achieng | CFO view: risks, plans, reports |
| committee@client.example | Audit Committee Viewer | Joseph Kamau | committee dashboard, read-only |

Demo tenant: slug `bdo-ea`, "BDO East Africa", currency KES. Demo client: Baraka Holdings
(Kenya, Uganda, Tanzania; retail banking, corporate banking, insurance, shared services).

## Test data conventions

- Codes and references are stable natural keys (`R-001`, `C-004`, `IA-2026-001`, `B.2.1`,
  `F-03`, `DR-002`); tests can look them up by code rather than by id.
- `IA-2025-014` is fully closed and safe to use for read-only assertions.
- `IA-2026-002` is in PLANNING with a DRAFT programme; use it for tests that advance stages.
- Dates relative to "today" (task due dates, DR-003, notifications) are recomputed on each seed
  run; absolute dates (engagement history, findings) are fixed.
