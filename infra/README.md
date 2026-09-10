# Infrastructure

Everything needed to run BDO AuditSphere outside a developer laptop: Docker images, a
docker-compose stack for local and demo use, and Kustomize manifests for Kubernetes.
The full operations guide is in [docs/05-deployment.md](../docs/05-deployment.md).

```
infra/
  docker/
    api.Dockerfile        NestJS API and worker image (node:22-alpine, non-root)
    api-entrypoint.sh     runs prisma migrate deploy when RUN_MIGRATIONS=true, then starts api or worker
    web.Dockerfile        Next.js standalone image
    docker-compose.yml    postgres, minio (+init), mailpit, api, worker, web
  k8s/
    base/                 namespace, configmap, excluded secret example, deployments, services,
                          ingress, HPA, PDB, migrate Job
    overlays/production/  replicas, resources, hostnames, pinned image tags
```

## Local stack with docker compose

Prerequisites: Docker 24+ with Compose v2. Run from the repository root.

```bash
cp .env.example .env            # set JWT_*_SECRET and ENCRYPTION_KEY to real values
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
docker compose -f infra/docker/docker-compose.yml --env-file .env logs -f api
```

| Service | URL | Notes |
|---|---|---|
| web | http://localhost:3000 | Next.js |
| api | http://localhost:4000/api/v1 (Swagger at /api/docs) | runs `prisma migrate deploy` on start |
| postgres | localhost:5432 | user/password/db `auditsphere` |
| minio | http://localhost:9001 (console) | bucket `auditsphere-documents`, versioning on |
| mailpit | http://localhost:8025 | every email the API sends |

Seed the demo tenant once the API is healthy (the seed runs from your machine against the
container database, so `DATABASE_URL` in `.env` must point at `localhost:5432`):

```bash
pnpm db:seed:demo
```

Stop and remove everything, including volumes: `docker compose -f infra/docker/docker-compose.yml --env-file .env down -v`.

## Building images

Both Dockerfiles use the repository root as build context.

```bash
docker build -f infra/docker/api.Dockerfile -t ghcr.io/bdo-ea/auditsphere-api:v0.1.0 .
docker build -f infra/docker/web.Dockerfile -t ghcr.io/bdo-ea/auditsphere-web:v0.1.0 \
  --build-arg NEXT_PUBLIC_API_URL=/api/v1 .
```

Notes:

- The API image keeps dev dependencies because the runtime needs the `prisma` CLI for
  `migrate deploy`. `MIGRATE_ONLY=true` makes the entrypoint migrate and exit (used by the
  Kubernetes Job).
- The web image requires `output: 'standalone'` and `outputFileTracingRoot` pointing at the
  monorepo root in `apps/web/next.config.*`. `NEXT_PUBLIC_API_URL` is baked in at build time;
  `/api/v1` is right whenever web and api share a hostname (ingress or Next rewrites).
- CI builds and pushes both images to GHCR on every `v*` tag
  (`.github/workflows/ci.yml`).

## Kubernetes

Prerequisites: a cluster with ingress-nginx, metrics-server (for the HPAs) and optionally
cert-manager; managed PostgreSQL 16 and an S3-compatible bucket; `kubectl` 1.27+.

1. Create the namespace and real secrets. `base/secret.yaml` is an excluded example whose
   object names end in `-example`; it is never part of a Kustomize build:

   ```bash
   kubectl create namespace auditsphere
   kubectl -n auditsphere create secret generic auditsphere-secrets --from-env-file=secrets.env
   kubectl -n auditsphere create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io --docker-username=<user> --docker-password=<PAT with read:packages>
   kubectl -n auditsphere create secret tls auditsphere-tls --cert=fullchain.pem --key=privkey.pem   # or cert-manager
   ```

   Keys expected in `auditsphere-secrets`: `DATABASE_URL` (currently the schema owner; keep it
   private), `MIGRATION_DATABASE_URL` (may be the same value and is used by the migration Job), `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`,
   `ENTRA_CLIENT_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `AI_API_KEY`, `SMTP_USER`, `SMTP_PASS`.

2. Set hostnames, bucket and region in `overlays/production/config.yaml` and the ingress patch in
   `overlays/production/kustomization.yaml`.

3. Migrate, then deploy:

   ```bash
   cd infra/k8s/overlays/production
   kustomize edit set image ghcr.io/bdo-ea/auditsphere-api:v0.1.0 ghcr.io/bdo-ea/auditsphere-web:v0.1.0
   kubectl -n auditsphere delete job auditsphere-migrate --ignore-not-found
   kubectl apply -k .
   kubectl -n auditsphere wait --for=condition=complete job/auditsphere-migrate --timeout=300s
   kubectl -n auditsphere rollout status deploy/auditsphere-api
   kubectl -n auditsphere rollout status deploy/auditsphere-web
   ```

   The API pods start with `RUN_MIGRATIONS=false`; the Job is the only thing that migrates.
   Because the manifests apply in one go, API pods of the new version may start before the Job
   finishes; Prisma migrations are additive by convention (see docs/05-deployment.md) so the
   old and new code both run against either schema. If a migration is not backward compatible,
   scale the API to 0 first.

4. Preview without applying: `kubectl kustomize infra/k8s/overlays/production`.

### Rollout and rollback

```bash
kubectl -n auditsphere rollout history deploy/auditsphere-api
kubectl -n auditsphere rollout undo deploy/auditsphere-api            # previous revision
kubectl -n auditsphere rollout undo deploy/auditsphere-api --to-revision=3
kubectl -n auditsphere rollout undo deploy/auditsphere-web
```

Database migrations are not rolled back automatically. To revert a migration restore the
pre-deploy backup or write a forward migration that undoes the change, then redeploy the older
image.

### GitHub Actions deploy

`.github/workflows/deploy.yml` (manual trigger) performs the steps above against the cluster in
the `KUBECONFIG` secret of the selected GitHub environment.
