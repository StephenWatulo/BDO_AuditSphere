# Functional scope and limitations

This document prevents the launch team from promising features based only on mock-ups or roadmap text. “Implemented” means source routes/UI exist and automated tests cover core behavior; every item still needs target-environment UAT.

## Implemented production candidate

| Area | Implemented capability | Production note |
|---|---|---|
| Identity | Local email/password, lockout, forced first-password change, TOTP MFA, recovery codes, rotating refresh sessions | Production enforces MFA for every local account |
| Administration | User creation/invitation, role assignment, suspension/deactivation, admin reset of another user's password or MFA | Temporary passwords are shown once; use an approved secure channel |
| Access control | Tenant scoping, role/permission checks, document classification and object-level access rules | Must pass cross-user/cross-tenant UAT |
| Audit universe | Universe entities and hierarchy | UAT data ownership and navigation |
| Risk and controls | Risk register, scoring and control records | Scoring rules are application rules, not a substitute for methodology approval |
| Planning | Audit plans, engagements, resource/capacity views | Validate dates, currencies and approval workflow |
| Fieldwork | Programs, procedures, workpapers, review notes and sign-offs | Validate required evidence and reviewer segregation |
| Findings | Findings, actions, management responses and status flow | Client portal roles must be tested carefully |
| Requests/portal | Document requests, business-owner responses, notifications | SMTP must be configured for full notification behavior |
| Documents | Upload/download, checksum, 50 MiB limit, quarantine, Defender or ClamAV scanning, filesystem/S3 drivers | Windows launch uses protected filesystem + Defender and off-server backup |
| Reporting | Implemented dashboard views and report/export routes | Test each required client report against the presentation script |
| Audit trail | Security/domain events with secret redaction | Forward logs and define retention |
| Operations | Health/readiness probes, structured logs, background worker, backup/restore scripts | External monitor and restore rehearsal required |

## Present in code but disabled until separately approved

| Capability | Default | What is required to enable it |
|---|---|---|
| AI assistance | `AI_ENABLED=false` | Approved provider, contract/DPA, data-location decision, prompt/output retention rules, access controls, evaluation, human-review policy and cost controls |
| Microsoft Entra ID | Unconfigured | Entra app registration, exact redirect URI, tenant policy, role/provisioning decision and sign-in UAT |
| S3-compatible storage | Not used on Windows path | Supported object-store service, private bucket, versioning, encryption, backup/replication and tested credentials |

## Not implemented — do not promise for this launch

- offline/PWA operation;
- native ERP connectors or automated source-system ingestion;
- GraphQL API;
- Microsoft Teams or Outlook integration;
- self-service “forgot password” email flow (administrators can securely reset another local user's password);
- automatic continuous-monitoring feeds from client systems;
- multi-node high availability, automated database failover or zero-downtime upgrades;
- a Windows installer that installs third-party prerequisites;
- formal regulatory certification, penetration-test attestation or a vendor support SLA.

Roadmap text, architecture diagrams and UI placeholders are not delivery evidence. If the client presentation depends on an item in this section, remove that promise or commission and test the feature before launch.

## Known architectural concern

PostgreSQL RLS is enabled in the schema, but the application sets tenant session context only in explicit Prisma transactions while many reads use normal tenant-filtered queries. Consequently, the current runtime database role must own the schema for the application to function. Database exposure is compensated by localhost-only binding, a protected credential and API-layer tenant/object checks. Least-privilege RLS cannot be claimed until all tenant access runs inside a transaction-scoped database context and is verified with a non-owner role.

## Definition of “fully working” for this release

The release is fully working only for the implemented rows above when all of these are true:

1. automated checks pass on the target Windows VM;
2. every workflow required by the client presentation passes with synthetic UAT data;
3. access-boundary tests pass with at least two roles;
4. email, scanning, backup, restore, monitoring and reboot recovery pass;
5. no BLOCKED launch gate remains;
6. the application owner signs this exact scope.

