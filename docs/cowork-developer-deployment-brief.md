# Cowork brief: developer handover for deploying BDO AuditSphere

Paste the kick-off prompt at the bottom into Cowork, with this repository folder attached.
Everything Cowork needs to know about the system, the technology, the configuration, the
deployment paths and the current state of the code is in this file. Fill in the placeholders
in the kick-off prompt first.

Sections 3 to 12 are written so that a developer can also read them directly, without
Cowork. They are the single source for the handover pack; the documents listed in section 14
are the evidence behind them.

Prepared 9 September 2026 from the repository at that date.

---

## 1. Objective

Produce a **developer handover pack**: a Word document (with a PDF copy) that lets a
developer or DevOps engineer who has never seen this repository deploy **BDO AuditSphere**,
operate it, and continue development. The pack must cover what the system is, the technology
it uses, how it is built and configured, the deployment path chosen for the target
environment, database and identity setup, operations, verification, and the known
limitations that the developer must not be surprised by.

Audience: the developer or engineering partner taking on deployment. Tone: precise and
practical, commands included, no marketing. Every fact must come from this brief or from the
source documents in section 14. Nothing may be invented, and no secret may appear in the pack.

## 2. Before Cowork starts (the user does this)

1. **Choose the target environment** and name it in the kick-off prompt. The options are
   compared in section 6: A pilot on one Windows machine, B Docker Compose on an always-on
   server behind HTTPS, C Kubernetes.
2. **Get the code into a Git host.** Today the repository has **no remote**: the only copy is
   this OneDrive folder. The last commit is `09ca5bd` (7 September 2026) and the working tree
   holds **40 modified and 43 untracked files** that are not in any commit, including a database
   migration (`20260908093000_internal_audit_engagement_type`), the pilot files, the AI Sphere
   2.1 code, the user manual and `.dockerignore`. Either commit these before the handover or
   state plainly that the developer receives the working tree as it stands. CI and image
   publishing assume GitHub (GitHub Actions and the GitHub Container Registry), so a private
   GitHub repository is the natural host. Never push `.env`, `packages/db/.env`, `.local-*`
   folders or `Claude outputs/`.
3. **Collect the placeholders** the developer will need: public hostname(s), who administers
   the Microsoft Entra tenant and will create the app registration, the SMTP relay for
   notifications, the storage choice (local disk, MinIO, AWS S3, Azure via S3 gateway), whether
   an AI provider key is approved, and who holds production secrets.
4. Optional: run the verification gates in section 8 on a clean checkout so the pack can quote
   fresh results.

## 3. What the system is

BDO AuditSphere is a multi-tenant internal-audit management platform built by BDO East
Africa, positioned against TeamMate+, AuditBoard and Diligent. One web application covers the
audit universe, risk and control registers, annual planning, engagement lifecycle with
programmes and workpapers, evidence and document management, findings and remediation, a
client portal for business owners, a methodology library, time and resourcing, dashboards and
reports, an AI assistant (AI Sphere) and a continuous-monitoring surface.

Everything in the seed is fictional: tenant "BDO East Africa" (slug `bdo-ea`) and the demo
client Baraka Holdings, a Kenyan financial group.

### Functional modules

| Area | What it does | Web routes |
| --- | --- | --- |
| Audit universe | Entity tree, processes, owners, risk rating, last audit date, coverage analysis | `/universe` |
| Risks and controls | Risk register with 5x5 scoring and heat map; controls repository, risk-control matrix, design and operating tests | `/risks`, `/controls` |
| Planning | Annual plan, plan items by quarter, hours, approval lifecycle, engagement created from a plan item | `/plans` |
| Engagements | Lifecycle machine Planning, Programme, Fieldwork, Review, Reporting, Close (plus On hold) with completion gates; team, stakeholders, milestones, history | `/engagements` |
| Programmes and workpapers | Programme steps instantiated from the library; workpaper templates, versions, review notes, review and sign-off with segregation of duties, locking | engagement tabs, `/workpapers/:id` |
| Documents and evidence | Upload to object storage or local disk, versions, classification (including RESTRICTED), quarantine flag, evidence register | engagement tabs |
| Findings | Five Cs, severity, status machine (draft, management review, agreed, implementation, validation, closed), ageing, reminders and escalation | `/findings` |
| Document requests and client portal | Requests to business owners with reminders; portal where owners respond to requests and findings without seeing the audit file | `/requests`, `/portal` |
| Library | Frameworks (COSO, COBIT, ISO 31000, ISO 27001, IFRS, SOX, IIA) with references; programmes, procedures, findings and recommendations with versions and approval | `/library` |
| Time and resources | Timesheets, approvals, availability, utilisation | `/resources` |
| Dashboards and reports | My work, Portfolio and Audit committee home views; Executive, Findings and Engagement reports with PDF, Word, Excel, CSV and Markdown exports | `/`, `/reports` |
| AI Sphere | Eight read-only capabilities: planning scope, audit procedures, evidence review with exception register, finding draft, report summary, quality check, risk radar, Audit Intelligence Search. Every output cites sources and is a proposal, never a change | `/copilot` |
| Monitoring | Alerts workflow, risk radar signals, rules and connectors screens. No rule-execution engine exists yet | `/monitoring` |
| Administration | Users and roles, tenant settings, append-only audit trail, downloadable user manual (PDF, Word, Markdown) | `/admin/users`, `/admin/audit-trail` |

### Roles

Nine roles with a permission matrix in `packages/shared/src/permissions.ts`: Global
Administrator, Audit Partner, Chief Audit Executive, Audit Manager, Senior Auditor, Junior
Auditor, Business Owner, Management Reviewer, Audit Committee Viewer. Business Owners are
portal-only; Management Reviewers see the workspace and the portal.

### Delivery status against the roadmap

| Phase | Status |
| --- | --- |
| 1 Core platform | Delivered, including the client portal |
| 2 Risk, controls, planning, resources, dashboards, library | Delivered |
| 3 AI and continuous auditing | AI Sphere drafting, quality checks and Audit Intelligence Search delivered (local rule engine, optional model provider). Monitoring engine, ERP connectors, Teams and Outlook notifications and the GraphQL knowledge graph are **not implemented** |
| 4 Mobile PWA | Not started; the web app is responsive |

## 4. Technology stack

| Layer | Technology | Version in the repository | Notes |
| --- | --- | --- | --- |
| Runtime | Node.js | 22 LTS in images and CI; `engines` allows 20+ | The authoring machine runs Node 24.15 without problems. Use 22 in servers |
| Package manager | pnpm, Turborepo | pnpm 9.15.4 (pinned in `package.json`), turbo 2.10 | `corepack enable` gives the right pnpm. Hoisted node-linker (`.npmrc`) |
| Language | TypeScript, strict | 5.9.3 | Shared `tsconfig.base.json` |
| API | NestJS | 11.2 | Express adapter, class-validator DTOs, Swagger, throttler, schedule, Passport JWT, pino logging |
| ORM and database | Prisma, PostgreSQL | Prisma 6.19; PostgreSQL 16 in Compose, CI and Kubernetes; embedded PostgreSQL 17 for local development | 56 models, 3 migrations, Row Level Security and audit-trail triggers in hand-written SQL |
| Web | Next.js App Router, React, Tailwind | Next 15.5, React 19, Tailwind 4 | shadcn-style components on Radix primitives, TanStack Query and Table, react-hook-form, zod, recharts, dnd-kit, cmdk, sonner |
| Auth | argon2id (`@node-rs/argon2`), `openid-client` 6, `otplib` | | Local passwords, Entra ID OIDC with PKCE, TOTP MFA |
| Storage | AWS SDK v3 S3 client and presigner | 3.1125 | Works with AWS S3 and MinIO; local-disk driver for development and the pilot |
| Documents and exports | pdfkit, docx, exceljs, pdf-parse, mammoth | | PDF, Word, Excel exports; text extraction from PDF and Word uploads |
| Email | nodemailer | 7 | SMTP relay; Mailpit in Compose |
| AI | Plain `fetch` to an OpenAI-compatible chat-completions endpoint | | See section 10 |
| Tests | Jest and supertest (API), Vitest (shared package), Playwright smoke scripts | Playwright 1.55 | |
| Containers | Docker multi-stage images on `node:22-alpine`, non-root | | Compose stack for local, demo and pilot; Kustomize manifests for Kubernetes |
| CI/CD | GitHub Actions | | `ci.yml` verifies and publishes images on tags; `deploy.yml` deploys to Kubernetes manually |

Things the architecture document mentions that the code does **not** use: Redis (there is no
queue; scheduled jobs run in-process with `@nestjs/schedule`), GraphQL, and Microsoft Graph
notifications. Do not provision them.

### Repository layout

```
apps/api            NestJS REST API and worker (same code, --worker flag), port 4000
apps/web            Next.js web app, port 3000, proxies /api/* to the API
packages/db         Prisma schema, migrations, seed, generated client (@auditsphere/db)
packages/shared     Roles, permissions, workflow state machines, risk scoring, ageing, AI schemas (@auditsphere/shared)
infra/docker        api.Dockerfile, web.Dockerfile, api-entrypoint.sh, docker-compose.yml, docker-compose.pilot.yml, pilot-backup.ps1
infra/k8s           Kustomize base and production overlay
.github/workflows   ci.yml, deploy.yml
scripts             local-postgres.ts (embedded dev database), verify-*.mjs smoke tests, build-user-manual.ts
docs                architecture, ERD, journeys, roadmap, deployment, testing, API contract, ADRs, runbooks, handoff notes
```

Build order matters: `packages/shared` and `packages/db` must be built (`pnpm -r build` or
`pnpm build`) before `apps/api` and `apps/web` typecheck, because both apps import the
packages' `dist` output.

## 5. Runtime topology

### Processes

| Process | Image or command | Port | Role |
| --- | --- | --- | --- |
| web | `auditsphere-web` (Next.js standalone) | 3000 | Serves the UI. Rewrites `/api/*` to `API_INTERNAL_URL` so the browser only ever talks to one origin |
| api | `auditsphere-api`, `node dist/main.js` | 4000 | REST API at `/api/v1`, Swagger at `/api/docs` (JSON at `/api/docs-json`) |
| worker | same image, `node dist/main.js --worker` | 4000 internal, not published | Full API instance plus the scheduled-jobs module. Run **exactly one** |
| postgres | PostgreSQL 16 | 5432 | Application database. The application user must own the tables |
| object storage | MinIO or S3, or a shared local folder | 9000 (MinIO API), 9001 (console) | Documents. Metadata stays in PostgreSQL |
| smtp | Mailpit locally, Office 365 relay in production | 1025 (SMTP), 8025 (Mailpit UI) | Optional; empty `SMTP_HOST` disables email and in-app notifications still work |
| Entra ID | external | | Optional single sign-on |
| LLM provider | external, OpenAI-compatible | | Optional; without it AI Sphere runs its local rule engine |

### Request path and sessions

The web client hard-codes its API base as `/api/v1` on its own origin
(`apps/web/lib/api.ts`). Therefore web and API must be reachable on **one hostname**: either
the Next.js server proxies `/api/*` to the API (`API_INTERNAL_URL`, used by Compose), or an
ingress routes `/api` to the API service and everything else to web (the Kubernetes ingress
does this). `NEXT_PUBLIC_API_URL` is passed at image build time for compatibility but the
current client code does not read it; keep it at `/api/v1`.

Sessions are two httpOnly, SameSite=Lax cookies: `as_access` (JWT, 15 minutes) and
`as_refresh` (opaque, 30 days, rotated on every refresh; reuse of an old token revokes the
whole family). `COOKIE_SECURE=true` is mandatory behind HTTPS. The API sets Express
`trust proxy` to 1, so it expects exactly one reverse proxy in front of it that sets the
`X-Forwarded-*` headers.

The Next.js middleware only checks that a session cookie exists; the API is the authority
for every permission.

### Probes, limits and logging

| Item | Value |
| --- | --- |
| Liveness | `GET /health` (also `/api/v1/health`), always 200 with uptime |
| Readiness | `GET /ready` (also `/api/v1/ready`), checks database and storage, returns 503 with `status: degraded` when either is down |
| Rate limits | 100 requests per minute per client by default; 10 per minute on login and MFA verify; ingress adds 50 requests per second |
| Upload size | 50 MB per file in the API; Next.js middleware body limit 52 MB; ingress `proxy-body-size` 100m |
| Presigned URLs | 5 minutes (S3 driver). The local driver serves uploads and downloads through authenticated API routes instead |
| Scheduled jobs | Daily at 06:00 UTC on the worker: finding reminders and escalations, document-request reminders, overdue-milestone alerts |
| Logs | pino JSON in production (`LOG_LEVEL`, default `info`), pretty output in development; every response carries `x-request-id` |
| Errors | `{ statusCode, error, message, requestId }`; workflow failures return 422 with the failed guards |

### Security controls in the code

Tenant isolation by a `tenantId` column on every business table, injected on every query by a
Prisma client extension, plus PostgreSQL Row Level Security as defence in depth. Append-only
`AuditTrail` table with a database trigger that rejects UPDATE, DELETE and TRUNCATE. Workflow
state machines enforced server-side with guards such as "signer is not preparer". Helmet
headers, strict CORS with credentials, input validation with whitelisting, AES-256-GCM
field encryption for MFA secrets. Account lockout for 15 minutes after 5 failed logins.

## 6. Deployment paths

| | A. Pilot: Compose on one Windows machine | B. Compose on an always-on server behind HTTPS | C. Kubernetes |
| --- | --- | --- | --- |
| Suits | Demonstrations and a hands-on trial by a small team on the office LAN | First real deployment for one firm, including client data once hardened | Several tenants, high availability, autoscaling |
| Documented in | `docs/pilot-runbook.md`, `pilot.env.example`, `infra/docker/docker-compose.pilot.yml` | `infra/README.md`, `docs/05-deployment.md`, runbook sections 12 and 13 | `infra/README.md`, `docs/05-deployment.md` section 5, `infra/k8s/**`, `.github/workflows/deploy.yml` |
| Database | `postgres:16` container, volume on the machine | `postgres:16` container first; managed PostgreSQL 16 with PITR as the next step | Managed PostgreSQL 16, TLS, PITR |
| Documents | Local disk under `PILOT_DATA_DIR/storage` shared by api and worker | MinIO with a browser-reachable endpoint, or S3, or a shared volume | S3-compatible bucket, versioned, encrypted |
| TLS | None (plain HTTP on the LAN) | Reverse proxy (Caddy, nginx or IIS) with a certificate in front of port 3000 | ingress-nginx with cert-manager or a supplied certificate |
| Identity | Local accounts only | Local plus Entra ID (needs the HTTPS callback) | Entra ID with Conditional Access MFA |
| State of the instructions | Written end to end, step by step, never executed yet | Base Compose stack is complete; the reverse proxy and the storage decision are the developer's work (see the gap below) | Manifests are complete and render, but have never been applied to a real cluster; hostnames (`auditsphere.bdo-ea.com`), bucket and region (`af-south-1`) in the production overlay are placeholders to confirm |

Recommendation: A to start the trial immediately, B for the first deployment that outlives
one laptop, C only when the firm needs more than one tenant or high availability.

Two gaps the developer must handle on paths B and C:

- The base `docker-compose.yml` never sets `STORAGE_DRIVER`, so the API defaults to `local`
  and writes documents inside its own container, where they vanish on rebuild and the worker
  cannot see them. Either set `STORAGE_DRIVER=s3` with an `S3_ENDPOINT` that browsers can reach
  (presigned URLs are opened by the browser), or mount one shared volume into api and worker
  with `STORAGE_DRIVER=local` and `LOCAL_STORAGE_DIR`, as the pilot override does.
- Docker is not installed on the authoring machine, so no image in this repository has been
  built yet. The first `docker compose build` is the first real test of the Dockerfiles.

## 7. Configuration reference

The API validates its environment with a zod schema at boot (`apps/api/src/config/env.schema.ts`)
and refuses to start on an invalid value, naming the key in the error. Values are read from
real environment variables first, then `apps/api/.env`, then the repository root `.env`.
The seed script reads `packages/db/.env` before the root `.env`; that file exists on the
authoring machine with the development database URL and must not be copied to a server.

### Required

| Key | Rule | How to generate |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string with `?schema=public`; add `&sslmode=require` outside local | |
| `JWT_ACCESS_SECRET` | at least 32 characters | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | at least 32 characters, different from the access secret | `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | 64 hex characters used verbatim as the AES-256-GCM key; any other string of 32+ characters is SHA-256 hashed into a key. Rotating it requires re-encrypting stored MFA secrets | `openssl rand -hex 32` |

PowerShell equivalents are in `docs/pilot-runbook.md` section 4.

### API and web addressing

| Key | Default | Meaning |
| --- | --- | --- |
| `API_PORT` | 4000 | Listening port |
| `API_BASE_URL` | `http://localhost:4000` | Public origin of the API, used in local-driver upload URLs and emails. With the Compose or ingress setup this is the web origin, for example `https://auditsphere.example.com` |
| `WEB_BASE_URL` | `http://localhost:3000` | Public origin of the web app; Entra sign-in redirects here |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated browser origins allowed with credentials |
| `COOKIE_SECURE` | false | Must be true behind HTTPS |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | `15m`, `30d` | Token lifetimes |
| `NODE_ENV`, `LOG_LEVEL` | development, debug (info in production) | |
| `RUN_JOBS` | false | true runs the scheduled jobs inside this process; the `--worker` flag does the same |
| `NEXT_PUBLIC_API_URL` | `/api/v1` | Web image build argument; keep `/api/v1` |
| `API_INTERNAL_URL` | `http://localhost:4000` | Web container only: where the Next.js server forwards `/api/*` |
| `PORT` | 3000 | Web container listening port |

### Microsoft Entra ID (optional)

| Key | Meaning |
| --- | --- |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | All three must be set to enable Entra sign-in; otherwise `/auth/entra/*` answers 503 and the sign-in page offers local login only |
| `ENTRA_REDIRECT_URI` | Must exactly match the app registration: `<public origin>/api/v1/auth/entra/callback` |

### Document storage

| Key | Meaning |
| --- | --- |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `LOCAL_STORAGE_DIR` | Folder for the local driver; defaults to `<repo>/.local-storage`. Must be shared by api and worker |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | S3-compatible target. The endpoint must be reachable from the user's browser |
| `S3_FORCE_PATH_STYLE` | true for MinIO and most gateways, false for AWS |

### AI Sphere

| Key | Meaning |
| --- | --- |
| `AI_ENABLED` | false keeps the local rule engine only |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | OpenAI-compatible base URL (the API appends `/chat/completions`), bearer key, model or deployment name. All three plus `AI_ENABLED=true` switch the provider on |

### Email

| Key | Meaning |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT` | Relay; empty host disables email |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Credentials and sender. The base Compose file hard-codes Mailpit; the pilot override shows the five lines to add for Office 365 |

### Container and tooling variables

| Key | Where | Meaning |
| --- | --- | --- |
| `RUN_MIGRATIONS` | api-entrypoint.sh | true runs `prisma migrate deploy` before starting (Compose api only) |
| `MIGRATE_ONLY` | api-entrypoint.sh | true migrates and exits (Kubernetes Job) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Compose | Container database; `POSTGRES_PORT=127.0.0.1:5432` binds the port to the host only |
| `PILOT_DATA_DIR` | Compose pilot override | Host folder for documents, outside OneDrive |
| `API_IMAGE`, `WEB_IMAGE` | Compose | Image names, default `ghcr.io/bdo-ea/auditsphere-{api,web}:local` |
| `LOCAL_PG_DIR`, `LOCAL_PG_PORT`, `LOCAL_PG_USER`, `LOCAL_PG_PASSWORD`, `LOCAL_PG_DATABASE` | `pnpm db:local` | Embedded development database |
| `SMOKE_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`, `SMOKE_BROWSER`, `SMOKE_DEBUG` | `scripts/verify-*.mjs` | Target and account for the Playwright smoke scripts |

Secrets in Kubernetes live in the `auditsphere-secrets` Secret with exactly these keys:
`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `ENTRA_TENANT_ID`,
`ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `AI_API_KEY`,
`SMTP_USER`, `SMTP_PASS`. Non-secret values live in the `auditsphere-config` ConfigMap.

## 8. Build, run and verify

### Local development without Docker

```
corepack enable
pnpm install
cp .env.example .env            # defaults match the embedded database
pnpm db:local                   # terminal 1: embedded PostgreSQL 17 on :5432
pnpm db:deploy                  # terminal 2: prisma migrate deploy
pnpm db:seed:demo               # demo tenant, roles, users, universe, engagements (idempotent)
pnpm dev                        # api on :4000 and web on :3000
```

The API dev server does not watch for changes; restart it after editing API code. On the
authoring machine the repository lives on OneDrive, so first page loads in development take
one to three minutes and `prisma generate` fails with `EPERM` on the query engine DLL while an
API process is running. Stop the dev servers before building.

### Building

```
pnpm -r build                   # shared, db (prisma generate + tsc), api (nest build), web (next build, standalone)
docker build -f infra/docker/api.Dockerfile -t ghcr.io/<owner>/auditsphere-api:<tag> .
docker build -f infra/docker/web.Dockerfile -t ghcr.io/<owner>/auditsphere-web:<tag> --build-arg NEXT_PUBLIC_API_URL=/api/v1 .
```

The API image keeps development dependencies because the runtime needs the Prisma CLI for
`migrate deploy`; it trims sources after compiling. The web image uses Next.js standalone
output with `outputFileTracingRoot` at the monorepo root. Both run as the `node` user with
health checks against `/api/v1/health` and `/`.

### Docker Compose

```
cp .env.example .env            # set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
pnpm db:seed:demo               # from the host against localhost:5432
```

Pilot variant (documents on local disk, internal ports bound to 127.0.0.1, needs Compose 2.24+):

```
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.pilot.yml --env-file .env up -d --build
```

The api container migrates on start (`RUN_MIGRATIONS=true`); the worker never does.

### Kubernetes

```
kubectl create namespace auditsphere
kubectl -n auditsphere create secret generic auditsphere-secrets --from-env-file=secrets.env
kubectl -n auditsphere create secret docker-registry ghcr-pull --docker-server=ghcr.io --docker-username=<user> --docker-password=<token>
kubectl -n auditsphere create secret tls auditsphere-tls --cert=fullchain.pem --key=privkey.pem   # or cert-manager
cd infra/k8s/overlays/production
kustomize edit set image ghcr.io/bdo-ea/auditsphere-api:<tag> ghcr.io/bdo-ea/auditsphere-web:<tag>
kubectl -n auditsphere delete job auditsphere-migrate --ignore-not-found
kubectl apply -k .
kubectl -n auditsphere wait --for=condition=complete job/auditsphere-migrate --timeout=300s
kubectl -n auditsphere rollout status deploy/auditsphere-api
```

Sizing in the production overlay: api 3 replicas (500m CPU, 1Gi, HPA 3 to 10 at 70 percent
CPU), web 3 replicas (250m, 512Mi), worker 1 replica (Recreate strategy). Pod disruption
budgets keep one api and one web pod during drains. Containers run non-root with a read-only
root filesystem and `/tmp` as an emptyDir. The cluster needs ingress-nginx, metrics-server and
optionally cert-manager (the ingress references a `letsencrypt-prod` ClusterIssuer).

### CI/CD

`ci.yml` runs on pushes to `main`, tags `v*` and pull requests: install, Prisma generate,
build shared packages, typecheck, lint, migrate and seed a `postgres:16` service, verify the
schema matches the migration history (`prisma migrate diff --exit-code`), unit tests, API
e2e tests, build. On `v*` tags it builds and pushes both images to
`ghcr.io/<repository owner>/auditsphere-api` and `-web` with tags `<version>`,
`<major.minor>`, `sha-<commit>` and `latest`.

`deploy.yml` is manual: inputs are the GitHub environment (holding a `KUBECONFIG` secret), the
image tag, the overlay path and a skip-migrations flag. It pins the images, applies the migrate
Job first, waits for it, applies the rest, waits for rollouts and curls `/api/v1/ready` from a
throwaway pod.

Promotion path in the deployment guide: merge to `main`, CI green, tag `vX.Y.Z`, images in
GHCR, deploy to staging, then the same tag to production.

### Verification gates

| Gate | Command | Needs |
| --- | --- | --- |
| Typecheck | `pnpm -r typecheck` | built packages |
| Lint | `pnpm -r run --if-present lint` | |
| Unit tests | `pnpm -r test` (Vitest for shared, Jest for the API; Prisma mocked) | |
| API end to end | `pnpm --filter @auditsphere/api test:e2e` | migrated and seeded PostgreSQL; skipped with a warning when `DATABASE_URL` is missing |
| Migration drift | `pnpm --filter @auditsphere/db exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | database |
| Seed smoke checklist | `docs/06-testing.md`, eleven checks | seeded database |
| Browser smoke scripts | `node scripts/verify-portal.mjs` and the other `verify-*.mjs` scripts (Playwright with an installed Chrome; `SMOKE_URL`, `SMOKE_PASSWORD`) | running stack |
| Manual | `pnpm manual:build`, `node scripts/verify-user-manual.mjs` | running stack |

Recorded results: on 7 September the API unit suite passed (16 suites, 109 tests), the e2e
suite passed (14 tests) and the portal smoke script passed; on 9 September the six AI Sphere
suites passed (94 tests) and the AI Sphere smoke scripts passed. Results of the run made
while preparing this brief are in section 12.

## 9. Database

- `packages/db/prisma/schema.prisma` is the source of truth (56 models). The ERD in
  `docs/02-erd.md` is derived from it.
- Three migrations: `20260903081241_init`, `20260903081500_rls_and_audit_trail` (hand-written
  SQL: `pg_trgm` extension, RLS enabled on every tenant table, the `auditsphere_admin` NOLOGIN
  role with a bypass policy, triggers that make `AuditTrail` immutable) and
  `20260908093000_internal_audit_engagement_type` (uncommitted at the time of writing).
- Apply with `prisma migrate deploy` (`pnpm db:deploy`, the entrypoint, or the Kubernetes
  Job). Never edit an applied migration; keep new ones backward compatible so a rolling
  deployment and a rollback of the images are safe. Migrations are not rolled back
  automatically: restore the pre-deploy snapshot or write a forward migration.
- The application database user owns the tables and therefore bypasses the non-forced RLS
  policies; tenancy is enforced by the API. Create separate read-only roles for BI or support
  and set `app.tenant_id` per session; those roles are constrained by RLS. Grant
  `auditsphere_admin` to nobody by default.
- The demo seed (`pnpm db:seed:demo`) is idempotent and creates the tenant, roles and permissions,
  frameworks, library, templates, the Baraka Holdings universe and eight engagements **and the
  nine demo accounts** with the password `Admin123!`. `pnpm db:seed` is the production-safe
  reference-only mode.
  Seed only local, CI and pilot databases; in a pilot, suspend the demo accounts after creating
  real users (runbook section 9).
- Backups: managed PostgreSQL with 35-day PITR plus nightly `pg_dump -Fc` in production;
  bucket versioning for documents; `infra/docker/pilot-backup.ps1` dumps the Compose database
  and mirrors the documents folder, keeping 14 dumps. Take an on-demand snapshot before every
  deploy that includes a migration.

## 10. Identity, AI provider and email

### Authentication

- Local login: argon2id hashes, lockout for 15 minutes after 5 failures with a generic error.
- MFA: TOTP with eight single-use recovery codes. Audit-function roles are expected to enrol;
  the web app nags (`mfaRequiredToEnrol`) but the API does not block.
- Entra ID: authorisation code flow with PKCE and a signed state cookie. First sign-in
  provisions the user by email with the tenant's default role
  (`Tenant.settings.entraDefaultRole`, `BUSINESS_OWNER` in the seed); an administrator then
  assigns audit roles. Set `Tenant.settings.entraTenantId` to the directory id. Entra users get
  no local TOTP challenge; enforce MFA with Conditional Access. App-registration steps are in
  `docs/05-deployment.md` section 7 and `apps/api/README.md`.
- There is **no self-service password reset and no administrator reset action**. A forgotten
  password needs a developer to set a new argon2 hash in the database, or a new account.

### AI Sphere

`GET /api/v1/ai/status` reports the mode. With `AI_ENABLED=false`, or without a base URL and
key, the provider is `local-rulepack` and every capability still works from the deterministic
local engine; Audit Intelligence Search always runs locally. With a provider configured, the
API posts an OpenAI-format chat completion (bearer token, `response_format: json_object`,
temperature 0.2, 45-second timeout, 512 KB response cap) to `<AI_BASE_URL>/chat/completions`,
validates the answer against the local baseline (citations, no invented figures, no
unqualified effectiveness conclusions) and falls back to the local draft when validation or
the call fails. Test the chosen provider's OpenAI-compatible endpoint and JSON mode before
go-live. Prompts contain only data the calling user is permitted to read.

### Email

Notifications, invitations, reminders and escalations go through SMTP. In Compose everything
lands in Mailpit at `http://localhost:8025`. For Office 365 use `smtp.office365.com:587` with
a mailbox or relay credentials in `SMTP_USER` and `SMTP_PASS`.

## 11. Operations

| Task | How |
| --- | --- |
| Is it up | `/health` and `/ready` on the API; Compose `ps` shows every service healthy; Kubernetes readiness on `/api/v1/ready` |
| Logs | `docker compose logs -f api` (worker, web likewise); pino JSON with `x-request-id` correlation; ship to a central store in production |
| Update | Compose: pull or copy the new code, `up -d --build`, confirm "applying database migrations" in the api log. Kubernetes: run the Deploy workflow with the new tag |
| Rollback | Compose: rebuild from the previous code and restore the backup if a migration changed data. Kubernetes: `kubectl rollout undo` for images; database by snapshot or forward migration |
| Restore | Compose: `pg_restore --clean --if-exists` into the container, mirror the documents folder back, restart api and worker (runbook section 10) |
| Reset to clean | `docker compose down -v`, empty the documents folder, `up -d`, `pnpm db:seed:demo` |
| Emails in the pilot | Mailpit UI on the machine; nothing reaches real inboxes |
| User manual | Admin menu in the app, or `GET /api/v1/help/user-manual?format=pdf` (docx, md); `apps/api/assets` must be deployed with the API, which the Dockerfile does |

Go-live hardening checklist (all items in `docs/05-deployment.md` section 9): HTTPS with HSTS
and `COOKIE_SECURE=true`; unique secrets per environment in a secret manager; database TLS and
a non-superuser application role; `CORS_ORIGINS` limited to the web hostname; MFA enforced for
audit roles; demo accounts absent or suspended; bucket private, versioned and encrypted;
non-root images scanned in CI; Kubernetes NetworkPolicy and restricted Pod Security; central
logs without secrets; a rehearsed restore; dependency scanning; a penetration test of
authentication, tenant isolation and document download authorisation before the first client
tenant.

## 12. Current state, known limitations and open items

### State of the repository on 9 September 2026

- Commits: `359bea4` scaffold, `4f1bb84` platform, `69751d0` e2e fixes, `09ca5bd` client
  portal (7 September). No remote configured.
- Uncommitted: 40 modified and 43 untracked files. Highlights: AI Sphere 2.1 (Audit
  Intelligence Search, exception register, context service), the engagement-type migration,
  the user manual and its API endpoint, the pilot runbook, pilot env template, pilot Compose
  override and backup script, `.dockerignore`, six new verification scripts and the
  manual build and capture scripts.
- A copy of the repository intended for the pilot exists at `D:\Internal Audit Pilot` on the
  authoring machine, without `.git`, generated folders and `.env` files (runbook section 3).
- Verification run made while preparing this brief (9 September, on the OneDrive copy with
  the dev servers running): `pnpm -r typecheck` passed for all four packages. `pnpm -r test`:
  the shared package passed 13 tests; the API passed 244 of 245 tests across 26 suites. The one
  failure, `extracts real docx document text` in `context-extractor.service.spec.ts`, hit the
  60-second processing timeout of the forked extraction process; reproduce it on a clean
  checkout before treating it as a defect. The turbo variants (`pnpm typecheck`, `pnpm test`)
  could not run because `prisma generate` was blocked by the running API process (`EPERM` on
  the query engine DLL). The e2e suite and the smoke scripts were not rerun.
- Docker is not installed on the authoring machine; images have never been built.

### Known limitations the developer must know

- No password reset for users or administrators (section 10).
- Continuous monitoring has screens and seeded alerts, rules and signals but no engine:
  rules and connectors are never executed.
- AI Sphere is local rule-based unless a provider is configured; it is not an embedding or
  vector search. Coverage figures describe scanned metadata, not all document bytes.
- The worker is single-instance by design: scheduled jobs are idempotent per day but not
  distributed-locked.
- Nine API routes (collaboration tasks and comments, notifications, search) lack
  `@RequirePermission`, and notification mutations write no audit-trail rows.
- Some status transitions in library, programmes, timesheets and review notes bypass
  `WorkflowService`, and several DTOs accept free-form status values.
- RLS has no policy on `RolePermission`, `LibraryItemFrameworkRef` and implicit many-to-many
  tables, and RLS is not forced (the application role bypasses it by design).
- Business owners hold tenant-wide `request:read` and `finding:read`; the portal shows only
  their items, but a hand-typed workspace URL still reads other records.
- The web app has no automated tests, no route-level authorisation beyond the cookie check,
  no `error.tsx` or `loading.tsx`, and known accessibility gaps (required fields not
  announced, keyboard-inaccessible clear buttons in pickers, no skip link in the workspace
  shell).
- Running the e2e suite against a database leaves test records (ABC and Alpha Manufacturing
  entities, IA-2026-012 and later engagements, `@abcmfg.com` users, "Portal check" requests).
  Reseed a fresh database before a demonstration.
- Seed quirks: empty owner column in the universe, duplicate team rows on IA-2026-001,
  unassessed risks show no inherent or residual score.
- Documentation gaps: the API contract lacks the AI context-document and alert-detail routes;
  the ERD omits `LibraryItemFrameworkRef`; `tenant:manage` is defined but unused.
- Kubernetes manifests and the deploy workflow are untested against a real cluster; the
  production overlay hostnames and region are placeholders.

## 13. Handover pack outline (what Cowork must produce)

A Word document, A4, with a table of contents, numbered headings, code in a monospace style
and tables for every reference list. Suggested length 20 to 30 pages. Sections:

| # | Section | Content |
| --- | --- | --- |
| 1 | Purpose, audience and how to use this pack | One page. Who wrote it, who it is for, the target environment named in the kick-off prompt, where the repository lives |
| 2 | What AuditSphere is | Section 3 of this brief: purpose, modules table, roles, delivery status |
| 3 | Technology stack | Section 4: stack table, repository layout, build order, what is not used |
| 4 | Getting the code | Section 2 item 2: repository host, branch `main`, uncommitted work, what must never be committed, `.dockerignore` |
| 5 | Runtime architecture | Section 5: processes and ports, single-origin rule, sessions, probes, limits, scheduled jobs, logging, security controls. Include a simple block diagram (browser, proxy, web, api, worker, PostgreSQL, storage, SMTP, Entra, LLM) |
| 6 | Configuration reference | Section 7 in full, as tables, with the secret-generation commands |
| 7 | Deployment: the chosen path | The comparison table from section 6, then step-by-step instructions for the chosen path taken from the documents in section 14, including the storage-driver gap and the reverse-proxy or ingress requirement |
| 8 | Database | Section 9 |
| 9 | Identity, AI provider and email | Section 10, with the Entra app-registration steps from `docs/05-deployment.md` section 7 |
| 10 | CI/CD and release process | Section 8: workflows, tags, promotion path |
| 11 | Operations | Section 11: daily checks, logs, update, rollback, backup and restore, go-live checklist |
| 12 | Verification and acceptance | Section 8 gates, the seed smoke checklist, the smoke scripts, recorded results |
| 13 | Known limitations and open items | Section 12 in full, unsoftened |
| 14 | Go-live checklist | The hardening list as tick boxes, plus the pilot-specific items from runbook section 12 |
| A | Appendix: environment variables | Every key in section 7 in one table |
| B | Appendix: command cheat sheet | Local, build, Compose, Kubernetes, database, verification |
| C | Appendix: ports and URLs | From section 5 |
| D | Appendix: source documents | Section 14 with one line on what each contains |

## 14. Honesty guardrails

- Do not describe as implemented: automated rule execution against connectors, ERP
  connectors, Teams or Outlook notifications, a GraphQL knowledge graph, a mobile app,
  Redis-backed queues, password reset. Label them roadmap or absent.
- Do not claim the images, Compose stack or Kubernetes manifests have been run in any
  environment. State what has been verified (section 8 and section 12) and what has not.
- Never include a secret, a real `.env` value, the demo password in a context that could be
  mistaken for a production credential, or any real BDO client name. The demo password may be
  named once, in the demo-accounts note, together with the instruction that it must not exist
  outside local, CI and pilot databases.
- Do not invent metrics, dates, versions or hostnames. Placeholders stay visibly placeholders
  (for example `<public hostname>`).
- Baraka Holdings and every person in the seed are fictional; say so where demo data is
  mentioned.
- Where this brief and a source document disagree, prefer the code-derived facts in this brief
  and note the discrepancy in the pack.

## 15. Source documents

All paths are relative to the repository root.

- `README.md`, `CLAUDE.md`: stack summary, commands, conventions, demo accounts.
- `docs/01-architecture.md`: context and container views, module map, request pipeline,
  security controls (note the Redis and GraphQL items are aspirational).
- `docs/04-roadmap.md`: phases and quality gates.
- `docs/05-deployment.md`: environments, environment variables, local, Compose and Kubernetes,
  backups, Entra app registration, S3 bucket policy, hardening checklist.
- `docs/06-testing.md`: test layers, e2e setup, seed smoke checklist, demo accounts.
- `docs/pilot-runbook.md`, `pilot.env.example`: the Windows pilot end to end.
- `infra/README.md`, `infra/docker/*`, `infra/k8s/**`: images, Compose, Kustomize.
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`: pipelines.
- `apps/api/README.md`: configuration table, worker jobs, request pipeline, storage drivers,
  authentication and MFA, Entra flow.
- `apps/api/src/config/env.schema.ts`: the authoritative list of environment variables.
- `docs/ai-sphere.md`, `docs/handoff-audit-intelligence-2026-09-08.md`: AI Sphere behaviour
  and limits.
- `docs/handoff-2026-09-07.md`: open items from the code audit.
- `docs/client-portal.md`, `docs/report-downloads.md`, `docs/user-manual-maintenance.md`:
  portal, exports, manual.
- `docs/api/contract-phase1.md`: REST contract. `docs/adr/`: decision records.

## 16. Deliverables

1. `AuditSphere-developer-handover.docx` and `AuditSphere-developer-handover.pdf` in the
   output folder named in the kick-off prompt.
2. A short closing summary: sections produced, which deployment path was written up, any
   statement in this brief that Cowork could not confirm in the repository, and any placeholder
   left for the user to fill.

---

## Kick-off prompt for Cowork

Copy from here, fill in the three placeholders, and paste into Cowork with the repository
folder attached.

```
Write a developer handover pack for deploying BDO AuditSphere, the internal audit platform
in the attached folder.

Read docs/cowork-developer-deployment-brief.md first and follow it exactly: the system
description, technology stack, configuration reference, deployment paths, known limitations,
the section outline and the honesty guardrails are all in that file. Use the source documents
it lists to expand the step-by-step instructions, and prefer the brief where they disagree.

The target environment is <TARGET ENVIRONMENT: "A pilot on one Windows machine",
"B Docker Compose on a server behind HTTPS" or "C Kubernetes">. The public hostname will be
<PUBLIC HOSTNAME, or "not decided yet">. Write section 7 of the pack for that path in full
and summarise the other two.

Do not run the application, do not build images and do not change any file in the
repository. Never copy a value from any .env file. Do not describe roadmap items as
implemented.

Save the pack as AuditSphere-developer-handover.docx and .pdf in <OUTPUT FOLDER>, and finish
with a summary of what was produced, which statements you could not confirm in the
repository, and which placeholders remain for me to fill.
```
