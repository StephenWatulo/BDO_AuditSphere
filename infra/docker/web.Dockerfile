# syntax=docker/dockerfile:1.7
# BDO AuditSphere web (Next.js 15, standalone output). Build from the repository root:
#   docker build -f infra/docker/web.Dockerfile -t ghcr.io/bdo-ea/auditsphere-web:dev \
#     --build-arg NEXT_PUBLIC_API_URL=/api/v1 .
#
# Requires apps/web/next.config.* to set:
#   output: 'standalone'
#   outputFileTracingRoot: path.join(__dirname, '../../')   (monorepo tracing)

ARG NODE_IMAGE=node:22-alpine
ARG PNPM_VERSION=9.15.4

FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter @auditsphere/web...

# ---------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY tsconfig.base.json turbo.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @auditsphere/shared build \
 && pnpm --filter @auditsphere/web build

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# Standalone output contains a pruned node_modules and apps/web/server.js
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
