# 05 - Deployment and operations

This guide covers running BDO AuditSphere in every environment, from a laptop without Docker
to a production Kubernetes cluster. Architecture context is in
[01-architecture.md](01-architecture.md) (section 7 for deployment, 4.4 for security);
manifests and Dockerfiles live in [`infra/`](../infra/README.md).

## 1. Environments

| Environment | Purpose | Database | Storage | Email | Auth |
|---|---|---|---|---|---|
| Local (no Docker) | day-to-day development | embedded PostgreSQL 17 via `pnpm db:local` | local driver (`STORAGE_DRIVER=local`) or MinIO | console / Mailpit | local accounts |
| Local (compose) | full stack demo, integration testing | `postgres:16` container | MinIO | Mailpit | local accounts, Entra optional |
| CI | pull request checks | `postgres:16` service container | none (S3 vars point at a dummy endpoint) | none | n/a |
| Staging | client demos, UAT | managed PostgreSQL 16 | S3-compatible bucket, versioned | SMTP relay | Entra ID + local admin |
| Production | live tenants | managed PostgreSQL 16, PITR enabled | S3-compatible bucket, versioned, SSE | SMTP relay (Office 365) | Entra ID, MFA enforced for audit roles |

Promotion path: `main` -> CI green -> tag `vX.Y.Z` -> images pushed to GHCR -> `Deploy`
workflow to staging -> same tag to production.

## 2. Environment variable reference

Every key in [`.env.example`](../.env.example). Secrets are marked. Values in the ConfigMap
(`infra/k8s/base/configmap.yaml`) are non-secret; the rest belong in the Kubernetes Secret.

### Database

| Key | Secret | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | Prisma connection string. Include `?schema=public`; add `&sslmode=require` outside local. The user must own the tables (it runs migrations) - see RLS note below. |

### API

| Key | Secret | Meaning |
|---|---|---|
| `API_PORT` | no | Port the NestJS app listens on (4000). |
| `API_BASE_URL` | no | Public URL of the API, used in emails and OIDC redirect construction. |
| `WEB_BASE_URL` | no | Public URL of the web app; Entra login redirects here after callback. |
| `CORS_ORIGINS` | no | Comma-separated list of allowed browser origins. |
| `JWT_ACCESS_SECRET` | yes | HMAC secret for 15-minute access tokens (32+ chars, `openssl rand -base64 48`). |
| `JWT_REFRESH_SECRET` | yes | Secret for hashing/rotating refresh tokens. Different from the access secret. |
| `JWT_ACCESS_TTL` | no | Access token lifetime (`15m`). |
| `JWT_REFRESH_TTL` | no | Refresh token lifetime (`30d`). |
| `COOKIE_SECURE` | no | `true` whenever the site is served over HTTPS (all non-local environments). |
| `ENCRYPTION_KEY` | yes | 64 hex chars = 32-byte AES-256-GCM key for MFA secrets and connector configs (`openssl rand -hex 32`). Rotating it requires re-encrypting stored values. |

### Microsoft Entra ID

| Key | Secret | Meaning |
|---|---|---|
| `ENTRA_TENANT_ID` | no | Directory (tenant) ID. Empty disables Entra login. |
| `ENTRA_CLIENT_ID` | no | Application (client) ID of the app registration. |
| `ENTRA_CLIENT_SECRET` | yes | Client secret from the registration (PKCE is used in addition). |
| `ENTRA_REDIRECT_URI` | no | Must exactly match a redirect URI on the registration: `<API_BASE_URL>/api/v1/auth/entra/callback`. |

### Document storage

| Key | Secret | Meaning |
|---|---|---|
| `S3_ENDPOINT` | no | S3 API endpoint (MinIO `http://localhost:9000`, AWS `https://s3.<region>.amazonaws.com`, Azure via an S3 gateway). |
| `S3_REGION` | no | Bucket region. |
| `S3_BUCKET` | no | Bucket for documents; enable versioning. |
| `S3_ACCESS_KEY` | yes | Access key with the policy in section 8. |
| `S3_SECRET_KEY` | yes | Secret key. |
| `S3_FORCE_PATH_STYLE` | no | `true` for MinIO and most gateways, `false` for AWS. |
| `MALWARE_SCAN_REQUIRED` | no | Keep `false` only for local development. Production sets `true`; failed or unavailable scans leave uploads quarantined. |
| `CLAMAV_HOST`, `CLAMAV_PORT` | no | Reachable ClamAV-compatible `clamd` INSTREAM endpoint. The production overlay expects an externally operated scanner service. |
| `CLAMAV_TIMEOUT_MS` | no | Maximum scan duration before the upload fails closed (default 60 seconds). |

### AI

| Key | Secret | Meaning |
|---|---|---|
| `AI_BASE_URL` | no | OpenAI-compatible base URL (Azure OpenAI deployment URL, `https://api.openai.com/v1`, Ollama `http://ollama:11434/v1`). |
| `AI_API_KEY` | yes | Provider key. |
| `AI_MODEL` | no | Model or deployment name. |
| `AI_ENABLED` | no | `false` hides copilot features and never calls the provider. |

### Email

| Key | Secret | Meaning |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT` | no | SMTP relay (Mailpit locally: `localhost:1025`). |
| `SMTP_USER`, `SMTP_PASS` | yes | Relay credentials (blank for Mailpit). |
| `SMTP_FROM` | no | Sender shown on notifications. |

### Web

| Key | Secret | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | no | API base URL the browser uses. Baked into the web image at build time. `/api/v1` when web and api share a hostname (recommended); an absolute URL for split hosting. |
| `API_INTERNAL_URL` | no | (containers only) URL the Next.js server uses for its `/api/*` rewrite, e.g. `http://auditsphere-api:4000`. |

### Local Postgres script (optional)

`LOCAL_PG_DIR`, `LOCAL_PG_PORT`, `LOCAL_PG_USER`, `LOCAL_PG_PASSWORD`, `LOCAL_PG_DATABASE`
override the defaults of `pnpm db:local`. Set `LOCAL_PG_DIR` to a folder outside OneDrive or
Dropbox if the repository is synced.

## 3. Local setup without Docker

Prerequisites: Node 20+ (22 recommended), pnpm 9 (`corepack enable`), Git.

```bash
pnpm install
cp .env.example .env                 # defaults match the embedded database

pnpm db:local                        # terminal 1: PostgreSQL 17 on localhost:5432, Ctrl+C stops it
pnpm db:deploy                       # terminal 2: apply migrations (prisma migrate deploy)
pnpm db:seed:demo                    # synthetic local/test tenant and data (idempotent)
pnpm dev                             # api on :4000 and web on :3000 (or pnpm dev:api / pnpm dev:web)
```

Useful commands:

| Command | What it does |
|---|---|
| `pnpm db:local --stop` / `pnpm db:local:stop` | stops the embedded server from any terminal |
| `pnpm db:local:status` | shows pid, port and connection URL |
| `pnpm db:migrate` | `prisma migrate dev` - creates a migration from schema changes and applies it |
| `pnpm db:status` | `prisma migrate status` |
| `pnpm db:generate` | regenerate the Prisma client after schema changes |
| `pnpm db:studio` | Prisma Studio at http://localhost:5555 |

Data lives in `.local-postgres/` (gitignored). Delete the folder to start over.

Migration conventions:

- Never edit an applied migration; add a new one. Keep migrations backward compatible with the
  previous release (add columns nullable or with defaults, drop in a later release) so rolling
  deployments and rollbacks are safe.
- Database objects Prisma does not model (RLS policies, triggers, functions, extensions) are
  hand-written in `packages/db/prisma/migrations/*_rls_and_audit_trail/migration.sql`. The
  trigram indexes it creates are declared in `schema.prisma` so `migrate dev` does not try to
  drop them.
- CI fails when `schema.prisma` and the migration history disagree.

## 4. Local stack with Docker Compose

See [infra/README.md](../infra/README.md#local-stack-with-docker-compose). In short:

```bash
cp .env.example .env    # set JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
pnpm db:seed:demo       # from the host, against localhost:5432
```

The API container runs `prisma migrate deploy` on start (`RUN_MIGRATIONS=true`); the worker
does not. MinIO console: http://localhost:9001, Mailpit: http://localhost:8025.

## 5. Kubernetes

Full steps in [infra/README.md](../infra/README.md#kubernetes). Summary:

1. Provision managed PostgreSQL 16 (private network, TLS, automated backups with PITR) and an
   S3-compatible bucket with versioning and server-side encryption.
2. Install ingress-nginx, metrics-server and cert-manager (or bring your own TLS secret).
3. Create `auditsphere-secrets`, `ghcr-pull` and `auditsphere-tls` in the `auditsphere`
   namespace. The required key contract is documented in the excluded
   `infra/k8s/base/secret.yaml` example. The migration URL is separately configurable, but the
   current runtime must also use the schema owner because not every Prisma query runs inside a
   transaction that sets `app.tenant_id`. Do not switch `DATABASE_URL` to a non-owner until that
   application change has been implemented and tested.
4. Adjust `infra/k8s/overlays/production` (hostnames, bucket, region, replicas).
5. Run the `Deploy` workflow with the tag to deploy, or apply manually: migrate Job first, then
   `kubectl apply -k`, then `rollout status`.

Sizing defaults (production overlay): api 3 replicas (500m CPU / 1Gi, HPA 3-10 at 70% CPU),
web 3 replicas (250m / 512Mi, HPA 2-4), worker 1 replica (scheduled jobs are single-instance).
PodDisruptionBudgets keep at least one api and one web pod during node drains.

Row Level Security: the application database user currently owns the tables and therefore bypasses the
non-forced policies; tenancy is enforced in the API by the Prisma extension. Create additional
read-only roles for BI or support (`GRANT SELECT`, then `SET app.tenant_id` per session) - those
roles are constrained by RLS. Grant `auditsphere_admin` only to break-glass users.

## 6. Backups and recovery

| Component | Backup | Retention | Restore test |
|---|---|---|---|
| PostgreSQL | provider automated backups + PITR (WAL); nightly `pg_dump -Fc` to the backup bucket for portability | 35 days PITR, 12 monthly dumps | quarterly restore into staging, run `pnpm db:status` and the smoke tests |
| Documents bucket | versioning on; cross-region replication for production | versions 90 days, deleted objects 30 days | quarterly: restore a sample object version |
| Secrets | in the secret store (Key Vault / Secrets Manager) | store defaults | with the DR drill |
| Manifests and images | Git tags and GHCR (immutable tags) | indefinite | redeploy an older tag |

Before every production deploy that includes migrations, take an on-demand database snapshot
and note the snapshot id in the release notes. `AuditTrail` is append-only; a restore is the only
way to remove rows, which must itself be recorded.

## 7. Microsoft Entra ID app registration

1. Entra admin centre -> App registrations -> New registration. Name `BDO AuditSphere <env>`,
   supported account types: single tenant (or multi-tenant for client tenants that bring their
   own directory).
2. Redirect URI (Web): `<API_BASE_URL>/api/v1/auth/entra/callback`. Add one per environment.
3. Certificates and secrets -> New client secret (12-24 months). Store as `ENTRA_CLIENT_SECRET`.
4. API permissions: Microsoft Graph delegated `openid`, `profile`, `email`, `User.Read`. Grant
   admin consent.
5. Token configuration: add optional claims `email`, `preferred_username`, `family_name`,
   `given_name` to the ID token. Enable `Groups` claim if roles will be mapped from groups.
6. Authentication: enable ID tokens; leave implicit access tokens off. Front-channel logout URL
   `<WEB_BASE_URL>/logout`.
7. Enterprise application -> Properties: assignment required = Yes; assign the users or groups
   allowed to sign in. Conditional Access: require MFA for the app.
8. Copy Directory (tenant) ID and Application (client) ID into `ENTRA_TENANT_ID` /
   `ENTRA_CLIENT_ID`. First sign-in provisions the user with the tenant default role
   (`Tenant.settings.entraDefaultRole`, `BUSINESS_OWNER` in the seed); an admin then assigns
   audit roles.

## 8. S3 bucket policy

Bucket: private, versioning on, default encryption (SSE-S3 or SSE-KMS), block all public
access, lifecycle rule expiring non-current versions after 90 days and aborting incomplete
multipart uploads after 7 days. The API credentials get only this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:GetObjectVersion", "s3:DeleteObject", "s3:AbortMultipartUpload"],
      "Resource": "arn:aws:s3:::auditsphere-documents/*"
    },
    {
      "Sid": "BucketAccess",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:ListBucketVersions", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::auditsphere-documents"
    },
    {
      "Sid": "RequireTLS",
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::auditsphere-documents", "arn:aws:s3:::auditsphere-documents/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
```

Object keys are opaque UUID-based names under the tenant prefix; the original filename and
business association remain in PostgreSQL. The API only issues short-lived presigned URLs for
objects the caller is authorised to access. For MinIO use
`mc admin policy create` with the same statements.

## 9. Security hardening checklist

Before go-live:

- [ ] `COOKIE_SECURE=true`, HTTPS only, HSTS enabled at the ingress.
- [ ] Unique `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` per environment,
      stored in a secret manager, never in Git or CI logs.
- [ ] Database: TLS required, application user not superuser, separate read-only role for
      reporting constrained by RLS, `auditsphere_admin` granted to nobody by default.
- [ ] `CORS_ORIGINS` limited to the web hostname.
- [ ] Rate limiting on `/api/v1/auth/*` (ingress `limit-rps` plus the API throttler).
- [ ] MFA enforced for all audit-function roles; Entra Conditional Access requires MFA.
- [ ] Seeded demo accounts removed or passwords rotated (`Admin123!` must not exist in
      staging or production). Seed only in local and CI.
- [ ] Bucket private, versioned, encrypted; presigned URL TTL 5 minutes; virus scanning on
      upload (`isQuarantined` flow) enabled.
- [ ] Container images run as non-root with read-only root filesystem (base manifests do
      this); images scanned in CI (add Trivy when the registry is private).
- [ ] Kubernetes: NetworkPolicy restricting api/worker egress to database, bucket, SMTP, LLM
      provider; Pod Security `restricted` on the namespace.
- [ ] Logs: pino JSON shipped to a central store with request ids; no secrets or document
      contents in logs; `AuditTrail` retained for 7 years.
- [ ] Backups verified by a restore drill; on-demand snapshot before each migration.
- [ ] Dependency updates: Dependabot or Renovate on `pnpm-lock.yaml`; `pnpm audit` in CI.
- [ ] Penetration test of auth, tenancy isolation (cross-tenant id probing) and document
      download authorisation before first client tenant.
