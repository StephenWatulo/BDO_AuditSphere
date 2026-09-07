# AuditSphere API (`@auditsphere/api`)

NestJS 11 backend for BDO AuditSphere. Implements `docs/api/contract-phase1.md` on top of the
Prisma model in `packages/db` and the shared roles/workflows in `packages/shared`.

- Base path: `/api/v1`
- Swagger UI: `http://localhost:4000/api/docs` (JSON at `/api/docs-json`)
- Liveness `/health`, readiness `/ready` (also under `/api/v1/...`)

## Running

```bash
# from the repo root
cp .env.example .env            # then edit secrets
pnpm db:generate                # Prisma client
pnpm db:migrate && pnpm db:seed # needs Postgres (pnpm db:local starts an embedded one)
pnpm --filter @auditsphere/api dev          # watch mode on :4000
pnpm --filter @auditsphere/api build && pnpm --filter @auditsphere/api start
```

Checks:

```bash
pnpm --filter @auditsphere/api typecheck
pnpm --filter @auditsphere/api test          # unit tests, no database needed
pnpm --filter @auditsphere/api test:e2e      # skipped unless DATABASE_URL is set (seeded DB)
```

The API starts without a database (Swagger and `/health` work; `/ready` reports `database: down`).

## Configuration

Loaded from `apps/api/.env` then the repo root `.env`; real environment variables win.
Validated with zod at boot (`src/config/env.schema.ts`); the process refuses to start on
invalid config.

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `API_PORT`, `API_BASE_URL`, `WEB_BASE_URL` | Listening port, public API origin (used in presigned local URLs), web app origin (redirect target, email links) |
| `CORS_ORIGINS` | Comma separated allowed origins (credentials enabled) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | >= 32 chars |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | Defaults `15m`, `30d` |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `ENCRYPTION_KEY` | AES-256-GCM key for MFA secrets. 64 hex chars are used verbatim; anything else is SHA-256 hashed into a key |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI` | Microsoft Entra ID sign-in (all three of the first must be set, otherwise `/auth/entra/*` returns 503) |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `LOCAL_STORAGE_DIR` | Optional; defaults to `<repo>/.local-storage` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` | S3 / MinIO settings |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email notifications; leave `SMTP_HOST` empty to disable email (in-app notifications still work) |
| `RUN_JOBS` | `true` to run scheduled jobs in this process |
| `LOG_LEVEL`, `NODE_ENV` | Logging (pretty output outside production) |

## Worker mode (scheduled jobs)

Jobs run only when the process is started with `--worker` or `RUN_JOBS=true`:

```bash
pnpm --filter @auditsphere/api start:worker   # node dist/main.js --worker
```

The worker is a full API instance plus `JobsModule`. Run one worker per deployment (the
job is idempotent per day but not distributed-locked). Daily at 06:00 UTC it:

1. Sends finding reminders per `REMINDER_SCHEDULE` (14/7/1 days before due, then every 7
   days after) and escalates: level 1 notifies the engagement manager, level 2 the CAE(s),
   level 3 partners as well. Updates `reminderCount`, `lastReminderAt`, `escalationLevel`.
2. Sends document request reminders on the same cadence (assignee, then requester, then
   engagement manager).
3. Alerts leads and managers about overdue engagement milestones (once per 7 days).

`RemindersService.runAll()` can be called manually from a script or a future admin endpoint.

## Request pipeline

`request-id middleware -> helmet/CORS/cookies -> throttler (100/min; 10/min on login and
MFA verify) -> JwtAuthGuard -> PermissionsGuard -> ValidationPipe -> handler -> BigInt/Decimal
serialiser`. Errors always come back as `{ statusCode, error, message, requestId }`, plus
`guards: [{ guard, message }]` on 422 workflow failures.

Every request runs inside an `AsyncLocalStorage` context (`TenantContext`). Services get a
tenant-scoped Prisma client with `prisma.scoped()`; the `$allModels` query extension injects
`tenantId` into every read/write so a bug in a service cannot cross tenants. `prisma.transaction()`
additionally sets `app.tenant_id` for Postgres RLS.

## Storage drivers

- `local`: files live under `.local-storage/<tenantId>/<uuid>`. `POST /documents/presign-upload`
  returns `uploadUrl = <API_BASE_URL>/api/v1/documents/:id/content` (raw `PUT`, up to 50 MB) and
  `GET /documents/:id/download` returns the same path for `GET`. Both endpoints require the
  session cookie and the usual permissions.
- `s3`: presigned `PUT`/`GET` URLs (5 minutes, SSE-AES256). Works with AWS S3 and MinIO
  (`S3_FORCE_PATH_STYLE=true`).

`POST /documents/upload` (multipart, field `file`) works with either driver. `RESTRICTED`
documents need `document:restricted`. Downloads are written to the audit trail.

## Authentication

Cookies `as_access` (JWT, 15 min) and `as_refresh` (opaque, 30 days, rotating). A refresh
token that was already rotated revokes its whole family when presented again. Local passwords
are Argon2id; 5 failed attempts lock the account for 15 minutes (the error stays generic).

### MFA (TOTP)

1. `POST /auth/mfa/setup` -> `{ secret, otpauthUrl }` (secret stored AES-encrypted, not enabled).
2. Scan the `otpauthUrl` in an authenticator app, then `POST /auth/mfa/enable { code }` ->
   `{ recoveryCodes: [8 codes] }` shown once (stored as Argon2 hashes).
3. Login now returns `{ mfaRequired: true, mfaToken }`; finish with `POST /auth/mfa/verify
   { mfaToken, code }` where `code` is a TOTP or a recovery code (consumed on use).
4. `POST /auth/mfa/disable { code }` turns it off.

Audit-function roles are expected to enrol; `/auth/me` returns `mfaRequiredToEnrol: true` until
they do (the web app nags, the API does not block).

### Microsoft Entra ID

1. Azure portal -> App registrations -> New registration (single tenant).
2. Authentication -> Add platform "Web" -> Redirect URI `ENTRA_REDIRECT_URI`
   (`https://<api-host>/api/v1/auth/entra/callback`). Enable "ID tokens".
3. Certificates & secrets -> new client secret -> `ENTRA_CLIENT_SECRET`.
4. Token configuration -> add optional claims `email`, `upn`, `given_name`, `family_name`
   to the ID token. API permissions: `openid`, `profile`, `email`, `offline_access`
   (Microsoft Graph delegated) with admin consent.
5. Set `ENTRA_TENANT_ID` (directory id) and `ENTRA_CLIENT_ID` (application id).
6. On the AuditSphere tenant, set `settings.entraTenantId` to the same directory id and
   optionally `settings.entraDefaultRole` (default `BUSINESS_OWNER`). When only one active
   tenant exists it is used automatically.

Flow: `GET /auth/entra/start?returnTo=/dashboard` -> Microsoft -> `GET /auth/entra/callback`
(PKCE + signed state cookie) -> user provisioned/updated by email -> cookies set -> redirect
to `WEB_BASE_URL + returnTo`. Entra users do not get a local TOTP challenge; conditional access
in Entra is expected to enforce MFA there.

## Module map

`auth`, `users`, `universe`, `risks`, `controls`, `plans`, `engagements`, `programs`,
`workpapers`, `documents`, `evidence`, `findings`, `requests`, `collaboration` (tasks,
comments), `notifications`, `audit-trail`, `library`, `dashboards`, `search`, `health`,
`jobs`; cross-cutting `config`, `tenancy`, `prisma`, `workflow`, `storage`, `common`.

Workflow guards are registered per machine in the owning service constructor
(`GuardRegistry.register('workpaper', 'signer_is_not_preparer', fn)`); the shared state
machines in `packages/shared` declare which guards each transition needs.
