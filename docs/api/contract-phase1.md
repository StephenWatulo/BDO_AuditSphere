# AuditSphere API contract - Phase 1

Base path: `/api/v1`. The generated OpenAPI document lives at `/api/docs` (Swagger UI) and
`/api/docs-json`. This file is the hand-written contract both `apps/api` and `apps/web` build
against; the OpenAPI output must match it.

## Conventions

- JSON in and out. Dates are ISO-8601 strings. IDs are UUIDs.
- Authentication is cookie based: `as_access` (JWT, 15 min) and `as_refresh` (opaque, 30 days,
  rotating). Both httpOnly, SameSite=Lax, `Secure` when `COOKIE_SECURE=true`, path `/`.
  The web app proxies `/api/*` to the API through Next.js rewrites, so cookies are same-origin.
- Every response carries `x-request-id`.
- List endpoints accept `page` (1-based, default 1), `pageSize` (default 25, max 200), `q`
  (free text), `sort` (`field:asc|desc`) and return
  `{ items: T[], total: number, page: number, pageSize: number }`.
- Errors: `{ statusCode, error, message: string | string[], requestId }`.
  - 401 not authenticated, 403 missing permission, 404 not found or not in tenant,
    409 conflict (duplicate code, stale version), 422 workflow guard failed with
    `{ ...error, guards: [{ guard: string, message: string }] }`.
- Every mutating call writes an `AuditTrail` row.

## Auth

| Method | Path | Body / notes | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ user }` and cookies, or `{ mfaRequired: true, mfaToken }` (mfaToken is a 5-minute JWT) |
| POST | `/auth/mfa/verify` | `{ mfaToken, code }` (code = TOTP or recovery code) | `{ user }` and cookies |
| POST | `/auth/refresh` | uses `as_refresh` cookie | `{ user }` and rotated cookies; reuse of a revoked token revokes the whole family |
| POST | `/auth/logout` | | 204, cookies cleared, refresh token revoked |
| GET | `/auth/me` | | `{ user }` |
| POST | `/auth/mfa/setup` | | `{ secret, otpauthUrl }` (secret stored encrypted, not yet enabled) |
| POST | `/auth/mfa/enable` | `{ code }` | `{ recoveryCodes: string[] }` |
| POST | `/auth/mfa/disable` | `{ code }` | 204 |
| GET | `/auth/entra/start` | `?returnTo=` | 302 to Entra authorize URL (PKCE, state cookie) |
| GET | `/auth/entra/callback` | `?code&state` | 302 to `WEB_BASE_URL` with cookies set; user provisioned by email on first login |
| POST | `/auth/password/change` | `{ currentPassword, newPassword }` | 204 |

`user` shape:

```json
{
  "id": "uuid", "email": "", "displayName": "", "firstName": "", "lastName": "",
  "jobTitle": "", "avatarUrl": null, "status": "ACTIVE", "authProvider": "LOCAL",
  "mfaEnabled": true, "roles": ["AUDIT_MANAGER"], "permissions": ["engagement:read", "..."],
  "tenant": { "id": "uuid", "slug": "bdo-ea", "name": "BDO East Africa" }
}
```

## Users and roles (`user:read`, `user:manage`)

- `GET /users` list (filters `status`, `role`). `GET /users/:id`. `POST /users`
  `{ email, displayName, firstName?, lastName?, jobTitle?, roles: RoleKey[], password? }`
  (without password the user is INVITED and a temporary password is returned once).
- `PATCH /users/:id` profile fields and `status`. `PUT /users/:id/roles` `{ roles: RoleKey[] }`.
- `GET /roles` returns roles with their permission keys.

## Audit universe (`universe:read`, `universe:manage`)

- `GET /universe/entities` returns the full tree `{ items: EntityNode[] }` where each node has
  `children`. `?flat=true` returns a paged flat list. Filters: `type`, `country`, `riskRating`.
- `GET /universe/entities/:id` includes `owner`, `processes`, `risks` (summary), recent
  `engagements` (last 5) and `openFindingsCount`.
- `POST`, `PATCH /universe/entities/:id`, `DELETE` (soft). Fields per Prisma `AuditEntity`.
- `GET /universe/processes?entityId=`, `POST /universe/processes`, `PATCH /universe/processes/:id`.
- `GET /universe/coverage` returns `{ total, auditedLast12Months, auditedLast36Months,
  neverAudited, byType: [{ type, total, covered }] }`.

## Risks (`risk:*`)

- `GET /risks` filters `entityId`, `processId`, `categoryId`, `rating`, `status`.
- `POST /risks`, `PATCH /risks/:id`. Server recomputes scores with `scoreRisk` from
  `@auditsphere/shared` using the tenant default `ScoringModel`.
- `POST /risks/:id/assess` `{ periodLabel, inherentLikelihood, inherentImpact,
  controlEffectiveness, velocity, rationale }` creates a `RiskAssessment` and updates the risk.
- `GET /risks/heatmap` returns `{ cells: [{ likelihood, impact, count, rating }] }` for residual scores.
- `GET /risk-categories`, `POST`, `GET /scoring-models`, `POST`, `PATCH`.

## Controls (`control:*`)

- `GET /controls` filters `processId`, `type`, `nature`, `effectiveness`. `POST`, `PATCH`, `GET /:id`.
- `PUT /controls/:id/risks` `{ riskIds: [] }` sets the risk-control matrix.
- `POST /controls/:id/tests` creates a `ControlTest`; `PATCH /control-tests/:id`.

## Plans (`plan:*`)

- `GET /plans`, `POST /plans`, `GET /plans/:id` (with items and roll-ups
  `{ totalBudgetHours, byQuarter, byRating }`), `PATCH /plans/:id`.
- `POST /plans/:id/items`, `PATCH /plans/:id/items/:itemId`, `DELETE`.
- `POST /plans/:id/transition` `{ action, comment? }` using `PLAN_WORKFLOW`.
- `POST /plans/:id/items/:itemId/create-engagement` creates the engagement from the item.
- `GET /management-requests`, `POST`, `PATCH /:id`.

## Engagements (`engagement:*`)

- `GET /engagements` filters `stage`, `status`, `entityId`, `type`, `leadId`, `mine=true`.
  Items include `entity { id, name }`, `lead { id, displayName }`, `workpaperCount`,
  `openFindingsCount`, `progressPct`.
- `POST /engagements` `{ title, type, entityId?, objectives?, scope?, periodStart?, periodEnd?,
  plannedStart?, plannedEnd?, budgetHours?, leadId?, managerId?, partnerId?, riskRating? }`.
  `auditNumber` is generated as `IA-<year>-<seq>`.
- `GET /engagements/:id` includes members, stakeholders, milestones, stageHistory (last 20),
  counts and `availableActions` (transitions the current user may take, with guard results).
- `PATCH /engagements/:id`.
- `POST /engagements/:id/transition` `{ action, comment? }` using `ENGAGEMENT_WORKFLOW`. Guards:
  `has_objectives_and_scope`, `has_lead`, `programme_approved`, `all_workpapers_prepared`,
  `all_workpapers_signed_off`, `no_open_review_notes`, `all_findings_agreed_or_accepted`,
  `all_findings_closed`.
- `POST /engagements/:id/members` `{ userId, role, plannedHours? }`, `DELETE .../members/:userId`.
- `POST /engagements/:id/stakeholders`, `DELETE`. `POST /engagements/:id/milestones`, `PATCH`, `DELETE`.

## Programmes (`program:*`)

- `GET /engagements/:id/programs` (with steps), `POST /engagements/:id/programs`
  `{ title, description?, libraryItemId? }` (copies steps from the library item content).
- `POST /programs/:id/steps`, `PATCH /program-steps/:id`, `DELETE`, `POST /programs/:id/reorder`
  `{ stepIds: [] }`.
- `POST /programs/:id/approve` (requires `program:approve`).
- `POST /program-steps/:id/create-workpaper` creates a linked workpaper with the step
  objective and procedure prefilled.

## Workpapers (`workpaper:*`)

- `GET /engagements/:id/workpapers` ordered by `sortOrder, reference`.
- `POST /engagements/:id/workpapers` `{ reference, title, objective?, procedure?, riskId?,
  controlId?, templateId?, programStepId? }`.
- `GET /workpapers/:id` includes versions (metadata only), reviewNotes, evidence (with
  document), preparedBy, reviewedBy, signedOffBy and `availableActions`.
- `PATCH /workpapers/:id` any content field. Rejected with 409 when `isLocked`. Every PATCH
  stores a `WorkpaperVersion` snapshot of the previous state and increments `currentVersion`.
- `GET /workpapers/:id/versions/:n` returns a snapshot.
- `POST /workpapers/:id/transition` `{ action, comment? }` using `WORKPAPER_WORKFLOW`. Guards:
  `has_procedure_and_conclusion`, `reviewer_is_not_preparer`, `signer_is_not_preparer`,
  `all_notes_addressed`, `no_open_review_notes`. Sign-off sets `isLocked=true` and writes a
  `Review` row; unlock clears it.
- `POST /workpapers/:id/review-notes` `{ text, priority?, assignedToId? }`.
- `PATCH /review-notes/:id` `{ response? }` moves OPEN to ADDRESSED; `{ clear: true }` moves to
  CLEARED (raiser or `workpaper:review`).
- `GET /workpaper-templates`, `POST`.

## Documents and evidence (`document:*`)

- `POST /documents/presign-upload` `{ fileName, mimeType, sizeBytes, ownerType, ownerId,
  classification? }` returns `{ documentId, uploadUrl, method: 'PUT', headers }`. With
  `STORAGE_DRIVER=local` the `uploadUrl` is `/api/v1/documents/:id/content` accepting a raw PUT
  body, so local development needs no S3.
- `POST /documents/:id/complete` `{ checksumSha256? }` marks upload finished.
- `POST /documents/upload` multipart (`file`, `ownerType`, `ownerId`, `classification?`)
  single-call alternative used by the web app.
- `GET /documents?ownerType=&ownerId=`, `GET /documents/:id`, `GET /documents/:id/download`
  returns `{ url, expiresAt }` (local driver streams from `/documents/:id/content`).
- `DELETE /documents/:id` (`document:delete`, soft).
- `GET /engagements/:id/evidence`, `POST /evidence` `{ engagementId, workpaperId?, documentId?,
  description, type, obtainedFrom?, obtainedAt? }` (reference auto `E-001`), `PATCH /evidence/:id`.

## Findings (`finding:*`)

- `GET /findings` filters `engagementId`, `entityId`, `status`, `severity`, `actionOwnerId`,
  `overdue=true`, `mine=true` (action owner = me, matched by user id or, case-insensitively,
  by `actionOwnerEmail`). Items include `engagement { id, auditNumber, title }`,
  `entity { id, name }`, `actionOwner`, `ageingBucket`, `daysOverdue`.
- `POST /findings` `{ engagementId, title, severity, condition, criteria, cause?, impact?,
  recommendation?, workpaperId?, riskId?, controlId?, processId?, entityId?,
  rootCauseCategory?, repeatOfId? }`; reference auto `F-01` per engagement.
- `GET /findings/:id` with recommendations, statusHistory, evidence, `availableActions`.
- `PATCH /findings/:id`. Business owners may edit only `managementResponse`, `actionOwnerId`,
  `actionOwnerName`, `actionOwnerEmail`, `dueDate`.
- `POST /findings/:id/transition` `{ action, comment? }` using `FINDING_WORKFLOW`. Guards:
  `has_condition_criteria`, `has_recommendation`, `has_management_response`,
  `has_action_owner_and_due_date`, `has_implementation_evidence`.
- `POST /findings/:id/extend` `{ dueDate, reason }` increments `extensionCount`.
- `POST /findings/:id/recommendations`, `PATCH /recommendations/:id`.
- `GET /findings/ageing` returns `{ buckets: [{ bucket, count }], bySeverity, overdueTotal }`.

## Document requests (`request:*`)

- `GET /requests` filters `engagementId`, `status`, `mine=true` (assignee = me, matched by user
  id or, case-insensitively, by `assigneeEmail`), `overdue=true`.
- `POST /requests` `{ engagementId, title, description?, assigneeId?, assigneeEmail?, dueDate }`.
- `GET /requests/:id` with documents and `availableActions`. `PATCH /requests/:id`.
- `POST /requests/:id/transition` `{ action, comment? }` using `REQUEST_WORKFLOW`. Guard
  `has_attachment_or_response` (at least one document or a `responseNote`).
- `POST /requests/:id/documents` `{ documentId }` links an uploaded document.

## Time and resources (`time:*`, `resource:*`)

- `GET /resources/summary` returns the current user's week, active charge codes, pending
  approvals, 28-day utilisation and upcoming staff availability.
- `GET /charge-codes` lists active charge codes.
- `GET /timesheets` filters `mine`, `userId`, `status`, `weekStart`, `q`.
- `POST /timesheets/current` `{ weekStart? }` opens or returns the signed-in user's timesheet
  for that week.
- `POST /timesheets/:id/entries`, `PATCH /time-entries/:id`, `DELETE /time-entries/:id`
  manage entries while the owner timesheet is `OPEN` or `REJECTED`.
- `POST /timesheets/:id/submit`; `POST /timesheets/:id/approve` and
  `POST /timesheets/:id/reject` require `time:approve` and enforce segregation of duties.
- `GET /resources/availability` filters `userId`, `type`, `from`, `to`, `q`.
- `POST /resources/availability`, `PATCH /resources/availability/:id` manage availability
  constraints for capacity planning.

## Collaboration

- `GET /tasks?mine=true&status=`, `POST /tasks`, `PATCH /tasks/:id`.
- `GET /comments?targetType=&targetId=`, `POST /comments` `{ targetType, targetId, body,
  parentId?, isInternal? }`.
- `GET /notifications?unread=true`, `POST /notifications/:id/read`, `POST /notifications/read-all`.
- `GET /audit-trail?targetType=&targetId=&actorId=&from=&to=` (`audit_trail:read`).

## Library (`library:*`)

- `GET /library/items?type=&status=&q=`, `GET /library/items/:id`, `POST /library/items`,
  `PATCH /library/items/:id` (creates a new version when status is PUBLISHED),
  `POST /library/items/:id/submit`, `POST /library/items/:id/approve`, `POST /library/items/:id/retire`.
- `GET /library/frameworks` with references.

Library `AUDIT_PROGRAM` content shape:

```json
{ "sections": [ { "name": "Planning", "steps": [ { "reference": "P.1", "objective": "", "procedure": "", "estimatedHours": 2 } ] } ] }
```

## Dashboards and search

- `GET /dashboards/auditor` `{ assignedSteps, openReviewNotes, pendingReviews, deadlines,
  myFindings, myRequests }` (counts and top-5 lists).
- `GET /dashboards/partner` `{ engagementsByStage, budgetVsActual, utilisation, overdueMilestones }`.
- `GET /dashboards/committee` `{ riskProfile (heatmap counts), planProgress, keyFindings,
  repeatFindings, overdueActions (ageing buckets), riskTrend }`.
- `GET /search?q=` returns `{ engagements: [], findings: [], workpapers: [], entities: [],
  risks: [], controls: [] }` with at most 5 per group.

## Reports (`report:read`)

- `GET /reports/executive?from=&to=` returns executive metrics and narrative sections for
  committee reporting, with dashboard source data attached for drill-down.
- `GET /reports/findings` returns a paged finding register with severity, status and ageing
  roll-ups. Filters: `status`, `severity`, `q`, pagination and sort.
- `GET /reports/engagements` returns a paged engagement register with stage and opinion
  roll-ups. Filters: `stage`, `status`, `leadId`, `q`, pagination and sort.
- `GET /reports/engagements/:id` returns a draft engagement report assembled from scope,
  objectives, workpapers, evidence and findings.

## AI copilot (`ai:use`)

- `POST /ai/copilot` `{ feature, prompt, targetType?, targetId?, context? }` records an
  `AiInteraction` and returns a structured response `{ title, narrative, suggestions,
  checklist, caveats, provider, model, createdAt, interactionId }`.
- `GET /ai/interactions` lists recent interactions for the current user. Filters:
  `feature`, `targetType`, `targetId`, `q`, pagination.
- `PATCH /ai/interactions/:id` stores user feedback `{ accepted?, rating?, feedback? }`.
- When `AI_ENABLED=false` or no provider key is configured, the API uses deterministic local
  rulepacks so the feature remains usable in local/demo environments.

## Continuous monitoring (`monitoring:*`)

- `GET /monitoring/summary` returns signal and alert status counts, active rules/connectors
  and open alerts assigned to the current user.
- `GET /monitoring/signals`, `PATCH /monitoring/signals/:id` list and triage risk-radar
  signals. Filters: `status`, `source`, `riskId`, `q`, pagination.
- `GET /monitoring/alerts`, `PATCH /monitoring/alerts/:id` list and update continuous audit
  alerts. Filters: `status`, `ruleId`, `assigneeId`, `q`, pagination.
- `GET /monitoring/rules`, `POST /monitoring/rules`, `PATCH /monitoring/rules/:id` manage
  monitoring rules linked to data connectors.
- `GET /monitoring/connectors` lists configured data connectors and their last run state.

## Operational

- `GET /health` liveness, `GET /ready` checks database and storage.
