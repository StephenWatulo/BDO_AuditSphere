# AuditSphere pilot runbook: Docker Compose on one Windows machine

Version 1.0, September 2026. Written for the machine owner who will act as the pilot's
administrator. Every command is run in **PowerShell as Administrator** unless stated
otherwise. Nothing in this runbook has been executed yet; follow it top to bottom.

## 0. What this gives you, and what it does not

You get the full AuditSphere stack (web app, API, background worker, PostgreSQL, document
storage) running as Docker containers on your machine, reachable by colleagues on the
office network at `http://<your-machine>:3000`. Users need only a browser. Data lives on
your disk: the database in a Docker volume, uploaded documents in `D:\auditsphere-data`.

It is suitable for demonstrations and a hands-on trial by a small team. It is **not**
suitable for real client audit files, because traffic is plain HTTP on the LAN, the
machine must stay on, there is no redundancy, and nobody outside the office can reach
it. Section 12 lists what changes before real data goes in.

Files that belong to this runbook (all in the repository):

| File | Purpose |
|---|---|
| `pilot.env.example` | Template for the pilot `.env` (copy to `.env`, fill four placeholders) |
| `infra/docker/docker-compose.pilot.yml` | Overrides: documents on local disk, internal ports bound to this machine only |
| `.dockerignore` | Keeps `node_modules`, local databases and `.env` out of the image builds |
| `infra/docker/pilot-backup.ps1` | Nightly database dump and documents mirror |
| `docs/05-deployment.md`, `infra/README.md` | The product's own deployment reference |

## 1. Prerequisites

- Windows 10 21H2+ or Windows 11, 64-bit, with an account that can install software.
- 16 GB RAM (8 GB minimum), 20 GB free disk, wired or stable Wi-Fi.
- A fixed address on the office network: either a DNS name colleagues can resolve
  (usually the computer name, e.g. `STEPHEN-PC`) or a fixed IP from your network admin.
  Test from another PC: `ping STEPHEN-PC`. If the name does not resolve, use the IP
  everywhere this runbook says `PILOT-PC`.
- Node 22 and pnpm 9 (already present: they ran the dev servers). Check with
  `node -v` and `pnpm -v`.
- Docker Desktop 4.27 or newer with the WSL 2 backend (installed in section 2).

## 2. Prepare the machine (once)

1. **Install Docker Desktop.** Download from docker.com, install with "Use WSL 2"
   ticked, reboot when asked, then open Docker Desktop and wait until it says
   "Engine running". Verify:
   ```powershell
   docker version
   docker compose version     # must be v2.24.0 or newer
   ```
2. **Docker Desktop settings** (gear icon): General > "Start Docker Desktop when you
   sign in" ON. Resources > Advanced: at least 4 CPUs and 6 GB memory for the build.
3. **Stop the machine sleeping** while plugged in:
   ```powershell
   powercfg /change standby-timeout-ac 0
   powercfg /change hibernate-timeout-ac 0
   powercfg /change monitor-timeout-ac 10
   ```
   Also Settings > System > Power: "When I close the lid" = Do nothing (laptops).
4. **Windows Update**: set active hours so automatic restarts do not land in the working
   day. After any restart, Docker Desktop starts on sign-in and the containers resume
   automatically (`restart: unless-stopped`), but only after you have signed in to
   Windows. Enable automatic sign-in or leave the session signed in and locked.

## 3. The repository copy at `D:\Internal Audit Pilot`

Building and running from a OneDrive folder is slow and the sync client fights Docker,
so the repository has already been copied to **`D:\Internal Audit Pilot`** (this folder is
the repository root: `package.json`, `apps\`, `infra\`, `docs\` are directly inside it).
The copy deliberately leaves out generated folders (`node_modules`, `.next`, `dist`,
`.turbo`), the local database and uploads (`.local-postgres`, `.local-storage`,
`.local-dev`), `.git`, the build caches (`*.tsbuildinfo`) and every `.env` file.

Three small things to do by hand in `D:\Internal Audit Pilot`, because the copy tool
refuses to write those file names:

1. **Rename `npmrc.txt` to `.npmrc`** (the Docker build copies `.npmrc` and fails without it):
   ```powershell
   Rename-Item "D:\Internal Audit Pilot\npmrc.txt" ".npmrc"
   ```
2. `.github\workflows\` (the CI definitions) was not copied. It is not needed to run the
   pilot; leave it out.
3. `packages\db\.env` was left out on purpose. In the OneDrive copy it points the seed
   script at the development database with the development password; if it existed
   here, `pnpm db:seed:demo` would read it **instead of** the root `.env` and fail to connect.

Create the data folders (no spaces in the path, outside OneDrive) and install the
workspace packages, which are needed later for seeding:

```powershell
cd "D:\Internal Audit Pilot"
New-Item -ItemType Directory -Force D:\auditsphere-data\storage, D:\auditsphere-data\backups | Out-Null
pnpm install
pnpm db:generate      # builds the database client the seed script needs
```

## 4. Create the pilot `.env`

```powershell
cd "D:\Internal Audit Pilot"
Copy-Item pilot.env.example .env
```

Open `D:\Internal Audit Pilot\.env` in Notepad and fill the placeholders:

1. **`PILOT-PC`** (appears five times): replace with your machine name or fixed IP,
   for example `http://STEPHEN-PC:3000`. Keep `http://` and `:3000`. If colleagues will
   use the IP, put the IP; if some use the name and some the IP, list both origins in
   `CORS_ORIGINS`, comma-separated.
2. **Secrets.** Generate three fresh values and paste them in:
   ```powershell
   # JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (run twice, use different values)
   $b = New-Object byte[] 48; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   # ENCRYPTION_KEY (64 hex characters)
   $b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
   ```
   (Git Bash alternative: `openssl rand -base64 48` and `openssl rand -hex 32`.)
3. **`<<STRONG-DATABASE-PASSWORD>>`** (appears twice, must be identical in
   `POSTGRES_PASSWORD` and `DATABASE_URL`). Letters and digits only, 24+ characters,
   to avoid URL-escaping problems.
4. **`<<ANY-STRONG-PASSWORD>>`** for `S3_SECRET_KEY` (MinIO is not used by the pilot
   but must not keep its default password).

Leave `AI_ENABLED=false`, `COOKIE_SECURE=false` and the Entra lines empty.
Save the file. It is git-ignored; do not share it.

## 5. Stop the development stack

The pilot database publishes port 5432 on this machine, which the embedded dev
database also uses. In the OneDrive copy (or wherever `pnpm dev` was started):

```powershell
cd "C:\Users\StephenWatulo\OneDrive - BDO East Africa\Documents\Baraka Docs\119 - Internal Audit AI"
pnpm db:local:stop
```

Close any terminals still running `pnpm dev`, `pnpm dev:api` or `pnpm dev:web`.
Check nothing is listening on the pilot ports:

```powershell
Get-NetTCPConnection -LocalPort 3000,4000,5432 -State Listen -ErrorAction SilentlyContinue
```

(No output means the ports are free.)

## 6. Build and start the stack

```powershell
cd "D:\Internal Audit Pilot"
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.pilot.yml --env-file .env up -d --build
```

The first build downloads base images and compiles both applications; allow 10 to 25
minutes. Later starts take under a minute. Then:

```powershell
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.pilot.yml --env-file .env ps
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.pilot.yml --env-file .env logs -f api
```

Wait until `ps` shows `postgres`, `minio`, `mailpit`, `api`, `worker` and `web` as
`running (healthy)` (`minio-init` shows `exited (0)`, which is correct). The API log
should contain `applying database migrations` followed by `starting api on port 4000`;
the worker log (`logs worker`) should contain `starting worker`. Quick checks on the
machine itself:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health     # goes through the web app's rewrite
Invoke-RestMethod http://localhost:4000/api/v1/health     # direct to the API (this machine only)
```

Tip: the compose command is long. Create an alias once per PowerShell session:

```powershell
function dc { docker compose -f "D:\Internal Audit Pilot\infra\docker\docker-compose.yml" -f "D:\Internal Audit Pilot\infra\docker\docker-compose.pilot.yml" --env-file "D:\Internal Audit Pilot\.env" @args }
```

and then use `dc ps`, `dc logs -f api`, `dc restart web`, and so on. The rest of this
runbook uses `dc`.

## 7. Load the reference data

The database is empty after first start: no organisation, roles or users exist, so
nobody can sign in yet. The seed creates the BDO East Africa organisation, the nine
roles and their permissions, the framework library (COSO, COBIT, ISO, IIA, IFRS, SOX),
the methodology library, workpaper templates, **and** the fictional Baraka Holdings
demonstration data with the demo accounts. There is no "reference data only" mode, so
seed everything and retire the demo accounts in section 9.

```powershell
cd "D:\Internal Audit Pilot"
pnpm db:seed:demo
```

It reads `DATABASE_URL` from `D:\Internal Audit Pilot\.env` (localhost:5432, the container's
published port). Running it again is safe; it updates rather than duplicates.

Sign in on the machine at `http://PILOT-PC:3000/sign-in` (your real name or IP; use
the network address even on this machine, because document uploads are addressed to
it and browser cookies for `localhost` would not be sent there) with `admin@bdo-ea.com`
and the seeded demo password from `docs/cowork-presentation-brief.md`. Upload a small
PDF to any engagement's Documents tab and download it again: this proves the
documents folder (`D:\auditsphere-data\storage`) is wired correctly.

## 8. Open the door for colleagues

1. Firewall rule for the one port users need (domain and private networks only):
   ```powershell
   netsh advfirewall firewall add rule name="AuditSphere pilot (web 3000)" dir=in action=allow protocol=TCP localport=3000 profile=domain,private
   ```
   Do not open 4000, 5432, 9000, 9001, 1025 or 8025: the pilot override binds them to
   this machine only.
2. From another PC on the office network open `http://PILOT-PC:3000` (your real name or
   IP). The sign-in page should appear. Sign in with the admin account, then sign out.
   If the page loads but sign-in loops back, the address in the browser does not match
   `WEB_BASE_URL`/`CORS_ORIGINS` in `.env`: fix `.env` and run `dc up -d` again.
3. Share the address with users as `http://PILOT-PC:3000`. Chrome and Edge are fine;
   phones on the office Wi-Fi work too.

## 9. Create the real users and retire the demo accounts

Signed in as `admin@bdo-ea.com` at Admin > Users:

1. **Invite yourself first** with your real email, display name and the roles
   *Global Administrator* plus your audit role. Leave the password blank; the system
   shows a temporary password once. Sign out, sign in as yourself, change the password
   (user menu > Security), and enrol MFA with an authenticator app when prompted.
2. **Invite each pilot user** the same way, one role each to start (Audit Manager,
   Senior Auditor, Junior Auditor, Audit Partner or Chief Audit Executive). Business
   owners on the client side get *Business Owner*; they land in the client portal
   automatically. Hand over temporary passwords by phone or in person, never by email.
3. **Retire the seeded accounts.** The seed creates `admin@`, `partner@`, `cae@`,
   `manager@`, `senior@`, `junior@` at bdo-ea.com and `owner@`, `reviewer@`,
   `committee@` at client.example, all with the same well-known password. Once your
   own administrator account works, open each seeded user and choose **Suspend** (or
   Deactivate). The Baraka Holdings demo data stays and can be used for training; the
   seeded people simply can no longer sign in. Keep at least one working
   administrator at all times.
4. Optional: rename the organisation display name or add your own audit universe
   entities under Audit universe. Nothing else is needed for a trial.

**Forgotten passwords.** This version has no self-service reset and no administrator
"reset password" action (the user list only allows profile, status and role changes),
and the same applies to lost MFA recovery codes. A forgotten password therefore needs
a developer to set a new password hash directly in the database, or the account is
deactivated and a new one created under a different email alias. Ask every pilot user
to store their password in the firm's password manager on day one.

## 10. Daily operation

| Task | Command / action |
|---|---|
| Is everything up? | `dc ps` (all `healthy`), or open `http://PILOT-PC:3000` |
| See what the API is doing | `dc logs -f --tail=200 api` (`worker`, `web` likewise) |
| Restart one service | `dc restart api` |
| Stop the stack (keeps data) | `dc down` |
| Start it again | `dc up -d` |
| After a Windows reboot | Sign in to Windows; Docker Desktop starts and the containers follow within a minute. Check `dc ps`. |
| Emails the system "sent" | `http://localhost:8025` on this machine (Mailpit). Nothing reaches real inboxes in the pilot. |
| API reference | `http://localhost:4000/api/docs` on this machine only |

**Backups.** Run the script once by hand, then schedule it nightly:

```powershell
# keep a copy of the script on a path without spaces (Task Scheduler quoting is fragile)
Copy-Item "D:\Internal Audit Pilot\infra\docker\pilot-backup.ps1" D:\auditsphere-data\pilot-backup.ps1
powershell -ExecutionPolicy Bypass -File D:\auditsphere-data\pilot-backup.ps1
# schedule at 22:00 every day (runs whether or not you are signed in)
schtasks /Create /TN "AuditSphere pilot backup" /SC DAILY /ST 22:00 /RU SYSTEM /RL HIGHEST /TR "powershell -ExecutionPolicy Bypass -File D:\auditsphere-data\pilot-backup.ps1"
```

Dumps land in `D:\auditsphere-data\backups\auditsphere-<date>.dump` (14 kept) with a
mirror of the documents folder alongside. Copy that backups folder to a network share
or OneDrive **from time to time** so a disk failure on this machine is not the end of
the pilot. Check `backup.log` weekly.

**Restore** (after `dc up -d`, database empty or to roll back):

```powershell
docker cp D:\auditsphere-data\backups\auditsphere-<date>.dump auditsphere-postgres-1:/tmp/restore.dump
docker exec auditsphere-postgres-1 pg_restore -U auditsphere -d auditsphere --clean --if-exists /tmp/restore.dump
robocopy D:\auditsphere-data\backups\storage-mirror D:\auditsphere-data\storage /E
dc restart api worker
```

**Update to a new version of the application.** Take a backup first, then copy the new
code over `D:\Internal Audit Pilot` (everything except `node_modules`, `.next`, `dist`,
`.git`, the `.local-*` folders and any `.env`, so your `.env` and `.npmrc` stay untouched)
and rebuild:

```powershell
dc up -d --build
dc logs --tail=50 api        # confirm "applying database migrations" succeeded
```

Migrations run automatically when the API starts. If something breaks, `dc down`,
rebuild from the previous code, and restore the backup if migrations changed data.

**Reset to a clean slate** (destroys the database and documents):

```powershell
dc down -v
Remove-Item -Recurse -Force D:\auditsphere-data\storage\*
dc up -d
pnpm db:seed:demo
```

## 11. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `bind: address already in use` on 5432 or 3000 | The dev database or `pnpm dev` is still running. Section 5. |
| `set JWT_ACCESS_SECRET in .env` (or ENCRYPTION_KEY, PILOT_DATA_DIR) | A placeholder was left in `.env`. Fill it and run `dc up -d` again. |
| `docker compose` complains about `!override` | Compose older than 2.24. Update Docker Desktop, or delete the four `ports: !override` blocks from the pilot file and rely on the firewall rule (only 3000 is open). |
| Build stops at `COPY ... .npmrc` | `.npmrc` missing: rename `npmrc.txt` (section 3). |
| Build fails copying `node_modules` or takes forever | `.dockerignore` missing from `D:\Internal Audit Pilot`. Copy it from the OneDrive repository root and rebuild. Also check `.npmrc` exists (section 3). |
| `api` stays `unhealthy` | `dc logs api`. Typical: wrong database password (`POSTGRES_PASSWORD` changed after first start: `dc down -v` resets it), or an invalid `.env` value (the log names the key). |
| Page loads but every action fails with a network error | API not healthy, or `NEXT_PUBLIC_API_URL` is not `/api/v1` (the web image must be rebuilt after changing it: `dc up -d --build web`). |
| Sign-in works on the machine but not from other PCs | Firewall rule missing (section 8), or the users typed an address that is not in `CORS_ORIGINS`/`WEB_BASE_URL`. |
| Uploading a document fails, or the file never appears after upload | `D:\auditsphere-data\storage` missing or not writable, `PILOT_DATA_DIR` in `.env` wrong, or the browser is using an address other than `API_BASE_URL`. Check `dc logs api` for `Local storage at /data/storage`. |
| Reminders/escalations never fire | The worker is off: `dc ps` should show `worker` running; `dc logs worker` should say `starting worker`. Emails go to Mailpit (section 10) unless a real SMTP relay is configured. |
| Everything disappears after a reboot | Docker Desktop not set to start at sign-in, or nobody signed in. Section 2. |
| Machine went to sleep, users see timeouts | Section 2, step 3. |
| `pnpm db:seed:demo` cannot connect | `DATABASE_URL` in `.env` must use `localhost:5432` and the same password as `POSTGRES_PASSWORD`; `dc ps` must show postgres healthy. |

Logs to attach when asking a developer for help: `dc logs --tail=500 api > api.log`,
the same for `worker` and `web`, plus `dc ps`.

## 12. Before real client data goes in

Each item below is on the product's own hardening checklist (`docs/05-deployment.md`,
section 9) and is deliberately **not** done in this pilot:

- **HTTPS**: put a reverse proxy (Caddy, nginx or IIS) with a certificate in front of
  port 3000, then set `COOKIE_SECURE=true` and change all `http://` addresses in `.env`
  to `https://`. Without it, passwords and documents cross the LAN unencrypted.
- **Microsoft sign-in and MFA**: register the app in Entra ID (deployment guide section
  7) and fill the `ENTRA_*` values; requires an HTTPS callback address.
- **Real email** for invitations, reminders and escalations: Office 365 relay, see the
  commented block in `docker-compose.pilot.yml`.
- **A server, not a laptop**: an always-on Windows or Linux server or an Azure VM, with
  the same Compose files, backups copied off the machine automatically, and a managed
  PostgreSQL as the next step.
- **Retire the seeded demo data** entirely (fresh database, no `pnpm db:seed:demo`; create
  the organisation and users through the API or a reduced seed instead).
- Virus scanning of uploads, log shipping, restore drills and the penetration test
  listed in the checklist.

## 13. A note for the developer

The base `infra/docker/docker-compose.yml` never sets `STORAGE_DRIVER`, so the API
defaults to `local` and writes documents inside the container even though MinIO is
started alongside; files vanish on rebuild and the worker cannot read them. The pilot
override fixes this for one machine. For the shared stack, add
`STORAGE_DRIVER: ${STORAGE_DRIVER:-s3}` to `x-api-env` and make `S3_ENDPOINT`
configurable, because presigned URLs must use an address browsers can reach. Adding
the `.dockerignore` from this pilot to the repository is also recommended.
