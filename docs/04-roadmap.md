# BDO AuditSphere - Product Roadmap

Positioning: an audit operating platform that combines TeamMate+ depth of working papers,
AuditBoard breadth of GRC, and an AI copilot embedded in every step, delivered with a
Microsoft 365-grade experience. Each phase ships production code, migrations, API docs, tests
and deployment notes.

## Phase 1 - Core platform

| Area | Scope |
|---|---|
| Monorepo, CI, Docker, Kubernetes | pnpm + Turborepo, GitHub Actions, multi-stage images, Kustomize base |
| Database | Full Prisma schema for all modules, initial migration, RLS and audit-trail triggers, seed with roles, permissions, frameworks and a demo tenant |
| Authentication | Local login (argon2id), Entra ID OIDC with PKCE, TOTP MFA, rotating refresh tokens, lockout |
| Access control | 9 roles, permission matrix, route guards, entity-scoped roles, segregation-of-duties guards |
| Audit trail | Service plus append-only table plus DB trigger |
| Audit universe | Entity tree, processes, owners, risk rating, last audit date |
| Engagements | Lifecycle state machine with guards, team, stakeholders, milestones, stage history |
| Programmes | Steps, assignment, instantiate from library |
| Workpapers | Templates, versions, review notes, review and sign-off, locking |
| Documents and evidence | S3-compatible storage, presigned upload and download, versions, classification, evidence register |
| Findings | Full field set, status machine, recommendations, ageing, reminder and escalation job |
| Document requests | Portal for business owners, reminders |
| Web app | Shell, sign-in, dashboard, universe, engagements, workpapers, findings, requests, admin |
| Tests | Unit tests on shared rules, API e2e against Postgres |

## Phase 2 - Risk, controls and insight

- Risk assessment engine UI: heat maps, custom scoring models, assessment periods, appetite.
- Controls repository, risk-control matrix, control testing (design and operating) with exceptions.
- Annual and multi-year planning: coverage analysis, capacity planning, budget, approval flow.
- Time and resources: timesheets, charge codes, availability, utilisation.
- Dashboards: Audit Committee, Partner, Auditor; scheduled PDF exports.
- Library: full framework content packs (COSO, COBIT, ISO 31000, ISO 27001, IFRS, SOX, IIA).

## Phase 3 - AI copilot, continuous auditing, integrations

- Copilot features across planning, fieldwork, evidence analysis, findings, reporting and
  quality checks against IIA Standards and BDO methodology.
- Natural-language audit search, automated report writer, AI risk radar feeds.
- Knowledge graph API (GraphQL) and visual explorer.
- Continuous monitoring: connectors (D365, SAP, SQL, CSV), rule engine, alert workflow.
- Teams and Outlook notifications through Microsoft Graph.

## Phase 4 - Mobile auditor app

- Installable PWA with offline inspections, photo and voice-note capture, background sync.
- Native wrappers (Capacitor) for app-store distribution if required.

## Cross-cutting quality gates

- 80% or higher unit coverage on shared rules and services; e2e suites per module.
- OWASP ASVS level 2 review before each release; dependency and container scanning in CI.
- Performance budget: p95 API latency under 300 ms for list endpoints at 10k engagements per tenant.
- Accessibility: WCAG 2.1 AA on all screens.
