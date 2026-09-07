# syntax=docker/dockerfile:1.7
# BDO AuditSphere API (NestJS). Build from the repository root:
#   docker build -f infra/docker/api.Dockerfile -t ghcr.io/bdo-ea/auditsphere-api:dev .
#
# The same image runs the worker: pass `--worker` as the command.

ARG NODE_IMAGE=node:22-alpine
ARG PNPM_VERSION=9.15.4

# ---------------------------------------------------------------------------
# base: node + pnpm via corepack + libs prisma needs on alpine
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# deps: fetch the whole store from the lockfile (cache friendly), then install
# only what the api and its workspace dependencies need.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter @auditsphere/api...

# ---------------------------------------------------------------------------
# build: compile shared, db (prisma generate + tsc) and api
# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api
RUN pnpm --filter @auditsphere/shared build \
 && pnpm --filter @auditsphere/db build \
 && pnpm --filter @auditsphere/api build
# Dev dependencies are intentionally kept: the runtime needs the prisma CLI
# (a devDependency of @auditsphere/db) for `prisma migrate deploy`.
# Trim sources that are not needed at runtime.
RUN rm -rf apps/api/src apps/api/test packages/shared/src packages/db/src /pnpm/store

# ---------------------------------------------------------------------------
# runtime: non-root, minimal surface
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    API_PORT=4000 \
    RUN_MIGRATIONS=false
COPY --from=build --chown=node:node /app /app
COPY --chown=node:node infra/docker/api-entrypoint.sh /app/infra/docker/api-entrypoint.sh
RUN chmod +x /app/infra/docker/api-entrypoint.sh
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT}/api/v1/health" >/dev/null || exit 1
ENTRYPOINT ["/app/infra/docker/api-entrypoint.sh"]
CMD []
