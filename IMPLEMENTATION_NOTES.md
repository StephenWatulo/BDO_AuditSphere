# AuditSphere improvement record

This folder is the improved working baseline derived from the newer GitHub snapshot. It keeps
the OneDrive copy untouched as historical reference. The changes below address the material
issues found during the technical review; they do not constitute a production accreditation.

## Implemented

- Added record-level authorisation for engagements, findings, requests, tasks, comments and
  documents. Portal users now see only work assigned to them or explicitly shared through an
  engagement, finding or request relationship.
- Applied the same scope to report data and blocked portal-only users from executive reports.
- Restricted private AI-context documents to their uploader and prevented cross-user mentions,
  task assignment and association tampering from the portal.
- Made new uploads quarantined by default. Production can fail closed against a ClamAV-compatible
  scanner; local development may explicitly skip scanning.
- Changed Docker and Kubernetes document storage to durable S3-compatible storage rather than
  container-local files.
- Removed example Kubernetes secrets from the deployable Kustomize base and made the migration
  credential separately configurable. The current application runtime must still use the schema
  owner; see the database note below.
- Made the default database seed reference-only. Synthetic Baraka Holdings data now requires the
  explicit `db:seed:demo` command and is blocked when `NODE_ENV=production`.
- Added one-time tenant/admin bootstrap with a strong temporary password. The application now
  forces that administrator to replace it before any normal operation.
- Added dependency overrides/upgrades that reduce the production dependency audit to zero known
  advisories at the time of verification.
- Added deployment invariant checks, dependency auditing, CodeQL and Gitleaks workflows.
- Corrected architecture documentation so Redis queues, GraphQL, ERP connector execution and
  offline/PWA operation are clearly roadmap items rather than implemented features.
- Added audit events for notification read-state changes.

## Verification completed

- API unit tests: 29 suites, 265 tests passed.
- Shared package unit tests: 2 files, 13 tests passed.
- API and web ESLint: passed with zero warnings.
- TypeScript checks: shared, database, database bootstrap script, API and web passed.
- Production builds: shared, database, API and Next.js web passed.
- Deployment safeguard verifier: passed.
- Production dependency audit: zero known advisories at the time of the run.

Database-backed end-to-end tests require a separate migrated test database. They are included
in the repository and should be run on the target laptop or CI with `E2E_DATABASE_URL` before a
pilot release. A penetration test remains mandatory before any live client data is introduced.

## Known boundaries and production prerequisites

- The local demo deliberately has AI disabled and malware scanning disabled. Never place real
  client evidence in that configuration.
- The Kubernetes production overlay expects a separately operated ClamAV service at the configured
  hostname; that service is not bundled here.
- Configure a managed PostgreSQL instance, private versioned object storage, HTTPS, a secrets
  manager, SMTP, Entra ID and centralized logs for production. The present Prisma access pattern
  performs many reads outside interactive transactions, so a non-owner RLS runtime role would see
  no tenant rows. Use the schema owner for the application until every query sets `app.tenant_id`
  transactionally; keep the database private and rely on API tenant scoping in the interim.
- Enforce MFA in Microsoft Entra Conditional Access. Local audit-role accounts are prompted to
  enrol, but organisation policy and operational monitoring are still required.
- Test backup restoration, document quarantine, tenant isolation and recovery procedures in a
  staging environment.
- Continuous connector execution, Redis-backed jobs, GraphQL, native/offline mobile support,
  Teams/Outlook integration and self-service forgotten-password recovery are not implemented.

For laptop instructions, use `LOCAL_SETUP_GUIDE.md`.
