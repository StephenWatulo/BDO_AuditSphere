# BDO AuditSphere (project folder 119 - Internal Audit AI)

Enterprise internal-audit management platform for BDO internal audit teams. Competes with
TeamMate+, AuditBoard and Diligent. Lives on OneDrive, so avoid generating large build
outputs outside the gitignored folders (`node_modules`, `dist`, `.next`, `.local-postgres`,
`.local-storage`).

## Design documents (read before changing anything structural)

- `docs/01-architecture.md` architecture of record
- `docs/02-erd.md` data model diagrams (source of truth is `packages/db/prisma/schema.prisma`)
- `docs/03-user-journeys.md` role-based journeys
- `docs/04-roadmap.md` phases; Phase 1 = core platform, 2 = risk/controls/dashboards, 3 = AI and continuous auditing, 4 = mobile
- `docs/api/contract-phase1.md` REST contract the API and web app both follow
- `docs/adr/` architecture decisions

## Stack

- pnpm 9 workspace + Turborepo. Node 22+. TypeScript 5.9 strict.
- `apps/api`: NestJS 11, Prisma 6, PostgreSQL, REST at `/api/v1`, Swagger at `/api/docs`, port 4000.
- `apps/web`: Next.js 15 App Router, React 19, Tailwind 4, shadcn-style components, port 3000. Proxies `/api/*` to the API via rewrites.
- `packages/db`: Prisma schema, migrations, seed. `packages/shared`: roles, permission matrix, workflow state machines, risk scoring, ageing rules. Both must be built (`pnpm -r build`) before apps typecheck.
- Auth: cookies `as_access` (JWT 15 min) and `as_refresh` (rotating). Local password + Entra ID OIDC + TOTP MFA.
- Storage: `STORAGE_DRIVER=local` writes to `.local-storage/`; `s3` uses presigned URLs.

## Conventions

- Branch `main`. Commit only when asked.
- Tenant isolation: every business table has `tenantId`; always query through the tenant-scoped Prisma client from `PrismaService`, never the raw client outside auth/provisioning.
- Status changes go through `WorkflowService` using the machines in `packages/shared/src/workflows.ts`. Never set `stage` or `status` fields directly.
- Every mutating service method records an `AuditTrail` row.
- Permission keys live in `packages/shared/src/permissions.ts`; guard routes with `@RequirePermission()`.
- Secrets in `.env` (gitignored). Never commit credentials. Client data never goes into the repo or prompts unless the task requires it.
- The Bash tool on this machine fails on long commands and apostrophes in heredocs; write files with the Write/Edit tools.

## Commands

```
pnpm install                 # once
pnpm db:local                # start embedded Postgres 17 on :5432 (keeps running)
pnpm db:deploy               # apply migrations
pnpm db:seed                 # demo tenant, roles, users, universe, engagements
pnpm --filter @auditsphere/api dev     # API on :4000
pnpm --filter @auditsphere/web dev     # web on :3000
pnpm -r typecheck && pnpm -r test && pnpm -r build
```

Demo login: `admin@bdo-ea.com` / `Admin123!` (other roles: partner@, cae@, manager@, senior@, junior@ at bdo-ea.com; owner@, reviewer@, committee@ at client.example, same password).
