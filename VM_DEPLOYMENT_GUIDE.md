# AuditSphere Linux Compose reference (not the Windows production path)

> **Important:** The confirmed target is Windows Server. Docker Desktop is not supported on Windows Server, so this guide must not be used for the client-data launch. Use `PRODUCTION_DEPLOYMENT_GUIDE_WINDOWS.md`. This Linux Compose material is retained only for a future Ubuntu staging/presentation host.

This runbook deploys the supplied source as an internet-facing **presentation environment** on
one Ubuntu virtual machine. It deliberately uses synthetic Baraka Holdings data, keeps AI off,
scans uploads, obtains HTTPS certificates automatically and exposes only the web proxy.

It is not approval to store real client evidence. A presentation environment does not replace
staging, penetration testing, independent infrastructure review, managed backups or a production
change process.

## 1. Deployment topology

| Service | Exposure | Persistence |
| --- | --- | --- |
| Caddy HTTPS proxy | Public TCP 80/443 and UDP 443 | Certificate/config volumes |
| Next.js web | Internal Docker network only | Stateless |
| NestJS API and worker | Internal Docker network only | Stateless |
| PostgreSQL | Internal Docker network only | Named volume |
| MinIO document storage | Internal Docker network only | Versioned named volume |
| ClamAV | Internal Docker network only | Signature database volume |

Browser requests go to Caddy, then Next.js. Next.js proxies `/api/*` to the API over the internal
network. PostgreSQL, MinIO, ClamAV and application ports are never published on the VM.

## 2. Information the team must provide

Do not start until these are known:

- VM public static IPv4 address.
- Ubuntu Server 24.04 LTS, 64-bit.
- At least 4 vCPU, 12 GB RAM and 100 GB SSD. ClamAV alone may need about 4 GB RAM.
- A sudo-capable SSH account.
- The final hostname, for example `auditsphere.bdo-ea.com`.
- An email address for TLS expiry/error notices.
- Control of the VM firewall/security group and DNS zone.
- A named technical owner who will hold the environment file and backup access.

If the VM is Windows Server, RHEL/CentOS, has no public IP, or already runs another service on
ports 80/443, stop and adapt this runbook rather than applying the commands unchanged.

## 3. DNS and firewall

In the domain provider’s DNS console:

1. Create an `A` record for the chosen hostname pointing to the VM’s static public IPv4 address.
2. Use a short TTL such as 300 seconds during setup.
3. Do not create an `AAAA` record unless the VM has working public IPv6 routing.
4. If using Cloudflare or another proxy, use DNS-only mode until the first certificate is issued.

In the cloud firewall/security group allow:

| Port | Source | Purpose |
| --- | --- | --- |
| TCP 22 | BDO/VPN administrator IPs only | SSH administration |
| TCP 80 | Internet | ACME certificate validation and HTTPS redirect |
| TCP 443 | Presentation participants, or Internet if their IPs are unknown | HTTPS application |
| UDP 443 | Same as TCP 443 | Optional HTTP/3 |

Do not allow public access to 3000, 4000, 5432, 3310, 9000, 9001 or 8025.

Confirm DNS from your own computer:

```powershell
nslookup auditsphere.example.com
```

Replace the example hostname in every command with the purchased hostname.

## 4. Upload the package

From Windows PowerShell, upload the ZIP to the VM:

```powershell
scp .\AuditSphere-deployment-ready.zip vmadmin@VM_PUBLIC_IP:/tmp/
```

SSH to the VM:

```powershell
ssh vmadmin@VM_PUBLIC_IP
```

## 5. Patch the VM and install Docker Engine

Run these commands on Ubuntu using the official Docker apt repository:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl unzip openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
```

Docker documents an important firewall detail: published container ports can bypass UFW rules.
The supplied Compose file therefore publishes only Caddy’s 80/443 ports. Review the cloud security
group as the primary exposure control. Official installation reference:
https://docs.docker.com/engine/install/ubuntu/

## 6. Create the service account and install the source

```bash
sudo adduser --disabled-password --gecos "" auditsphere
sudo usermod -aG docker auditsphere
sudo mkdir -p /opt/auditsphere/app /opt/auditsphere/backups
sudo unzip -q /tmp/AuditSphere-deployment-ready.zip -d /opt/auditsphere
sudo rsync -a /opt/auditsphere/AuditSphere-deployment-ready/ /opt/auditsphere/app/
sudo rm -rf /opt/auditsphere/AuditSphere-deployment-ready
sudo chown -R auditsphere:auditsphere /opt/auditsphere
sudo chmod 750 /opt/auditsphere /opt/auditsphere/app /opt/auditsphere/backups
```

The exact removal above targets only the just-extracted staging directory. The deployment source
will remain in `/opt/auditsphere/app`.

The `docker` group is effectively root-equivalent. Give membership only to the dedicated service
account and approved administrators.

## 7. Generate the protected environment

Switch to the service account and working directory:

```bash
sudo -iu auditsphere
cd /opt/auditsphere/app
```

Generate strong independent database, JWT, encryption, MinIO and demo credentials. Supply the
real hostname and TLS contact email:

```bash
./infra/vm/scripts/generate-env.sh auditsphere.example.com platform-owner@example.com
```

The generator refuses to overwrite an existing environment file and creates
`infra/vm/.env.vm` with mode 600. Confirm only the non-secret values:

```bash
grep -E '^(RELEASE_TAG|DOMAIN|ACME_EMAIL|POSTGRES_DB|S3_BUCKET|BACKUP_ROOT)=' infra/vm/.env.vm
stat -c '%a %n' infra/vm/.env.vm
```

Do not print, copy into chat, email, commit or place the complete file in a ticket. Back it up in
the organisation’s approved secrets manager.

## 8. Run preflight and deploy

DNS must already resolve before preflight:

```bash
./infra/vm/scripts/preflight.sh
./infra/vm/scripts/deploy.sh
```

The first run can take 15–30 minutes because it builds both application images and downloads the
ClamAV signature database. The script waits up to 15 minutes after startup and shows diagnostic
logs if readiness fails.

Monitor manually in another SSH session if required:

```bash
cd /opt/auditsphere/app
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml ps
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml logs -f clamav api web caddy
```

Caddy obtains and renews a public TLS certificate when the domain resolves to the VM, ports 80/443
are reachable and its `/data` volume persists. Official references:
https://caddyserver.com/docs/automatic-https and https://caddyserver.com/docs/running#docker-compose

## 9. Load presentation data safely

The live deployment does **not** use the local `Admin123!` password. The environment generator
creates a long private `DEMO_PASSWORD` for all synthetic presentation accounts.

Seed once:

```bash
./infra/vm/scripts/seed-demo.sh --confirm-synthetic-presentation-data
```

Retrieve the presentation password only in the private SSH session:

```bash
grep '^DEMO_PASSWORD=' infra/vm/.env.vm
```

Store it in the approved password manager and clear the terminal before screen sharing:

```bash
clear
```

Useful accounts:

| Email | Presentation view |
| --- | --- |
| admin@bdo-ea.com | Administration |
| partner@bdo-ea.com | Partner dashboard |
| manager@bdo-ea.com | Engagement and finding management |
| senior@bdo-ea.com | Fieldwork/workpapers |
| owner@client.example | Restricted client portal |
| reviewer@client.example | Management review portal |
| committee@client.example | Read-only committee view |

All use the generated private demo password. Do not distribute the password beyond the
presentation team and designated client demonstrators.

## 10. Verify before sharing the URL

```bash
./infra/vm/scripts/verify-live.sh
```

Then test from a browser that is not logged in to the VM:

1. `http://HOSTNAME` redirects to `https://HOSTNAME`.
2. The browser shows a valid certificate for the exact hostname.
3. Sign in as manager and open `IA-2026-001`.
4. Sign out and sign in as `owner@client.example`.
5. Confirm the owner sees only assigned portal requests/actions.
6. Upload only a harmless synthetic test file and confirm it completes after malware scanning.
7. Confirm no infrastructure consoles are reachable on ports 3000/4000/5432/9000/9001.
8. Confirm AI is shown as disabled/local and does not send data to a model provider.

API readiness can be checked at:

```text
https://HOSTNAME/api/v1/ready
```

## 11. Configure nightly backups

Still as the `auditsphere` user, create the first backup:

```bash
./infra/vm/scripts/backup.sh
ls -lah /opt/auditsphere/backups
```

Return to the administrator shell and install the timer:

```bash
exit
sudo cp /opt/auditsphere/app/infra/vm/systemd/auditsphere-backup.service /etc/systemd/system/
sudo cp /opt/auditsphere/app/infra/vm/systemd/auditsphere-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now auditsphere-backup.timer
sudo systemctl list-timers auditsphere-backup.timer
```

The backup contains a PostgreSQL custom dump, the MinIO document volume, Caddy certificate state
and checksums. It intentionally excludes `.env.vm`; protect that separately in a secrets manager.
Copy backups off the VM or enable provider snapshots—backups on the same disk are not disaster
recovery.

## 12. Day-of-presentation checklist

Run 30–60 minutes before the meeting:

```bash
sudo -iu auditsphere
cd /opt/auditsphere/app
./infra/vm/scripts/verify-live.sh
./infra/vm/scripts/backup.sh
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml logs --tail 100 api worker web caddy
```

Also confirm:

- The presenter can sign in using a private/incognito browser.
- The manager and owner portal journeys needed for the demo work.
- The generated demo password is available privately, not on a slide.
- No real client documents or names have been uploaded.
- The VM disk has at least 20 GB free: `df -h`.
- The technical owner remains reachable during the presentation.

## 13. Routine operations

Status:

```bash
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml ps
```

Logs:

```bash
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml logs --tail 200 api worker web caddy
```

Restart application services without touching data:

```bash
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml restart api worker web caddy
```

Stop everything while preserving volumes:

```bash
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml stop
```

Start again:

```bash
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml start
```

Never run `docker compose down -v` on the VM; `-v` deletes the database, documents, scanner
signatures and TLS state.

## 14. Update procedure

1. Take and copy off a backup.
2. Keep the current deployment ZIP until the new version is accepted.
3. Upload/extract the new source into a staging directory.
4. Run its code checks before replacing `/opt/auditsphere/app`.
5. Preserve the existing `infra/vm/.env.vm`; never regenerate it during an update.
6. Change `RELEASE_TAG` in `.env.vm` to a unique new tag.
7. Run `preflight.sh`, then `deploy.sh`.
8. Run `verify-live.sh` and the manager/owner browser journeys.

The deploy script automatically takes a backup when it detects an existing API container.
Database migrations are forward-only. Reverting application source does not undo a migration, so
restore the pre-deploy database backup if an incompatible migration must be rolled back.

## 15. Emergency rollback

If the new release fails but no incompatible migration ran:

1. Restore the previous source folder.
2. Restore its previous `RELEASE_TAG` while keeping all secrets unchanged.
3. Run `deploy.sh` and `verify-live.sh`.

If data or schema changed, stop application services and restore the verified PostgreSQL/MinIO
backup with a database administrator. A restore is destructive to current VM data and must not be
improvised during a client meeting.

## 16. Presentation environment boundaries

- Only synthetic data is approved.
- AI remains disabled.
- Outbound email remains disabled unless an approved SMTP relay is configured.
- Document uploads fail closed if ClamAV is unavailable. The official image persists signatures;
  ClamAV recommends the `_base` image with a database volume and notes that the scanner needs
  substantial RAM: https://docs.clamav.net/manual/Installing/Docker.html
- PostgreSQL runs with the schema-owning application account because current non-transactional
  Prisma reads cannot set the RLS tenant session. The port is internal-only, and API query scoping
  remains the primary tenant control.
- Run the dedicated database-backed end-to-end suite and an independent penetration test before
  any real-client pilot.

## 17. Information to send back for deployment support

If deployment fails, send only:

```bash
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml ps
docker compose --env-file infra/vm/.env.vm -f infra/vm/compose.yml logs --tail 200 caddy clamav api web
```

Redact tokens, email addresses, domains if required and any accidental secrets. Never send
`.env.vm`, the output of `grep DEMO_PASSWORD`, database dumps or document-volume archives.
