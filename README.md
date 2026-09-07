# BDO AuditSphere

Report downloads and document upload workflows: [Reports and documents](docs/report-downloads.md).

Multi-tenant internal audit operating platform built by BDO East Africa: audit universe and
risk assessment, risk-based planning, engagement lifecycle with programmes and workpapers,
findings and remediation tracking, a client portal for document requests and management
responses, a methodology library, time and resourcing, an AI copilot and continuous monitoring.

## Architecture

| Document | Contents |
|---|---|
| [docs/01-architecture.md](docs/01-architecture.md) | context and container views, backend module map, workflow engine, security controls, AI layer |
| [docs/02-erd.md](docs/02-erd.md) | data model (`packages/db/prisma/schema.prisma` is the source of truth) |
| [docs/03-user-journeys.md](docs/03-user-journeys.md) | journeys per role |
| [docs/04-roadmap.md](docs/04-roadmap.md) | phased delivery plan |
| [docs/05-deployment.md](docs/05-deployment.md) | environments, env vars, local / compose / Kubernetes, backups, Entra ID, S3, hardening |
| [docs/06-testing.md](docs/06-testing.md) | test layers, smoke tests, demo accounts |
| [docs/api/contract-phase1.md](docs/api/contract-phase1.md) | REST contract implemented by `apps/api` and consumed by `apps/web` |
| [docs/adr/](docs/adr/) | architecture decision records |
| [infra/README.md](infra/README.md) | Docker images, compose stack, Kustomize manifests |

Stack: Next.js 15 / React 19 (web), NestJS 11 (API and worker), PostgreSQL 16+ with Prisma 6
(tenant column + Row Level Security, append-only audit trail), S3-compatible document storage,
Microsoft Entra ID OIDC with local fallback, OpenAI-compatible LLM provider.

## Quick start (no Docker)

Requirements: Node 20+ (22 recommended), pnpm 9 (`corepack enable`).

```bash
pnpm install
cp .env.example .env

pnpm db:local        # terminal 1: embedded PostgreSQL 17 on localhost:5432 (Ctrl+C to stop)
pnpm db:deploy       # terminal 2: apply migrations
pnpm db:seed         # demo tenant, users and the Baraka Holdings audit universe (re-runnable)
pnpm dev             # api http://localhost:4000/api/v1 (docs at /api/docs), web http://localhost:3000
```

With Docker instead: `docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build`
(postgres, MinIO, Mailpit, api, worker, web), then `pnpm db:seed`.

## Demo accounts

Password for every account: `Admin123!` (local and CI only).

| Email | Role |
|---|---|
| admin@bdo-ea.com | Global Administrator |
| partner@bdo-ea.com | Audit Partner |
| cae@bdo-ea.com | Chief Audit Executive |
| manager@bdo-ea.com | Audit Manager |
| senior@bdo-ea.com | Senior Auditor |
| junior@bdo-ea.com | Junior Auditor |
| owner@client.example | Business Owner (Head of Procurement, Baraka Holdings) |
| reviewer@client.example | Management Reviewer (CFO, Baraka Holdings) |
| committee@client.example | Audit Committee Viewer |

The seed creates the `bdo-ea` tenant, the nine roles with their permission matrix, seven
frameworks with references (COSO, COBIT, ISO 31000, ISO 27001, IFRS, SOX, IIA), workpaper
templates, a 5x5 scoring model, the Baraka Holdings universe (19 entities, 12 processes, 21
risks, 22 controls), a published methodology library, the FY2026 audit plan and eight demo
engagements spanning planning, programme, fieldwork, review, reporting, on-hold and closed
states. Examples include `IA-2026-001` procure-to-pay, `IA-2026-003` treasury dealing,
`IA-2026-004` insurance claims, `IA-2026-005` credit/KYC, `IA-2026-006` IFRS 17 readiness,
`IA-2026-007` fixed assets and `IA-2025-014` payroll with a repeat finding link.

## Monorepo layout

```
apps/
  api/            NestJS REST API + worker (--worker), port 4000
  web/            Next.js App Router web app, port 3000
packages/
  db/             Prisma schema, migrations, seed, generated client (@auditsphere/db)
  shared/         Roles, permission matrix, workflow state machines, risk scoring, ageing (@auditsphere/shared)
scripts/
  local-postgres.ts   embedded PostgreSQL for development (pnpm db:local)
infra/
  docker/         Dockerfiles, entrypoint, docker-compose.yml
  k8s/            Kustomize base and production overlay
.github/workflows/  ci.yml (typecheck, lint, test, build, images on tags), deploy.yml (manual k8s deploy)
docs/             architecture, ERD, journeys, roadmap, deployment, testing, API contract, ADRs
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | run api and web together (turbo) |
| `pnpm dev:api` / `pnpm dev:web` | run one app |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test` | across the workspace |
| `pnpm db:local` | start embedded PostgreSQL; `--stop` stops, `--status` reports |
| `pnpm db:deploy` | `prisma migrate deploy` |
| `pnpm db:migrate` | `prisma migrate dev` (creates a migration from schema changes) |
| `pnpm db:status` | `prisma migrate status` |
| `pnpm db:seed` | idempotent demo seed |
| `pnpm db:generate` | regenerate the Prisma client |
| `pnpm db:studio` | Prisma Studio |
| `pnpm format` | Prettier |

## Conventions

- Branch `main`; commit only when asked. Secrets live in `.env` (gitignored); never commit
  credentials. Client data is confidential and must not be copied into the repository.
- Every business table carries `tenantId`; the API scopes queries through a Prisma extension
  and PostgreSQL RLS is defence-in-depth for non-owner roles.
- `AuditTrail` is append-only (database trigger). Every mutating API call writes a row.
- The repository lives on OneDrive; build outputs and `.local-postgres/` are gitignored but
  still sync. Set `LOCAL_PG_DIR` to keep the database elsewhere if sync becomes a problem.

## Licence

Proprietary. Copyright BDO East Africa.
