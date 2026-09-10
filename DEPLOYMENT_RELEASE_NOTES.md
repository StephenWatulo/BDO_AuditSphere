# AuditSphere Windows production candidate — release notes

Release date: 2026-09-10  
Application version: 0.1.0  
Deployment target: Windows Server 2022/2025, on-premises, single VM

## What this release changes

- Adds a supported Windows-native deployment path using Node.js services, PostgreSQL, Caddy, WinSW and Microsoft Defender.
- Adds generated protected production and backup environment files, preflight checks, locked build/test steps, database initialization/migration, administrator bootstrap and Windows service installation.
- Adds health/security verification, off-server database/document backup, guarded restore and incident/rollback procedures.
- Enforces MFA for all local production accounts and prevents normal application use until enrolment is complete.
- Adds administrator password reset and MFA reset with session revocation and audit events.
- Makes production uploads fail closed through Microsoft Defender scanning.
- Disables Swagger and AI by default in production and strengthens environment validation, cookie/origin checks and secret validation.
- Corrects the invitation response contract between the API and web application.
- Documents implemented functionality, known limitations and the current PostgreSQL RLS/runtime-role constraint.

## Verification completed in the preparation environment

| Check | Result |
|---|---|
| API unit/integration suites | PASS — 31 suites, 272 tests |
| Shared package tests | PASS — 2 files, 13 tests |
| API and web type-check | PASS |
| API and web lint | PASS |
| API production build | PASS |
| Next.js production build | PASS |
| Windows deployment static safeguard verifier | PASS |
| Existing Linux VM safeguard verifier | PASS |

The PowerShell scripts could not be executed against a Windows target in the Linux preparation environment. Therefore `Build-Release.ps1`, `Preflight.ps1`, `Test-Deployment.ps1`, the synthetic-data UAT, backup/restore rehearsal and reboot recovery **must pass on the actual VM** before client data is allowed.

## Required launch decisions

- The supplied topology is a single-server initial production design and is not highly available. Record an accepted RPO/RTO and signed single-VM risk decision.
- Configure SMTP, external monitoring, a protected off-server backup share and versioned immutable/offline backup.
- Confirm contract, privacy, residency, retention, incident notification and hosting approval for client data.
- Keep AI disabled unless a separately approved provider, DPA/data-location position, access model, evaluation and human-review process are completed.
- Do not promise the capabilities listed as not implemented in `FUNCTIONAL_SCOPE_AND_LIMITATIONS.md`.

## Authoritative operator documents

1. `PRODUCTION_DEPLOYMENT_GUIDE_WINDOWS.md`
2. `PRODUCTION_READINESS_CHECKLIST.md`
3. `FUNCTIONAL_SCOPE_AND_LIMITATIONS.md`
4. `INCIDENT_AND_RECOVERY_RUNBOOK.md`

This package is a production **candidate**, not evidence that the application is already production-safe or live. Only the signed readiness checklist and target-environment evidence can support a GO decision.
