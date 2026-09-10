# AuditSphere local setup and test guide

This guide is for evaluating the supplied system on a laptop. The recommended route uses Docker
Desktop for PostgreSQL, MinIO, Mailpit, the API, worker and web application. Commands are shown for
Windows PowerShell; macOS/Linux equivalents are noted where useful.

Do not use real BDO or client data locally. The supplied accounts and Baraka Holdings records are
synthetic. AI calls and malware scanning are intentionally disabled in the local demo.

## 1. What you will run

| Component | Local address | Purpose |
| --- | --- | --- |
| Web | http://localhost:3000 | User interface |
| API | http://localhost:4000/api/v1 | REST API |
| Swagger | http://localhost:4000/api/docs | Interactive API documentation |
| Mailpit | http://localhost:8025 | Captures outgoing demo email |
| MinIO console | http://localhost:9001 | Local S3-compatible document storage |
| PostgreSQL | localhost:5432 | Application database |

## 2. Prerequisites

Install:

1. Docker Desktop with WSL 2 enabled and at least 6 GB of memory available.
2. Node.js 22 LTS. Node 20 or later is supported.
3. Git is useful but not required for the supplied ZIP.
4. A current Chrome or Edge browser.

Open PowerShell and confirm:

```powershell
docker --version
docker compose version
node --version
corepack --version
```

If PowerShell says scripts are disabled, open it as your normal user and run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 3. Extract and prepare the source

1. Extract `AuditSphere-improved-source.zip` to a short local path such as
   `C:\dev\AuditSphere-improved`.
2. Do not run it from OneDrive, SharePoint, Dropbox, a network drive or directly inside the ZIP.
3. Open PowerShell in that folder.

Then enable the exact package manager version and install dependencies:

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

`pnpm --version` should print `9.15.4`. Keep `.env` private; never email or commit it.

## 4. Replace the placeholder local secrets

Generate three independent values:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Open `.env` in a text editor. Replace:

- `JWT_ACCESS_SECRET` with the first Base64 value.
- `JWT_REFRESH_SECRET` with the second Base64 value.
- `ENCRYPTION_KEY` with the 64-character hexadecimal value.

For the initial local test, leave these settings unchanged:

```dotenv
AI_ENABLED=false
MALWARE_SCAN_REQUIRED=false
COOKIE_SECURE=false
```

## 5. Start the complete local stack

Make sure Docker Desktop says its engine is running, then run:

```powershell
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
docker compose -f infra/docker/docker-compose.yml --env-file .env ps
```

The first build downloads images and dependencies and can take several minutes. Wait until
`postgres`, `minio`, `mailpit`, `api`, `worker` and `web` are running/healthy. Follow API startup
if needed:

```powershell
docker compose -f infra/docker/docker-compose.yml --env-file .env logs -f api
```

Press Ctrl+C to stop following logs; it does not stop the containers.

## 6. Load synthetic demo data

The API container applies database migrations automatically. From the same source folder, run:

```powershell
pnpm db:seed:demo
```

The seed is idempotent: running it again repairs/reuses the same synthetic records. Never run the
demo seed against staging or production.

## 7. Sign in

Open http://localhost:3000/sign-in and start with:

```text
Email: admin@bdo-ea.com
Password: Admin123!
```

Other useful demo identities use the same password:

| Email | What to test |
| --- | --- |
| partner@bdo-ea.com | Partner dashboard and review |
| manager@bdo-ea.com | Engagement, finding and request management |
| senior@bdo-ea.com | Fieldwork, workpapers and findings |
| junior@bdo-ea.com | Preparation workflows with fewer permissions |
| owner@client.example | Restricted client portal and assigned requests/actions |
| reviewer@client.example | Management review portal |
| committee@client.example | Read-only committee reporting |

The synthetic demo accounts are for local evaluation only. The separate
`pnpm db:bootstrap-admin` production bootstrap creates a temporary administrator password and
forces it to be replaced at first use.

## 8. Suggested first test

1. Sign in as `manager@bdo-ea.com` and open Engagements.
2. Open `IA-2026-001` and inspect its programme, workpapers, findings and requests.
3. Create or update a document request and inspect the event in Notifications/Mailpit.
4. Upload a harmless sample document to an allowed record, then download it again.
5. Sign out and sign in as `owner@client.example`.
6. Confirm the portal shows only that owner’s assigned requests and actions.
7. Paste a direct URL copied from an unrelated manager-only record; the portal user should receive
   a not-found/denied response rather than the record.
8. Sign in as the committee viewer and confirm editing controls are unavailable.
9. Check http://localhost:8025 for captured demo emails.
10. Visit http://localhost:4000/api/v1/health; it should report healthy.

Expected local limitation: AI Sphere does not call an external model while `AI_ENABLED=false`.
Any local rule-pack features should identify themselves as local/deterministic behavior.

## 9. Run the engineering checks

With the containers running and demo data loaded:

```powershell
pnpm verify
node scripts/verify-deployment.mjs
pnpm audit --prod
```

For database-backed end-to-end tests, create a separate database named `auditsphere_test`, apply
the migrations and demo seed to that database, then set `E2E_DATABASE_URL` before running:

```powershell
$env:E2E_DATABASE_URL='postgresql://auditsphere:auditsphere@localhost:5432/auditsphere_test?schema=public'
pnpm test:e2e
```

Do not point `E2E_DATABASE_URL` at the database you are manually testing; end-to-end tests may
change test records.

## 10. Stop, restart or reset

Stop without deleting data:

```powershell
docker compose -f infra/docker/docker-compose.yml --env-file .env stop
```

Restart later:

```powershell
docker compose -f infra/docker/docker-compose.yml --env-file .env start
```

Remove containers but keep database/document volumes:

```powershell
docker compose -f infra/docker/docker-compose.yml --env-file .env down
```

Delete the entire local database and document store only when you intentionally want a clean
reset:

```powershell
docker compose -f infra/docker/docker-compose.yml --env-file .env down -v
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
pnpm db:seed:demo
```

The `down -v` command permanently deletes the local Docker volumes.

## 11. Troubleshooting

| Symptom | Check/fix |
| --- | --- |
| `pnpm` is not recognised | Run `corepack enable`, reopen PowerShell, then prepare pnpm 9.15.4. |
| Docker cannot start | Confirm Docker Desktop/WSL 2 is running and virtualization is enabled. |
| Port 3000, 4000, 5432, 8025, 9000 or 9001 is in use | Stop the conflicting local application/container, then rerun Compose. |
| Web shows API/network errors | Run `docker compose ... ps` and `docker compose ... logs api web`. |
| Seed cannot connect | `.env` must use `localhost:5432`, and the PostgreSQL container must be healthy. |
| Login fails after an old attempt | Reset the local volumes and reseed, or wait 15 minutes after five failed passwords. |
| Build behaves strangely in OneDrive | Move the extracted folder to `C:\dev` and reinstall dependencies. |
| Uploaded file remains quarantined | In production, check the ClamAV service. Local Compose explicitly skips scanning. |

To capture useful diagnostic output:

```powershell
docker compose -f infra/docker/docker-compose.yml --env-file .env ps
docker compose -f infra/docker/docker-compose.yml --env-file .env logs --tail 200 api worker web
```

## 12. Alternative: run without Docker

Use this only if Docker Desktop is unavailable. The repository includes an embedded PostgreSQL
development launcher:

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:local
```

Leave that terminal open. In a second PowerShell window in the same folder:

```powershell
pnpm db:deploy
pnpm db:seed:demo
pnpm dev
```

This mode stores documents under `.local-storage` and database files under `.local-postgres`.
It does not provide MinIO or Mailpit unless you start them separately. Stop the embedded database
with `pnpm db:local:stop`.

## 13. Before any pilot or deployment

Do not promote the laptop settings. At minimum, complete the production prerequisites in
`IMPLEMENTATION_NOTES.md` and `docs/05-deployment.md`, run the database-backed end-to-end suite,
perform an independent penetration test, and test backup restoration. Deployment design should be
agreed separately after local functional testing.
