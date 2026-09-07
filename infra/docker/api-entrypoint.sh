#!/bin/sh
# Entrypoint for the AuditSphere API / worker image.
#
#   RUN_MIGRATIONS=true   run `prisma migrate deploy` before starting (api only;
#                         keep it false on the worker and when a k8s Job migrates)
#   MIGRATE_ONLY=true     run migrations and exit 0 (used by the k8s migrate Job)
#   arguments             forwarded to apps/api/dist/main.js, e.g. `--worker`
set -eu

cd /app

if [ "${RUN_MIGRATIONS:-false}" = "true" ] || [ "${MIGRATE_ONLY:-false}" = "true" ]; then
  echo "[entrypoint] applying database migrations"
  node node_modules/prisma/build/index.js migrate deploy --schema packages/db/prisma/schema.prisma
fi

if [ "${MIGRATE_ONLY:-false}" = "true" ]; then
  echo "[entrypoint] migrations complete (MIGRATE_ONLY)"
  exit 0
fi

if [ "${1:-}" = "--worker" ]; then
  echo "[entrypoint] starting worker"
else
  echo "[entrypoint] starting api on port ${API_PORT:-4000}"
fi

cd /app/apps/api
exec node dist/main.js "$@"
