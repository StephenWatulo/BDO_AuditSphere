# Incident, recovery and rollback runbook

Keep an approved copy available outside the AuditSphere VM. Replace all placeholder contacts before launch.

## Severity and first actions

| Event | Immediate action |
|---|---|
| Suspected data disclosure, stolen credential or tenant-boundary failure | Disable public access at the firewall/WAF, preserve logs, revoke affected sessions/accounts and notify security/privacy immediately |
| Malware upload/detection | Keep the object quarantined, preserve event metadata, notify security and do not download or forward the file |
| Database corruption or destructive change | Stop API/worker/web, preserve current disks/logs, notify database owner and select the approved restore point |
| VM/disk loss | Provision the approved replacement, restore secrets from vault, restore PostgreSQL and documents from the off-server backup |
| Certificate/DNS outage | Keep backend ports private, correct DNS/NAT/certificate path and do not bypass TLS for users |
| Application regression after release | Stop services, preserve logs, restore the previous compatible application release; restore the database only if migration compatibility requires it |

## Containment commands

Run as Administrator. Record UTC time, operator and ticket before each action.

```powershell
Stop-Service AuditSphere.Caddy
Stop-Service AuditSphere.Web
Stop-Service AuditSphere.Worker
Stop-Service AuditSphere.Api
Get-Date -AsUTC
Get-Service 'AuditSphere.*'
```

If compromise is suspected, also block inbound 80/443 at the firewall or upstream WAF. Do not delete logs, temporary files, accounts or database rows until security approves evidence handling.

## Credential response

- User password suspected: suspend the user or reset the password; all refresh sessions are revoked.
- MFA device/recovery codes lost: a different administrator uses **Reset MFA**; sessions are revoked and production policy forces re-enrolment.
- JWT secret suspected: rotate both JWT secrets, restart API/worker, and treat all sessions as invalid. Existing refresh tokens should also be revoked in the database under DBA/application-owner supervision.
- Database password suspected: stop application services, change the PostgreSQL role password, update the protected environment file, restart and verify.
- `ENCRYPTION_KEY` suspected: take the service offline, involve security, rotate/re-enrol encrypted MFA material through an approved migration. Do not simply replace the key while encrypted values still depend on it.

Never send credentials, MFA secrets, recovery codes, cookies or the environment file in email/chat/tickets.

## Standard backup

```powershell
Set-Location C:\AuditSphere\app
.\infra\windows\scripts\Backup-AuditSphere.ps1
```

Success requires: exit success, a new custom-format database dump, `pg_restore --list` verification, a SHA-256 manifest and a current off-server document mirror. The mirror must then be protected by separately administered versioned snapshots or immutable/offline backup; `/MIR` alone propagates deletions. Monitoring must alert when the most recent verified dump or protected copy exceeds the RPO.

## Restore rehearsal or approved recovery

Never first test restore during a real incident. Rehearse on a separate database/server. For production recovery:

1. obtain incident/change approval and choose a verified dump timestamp;
2. stop all four AuditSphere services;
3. snapshot/preserve the current VM disks and logs when possible;
4. run the restore script with the explicit confirmation switch;
5. verify migrations, services, readiness and synthetic smoke tests;
6. security/application owners decide when public access may reopen.

```powershell
Set-Location C:\AuditSphere\app
.\infra\windows\scripts\Restore-AuditSphere.ps1 `
  -DatabaseDump '\\backup01\auditsphere-production\database\auditsphere-YYYYMMDD-HHMMSS.dump' `
  -ConfirmRestore
pnpm db:status
.\infra\windows\scripts\Start-Services.ps1
.\infra\windows\scripts\Test-Deployment.ps1
```

The restore script preserves the existing document directory as a timestamped pre-restore copy before placing the backup mirror. It cleans and restores database objects, so the confirmation and service-stop gates are mandatory.

## Application rollback

1. stop Caddy, web, worker and API;
2. preserve the failing release and logs;
3. restore the previously approved source/build to `C:\AuditSphere\app` without reusing foreign `node_modules`;
4. install locked dependencies and generate Prisma on Windows;
5. confirm whether the old release is compatible with the current database;
6. if compatible, start and verify; if not, follow the approved database restore process and communicate the accepted data-loss window.

Never run development migrations, demo seed, `git reset --hard`, or an unreviewed SQL fix against production.

## Evidence to collect

- UTC timeline and people involved;
- monitoring alert and request IDs;
- application, Caddy, PostgreSQL, Defender, Windows System/Application and firewall/WAF logs;
- affected accounts, tenants, document IDs and IPs—without copying client document content unnecessarily;
- release hash, environment/config version, last backup/restore test;
- containment, recovery and validation commands/results;
- client/regulator notification decisions made by the authorised privacy/legal owner.

## Closure

Do not close an incident until containment is verified, service/data integrity is tested, credentials are rotated as needed, client/legal communications are decided, root cause and corrective actions have owners/dates, and monitoring proves the condition no longer recurs.
