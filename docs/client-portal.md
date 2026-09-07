# Client portal

The client portal is the business-side surface of AuditSphere (journey J4 in
[03-user-journeys.md](03-user-journeys.md)). It lets a provisioned business owner respond to
document requests and provide management responses to findings without seeing the audit
workspace. It lives under `/portal` in the web app and uses the existing REST API; there is no
separate authentication path.

## Who lands there

Access is permission based, not role based:

- Anyone holding `request:respond` or `finding:respond` may open `/portal`. Other signed-in
  users see an explanatory message with a link back to the workspace.
- Users with those permissions and none of the workspace permissions (`dashboard:*`,
  `universe:read`, `risk:read`, `control:read`, `plan:read`, `report:export`) are treated as
  portal-only. Signing in without a `returnTo` sends them to `/portal`, and opening `/`
  redirects there. With the seed this is the `BUSINESS_OWNER` role (`owner@client.example`).
- Users who can respond but also hold workspace permissions (the seeded
  `MANAGEMENT_REVIEWER`, `reviewer@client.example`) keep the workspace as their home and get a
  "Client portal" entry in the navigation. Inside the portal a "Workspace" button takes them
  back.

The helpers live in `apps/web/lib/auth.tsx` (`canUsePortal`, `isPortalOnlyUser`,
`homePathFor`). The Next.js middleware still only checks for a session cookie; the API remains
the authority for what a user may read or change.

## Sections

| Route | Content |
| --- | --- |
| `/portal` | Greeting, four tiles (requests needing action, findings awaiting a response, actions in progress, completed), a "Needs your attention" list sorted by due date, and the five most recent requests and actions. |
| `/portal/requests` | The user's document requests with tabs Needs action, Submitted, Completed, All. |
| `/portal/requests/:id` | The request text, document upload and list, the response note, the workflow action (Submit or Resubmit), a discussion thread and the request details. Status banners explain returned, submitted and accepted states. |
| `/portal/actions` | Findings where the user is the action owner, with tabs Awaiting response, In progress, Under validation, Closed, All. |
| `/portal/actions/:id` | The management response, action owner and target date (editable while the API allows it), implementation evidence upload once the finding is agreed, the read-only finding text and recommendations, the workflow actions (Agree finding, Start implementation, Request validation), discussion and history. |

Data comes from `GET /requests?mine=true` and `GET /findings?mine=true`. Both filters now match
the signed-in user by id and, case-insensitively, by the `assigneeEmail` or `actionOwnerEmail`
recorded on the record, so a request addressed to an email before the account existed still
appears once that person is provisioned.

Portal pages reuse the workspace components for uploads, document lists, workflow actions,
comments and editable fields, so guards, permissions, audit trail entries and notifications
behave exactly as they do in the workspace. Comment threads in the portal never expose the
internal-only toggle. Notification deep links that point at `/requests/:id` or `/findings/:id`
are rewritten to their portal equivalents when opened from the portal bell.

## What the API enforces

Nothing in the portal relies on the client for authorisation:

- A responder without `request:manage` may only edit `responseNote` on a request, and only
  when it is assigned to them or unassigned. Submitting requires a note or an uploaded
  document (`has_attachment_or_response`).
- A responder without `finding:manage` may only edit `managementResponse`, `actionOwnerId`,
  `actionOwnerName`, `actionOwnerEmail` and `dueDate`, and only while the finding is in
  MANAGEMENT_REVIEW, AGREED or IMPLEMENTATION. Agreeing requires a response, an action owner
  and a due date; requesting validation requires implementation evidence.
- Every change writes an `AuditTrail` row and notifies the auditor who raised the item.

Known limitation: `request:read` and `finding:read` are tenant-wide, so a business owner who
types a workspace URL by hand can still read other requests and findings in the tenant. The
portal only lists their own items. Narrowing those permissions for responder roles is tracked
as a hardening item, not a portal feature.

## Verification

`pnpm --filter @auditsphere/api test:e2e` includes a business-owner block: `mine=true` scoping,
the responder field restrictions, submitting a request, and agreeing a finding through to the
evidence guard. `pnpm --filter @auditsphere/api test` covers the where-clause builders.

With the seeded database and both dev servers running, `node scripts/verify-portal.mjs`
signs in as the seeded business owner in installed Chrome, checks the redirect to `/portal`,
the overview counts, a full respond-and-submit flow on a synthetic request, the finding page,
mobile layouts, and that a staff account without responder permissions is turned away. The
synthetic engagement it creates is cancelled through the workflow at the end. Screenshots go to
`.local-dev/portal-check`. `SMOKE_URL`, `SMOKE_PASSWORD` and `SMOKE_BROWSER` are honoured as in
the other scripts.
