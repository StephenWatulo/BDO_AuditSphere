# Cowork brief: AuditSphere presentation with real screenshots

Paste the kick-off prompt at the bottom into Cowork, with this repository folder attached.
Everything Cowork needs to know about the system, the demo accounts, the shot list and the
slide outline is in this file. Fill in the two placeholders in the kick-off prompt first.

---

## 1. Objective

Produce a 16:9 PowerPoint deck that presents **BDO AuditSphere**, the internal-audit
management platform in this repository, using **real screenshots captured from the running
application**, not mock-ups. If an existing deck is supplied, keep its story and order where
it still fits, replace every mock-up, placeholder or hand-drawn screen with a real screenshot,
and add the sections below that it is missing.

Audience: BDO East Africa partners, internal audit leadership and prospective client audit
committees. Tone: confident, factual, no invented figures. Every number on a slide must be
visible in a screenshot or come from the docs listed in section 8.

## 2. Before Cowork starts (the user does this)

The app must be running locally. In a terminal in the repository folder:

```
pnpm db:local                          # embedded Postgres 17 on :5432, leave it running
pnpm db:deploy                         # migrations (safe to rerun)
pnpm db:seed                           # only on a fresh database
pnpm --filter @auditsphere/api dev     # API on http://localhost:4000
pnpm --filter @auditsphere/web dev     # web on http://localhost:3000
```

Then confirm `http://localhost:3000/sign-in` loads in Chrome.

Optional, for live model answers in AI Sphere: set `AI_ENABLED=true` and an `AI_API_KEY` in
`.env`, then restart the API (the API dev server does not watch for changes). Without this
the AI Sphere still works: it returns local drafts from its rule packs, and Audit
Intelligence Search runs from the local index. The deck must describe whichever mode was
used (see section 7).

## 3. Facts about the environment

| Item | Value |
| --- | --- |
| Web app | `http://localhost:3000` |
| API and Swagger | `http://localhost:4000/api/v1` and `http://localhost:4000/api/docs` |
| Tenant | BDO East Africa (slug `bdo-ea`) |
| Demo client | Baraka Holdings, a fictional Kenyan financial group (bank, insurance, shared services) |
| Password for every demo account | `Admin123!` (never place it on a slide) |
| Sign-in form | Email and password only. If an MFA screen appears, stop and tell the user. |
| Brand colours in the UI | BDO red `#ED1A3B`, charcoal text `#333F48`, page background `#F7F7F8`, white cards |

### Demo accounts and what each one is for

| Account | Role | Use it for |
| --- | --- | --- |
| `admin@bdo-ea.com` | Global Administrator | Sign-in, universe, risks, controls, library, monitoring, users, audit trail |
| `cae@bdo-ea.com` | Chief Audit Executive | Portfolio dashboard, annual plan, reports |
| `partner@bdo-ea.com` | Audit Partner | Alternative for the Portfolio dashboard and report sign-off views |
| `manager@bdo-ea.com` | Audit Manager | Engagements, workpapers, findings, requests, AI Sphere, resources |
| `senior@bdo-ea.com` | Senior Auditor | "My work" dashboard, tasks, notifications |
| `junior@bdo-ea.com` | Junior Auditor | Not needed unless a second auditor view is wanted |
| `owner@client.example` | Business Owner (portal only) | Client portal, desktop and mobile |
| `reviewer@client.example` | Management Reviewer | Shows the "Client portal" entry inside the workspace navigation |
| `committee@client.example` | Audit Committee Viewer | Audit committee dashboard |

### Seeded records worth showing

- Annual plan: **Internal Audit Plan FY2026** with items across quarters (P2P, UAM, Treasury,
  Loan origination and KYC, Insurance claims, Cash-in-transit vendor).
- Engagements: **IA-2026-001 Procure-to-pay process review** (in progress, richest data),
  **IA-2026-002 User access management review**, Payroll process review (completed, with four
  closed findings), Treasury dealing and liquidity limits review, Insurance claims processing
  review, Credit origination and KYC compliance review, IFRS 17 reporting readiness advisory,
  Fixed assets verification.
- Procure-to-pay workpapers: B.1.1 walkthrough, B.2.1 three-way match test, **B.2.2 Duplicate
  payment analytics**, B.3.1 vendor master change review, B.4.1 interview notes, C.1
  segregation of duties matrix.
- Procure-to-pay findings: F-01 (draft), **F-02 Duplicate invoice report not reviewed and
  duplicate payments made** (with management for response), F-03 vendor master data changes
  not independently reviewed (agreed, repeat finding).
- Procure-to-pay document requests: DR-001 vendor master change log, DR-002 ERP role
  assignments, DR-003 delegation of authority matrix.
- Monitoring: rules MR-001 Duplicate vendor payments and MR-002 Weekend and public holiday
  journal postings; three risk radar signals (CBK circular, payment diversion fraud, ODPC
  enforcement notice).

### Performance warning

The project lives on OneDrive and the web dev server compiles each route on first visit.
The first load of a page can take one to three minutes. Wait for the page heading and the
data to appear (no skeletons, spinners or "Loading" text) before capturing. If a page times
out, reload and wait again rather than concluding the feature is broken. Visit each route once
to warm it up before taking the final screenshot.

## 4. Capture rules

1. Chrome, light theme, window sized so the viewport is **1440 x 900**, browser zoom 100%,
   bookmarks bar hidden. Capture the page viewport, not the browser frame. Use a full-page
   capture only where the shot list says so.
2. Save screenshots to `.local-dev/presentation/` inside the repository (this folder is
   ignored by git). Name them `NN-section-account.png`, for example
   `14c-engagement-workpapers-manager.png`.
3. Keep a `shot-log.md` in the same folder: one line per screenshot with route, account,
   time, and any caveat. Note every screen that could not be captured and why.
4. **Read-only session.** Do not create, edit, delete, upload, approve, submit, agree, sign
   off, assign or close anything. Navigation, tabs, filters, search boxes and the AI Sphere
   prompt are fine (AI Sphere and search record only an interaction and an audit trail entry).
5. No empty states. If a screen or tab has no data, choose a different record from section 3
   instead of creating one. If none has data, log it and skip the shot.
6. Do not capture a screen showing an error toast, red banner, stack trace or console
   overlay. Reload, and if it persists log it and move on.
7. One consistent account per section so the top-right user badge does not jump between
   slides of the same topic.
8. Never include the password, `.env` contents, terminal windows or Swagger "Authorize"
   dialogs in a screenshot.

## 5. Shot list

Work through the accounts in this order to minimise sign-ins.

### A. `admin@bdo-ea.com`

| # | Route | Capture |
| --- | --- | --- |
| 01 | `/sign-in` | Sign-in page before logging in. |
| 02 | `/` | Home. If a view switcher offers "My work", "Portfolio" and "Audit committee", capture "My work" here. |
| 03 | `/universe` | Audit universe. Expand the Baraka Holdings tree so entities, processes, owners and risk ratings are visible. |
| 04 | `/risks` | Risk register. If there is a heat map or matrix view, capture the list and the heat map separately (04a, 04b). |
| 05 | `/controls` | Controls repository. Open one control that has a control test recorded (05b). |
| 06 | `/library` and `/library/frameworks` | Library items and the framework list (COSO, COBIT, ISO 31000, ISO 27001, IIA). |
| 07 | `/monitoring` | Four shots: Alerts tab, Risk radar tab, Rules tab, Connectors tab. Open one alert detail if available (07e). |
| 08 | `/admin/users` | User list with roles. |
| 09 | `/admin/audit-trail` | Audit trail with a mix of actions visible. |

### B. `cae@bdo-ea.com`

| # | Route | Capture |
| --- | --- | --- |
| 10 | `/` | Switch to the **Portfolio** view. The KPI tiles are Plan completion, Active engagements, Open findings, High/critical risks, Issued reports. |
| 11 | `/plans` then the FY2026 plan detail | Plan list (11a); plan detail with items, quarters, hours and approval status (11b). Full-page capture is acceptable for 11b. |
| 12 | `/reports` | Executive tab (12a), Findings tab (12b), Engagements tab (12c). Do not download anything. |

### C. `manager@bdo-ea.com`

| # | Route | Capture |
| --- | --- | --- |
| 13 | `/engagements` | Engagement list showing audit numbers, stages and leads. |
| 14 | Procure-to-pay engagement detail | One shot per tab: Overview (14a), Programme (14b), Documents (14c), Workpapers (14d), Evidence (14e), Findings (14f), Requests (14g), History (14h), Report (14i), Comments (14j). Skip any tab that is empty and log it. |
| 15 | Workpaper B.2.2 Duplicate payment analytics | Workpaper page with objective, work performed, conclusion, review notes and version history visible. Full-page capture is acceptable. |
| 16 | `/findings` | Findings list. Apply a filter that shows open findings across engagements. |
| 17 | Finding F-02 (Procure-to-pay) | Finding detail: condition, criteria, cause, impact, recommendation, management response, action owner, history. Full-page capture is acceptable. |
| 18 | `/requests` then DR-001 | Request list (18a) and one request detail (18b). |
| 19 | `/copilot` (AI Sphere) | 19a: capability selector with the eight capabilities visible. 19b: **Finding draft** run against finding F-02 or workpaper B.2.2, showing the Review tab. 19c: the Sources tab of the same run. 19d: **Audit Intelligence Search** with the query `duplicate payment findings and controls in procurement` and its results. 19e: **Quality check** run against workpaper B.2.2. 19f: **Evidence review** result if an exception register renders; otherwise skip and log. |
| 20 | `/resources` | Timesheets or utilisation view. |
| 21 | `/tasks` and `/notifications` | One shot each. |
| 22 | `/engagements/new` | The create-engagement form, empty. Do not submit. |

### D. `senior@bdo-ea.com`

| # | Route | Capture |
| --- | --- | --- |
| 23 | `/` | "My work" dashboard with the auditor's assigned items. |

### E. `owner@client.example` (client portal)

| # | Route | Capture |
| --- | --- | --- |
| 24 | `/portal` | Overview tiles and the "Needs your attention" list. Sign-in with this account lands here automatically. |
| 25 | `/portal/requests` and one request detail | List (25a) and detail (25b). Do not submit. |
| 26 | `/portal/actions` and the F-02 action detail | List (26a) and detail (26b) showing the finding text, management response and target date. Do not click Agree finding. |
| 27 | `/portal` at **390 x 844** | Same overview at phone width to show the responsive layout. Also capture 26b at phone width (27b). |

### F. `committee@client.example`

| # | Route | Capture |
| --- | --- | --- |
| 28 | `/` | Audit committee dashboard. |

### G. No sign-in required

| # | Route | Capture |
| --- | --- | --- |
| 29 | `http://localhost:4000/api/docs` | Swagger page with the endpoint groups collapsed so the breadth of the API is visible. |

## 6. Deck outline

Twenty-one slides, 16:9, white background, BDO red as the single accent colour, charcoal
text, one screenshot per slide as the hero unless stated. Add two to four speaker-note
bullets per slide. Put the footer "Demo data: Baraka Holdings is a fictional client" on every
slide that shows a screenshot.

| Slide | Title | Content | Screenshots |
| --- | --- | --- | --- |
| 1 | BDO AuditSphere | Internal audit management platform for BDO East Africa. Date, presenter. | 10 (Portfolio) as background hero |
| 2 | Why AuditSphere | One platform from audit universe to follow-up. Positioned against TeamMate+, AuditBoard and Diligent: working-paper depth, GRC breadth, AI in every step, Microsoft 365-grade experience. | none |
| 3 | Platform at a glance | Web app plus REST API on PostgreSQL. Tenant isolation on every table, append-only audit trail, Entra ID single sign-on with MFA, declarative workflow state machines, object storage for evidence. | 29 (Swagger) small |
| 4 | Roles and access | Nine roles, permission matrix, segregation-of-duties guards. Table of the nine roles. | 08 |
| 5 | Sign in and security | Local password or Entra ID, TOTP MFA, lockout, rotating sessions. | 01 |
| 6 | Home dashboards | Three views by role: My work, Portfolio, Audit committee. | 23, 10, 28 as a triptych |
| 7 | Audit universe | Entity tree, processes, owners, risk rating, last audit date. | 03 |
| 8 | Risks and controls | Risk register and heat map, controls repository, risk-control matrix, design and operating tests. | 04b, 05a |
| 9 | Annual planning | Multi-year plan, coverage, capacity, approval lifecycle, engagement created from a plan item. | 11b |
| 10 | Engagements and lifecycle | Engagement list and the stage machine: Planning, Fieldwork, Review, Reporting, Close, with completion gates. | 13, 14a |
| 11 | Programmes and workpapers | Programme steps, workpaper templates, versions, review notes, independent sign-off, locking. | 14b, 15 |
| 12 | Documents, evidence and requests | Evidence register, classification, document requests with reminders and portal responses. | 14e, 18b |
| 13 | Findings | Drafting, agreement with management, implementation, validation, ageing and escalation. | 17 |
| 14 | Reports and downloads | Executive, findings and engagement reports; PDF and Word exports; issued report control. | 12a |
| 15 | AI Sphere | Eight capabilities: planning scope, audit procedures, evidence review, finding draft, report summary, quality check, risk radar, audit intelligence search. Every output cites sources and is a proposal, not a change. | 19a, 19b |
| 16 | AI Sphere in practice | Sources tab traceability, Audit Intelligence Search across the permitted universe, exception register in evidence review. | 19c, 19d, 19f if captured |
| 17 | Continuous monitoring | Alerts workflow, risk radar signals, rules such as duplicate vendor payments, connectors. State plainly that rule execution against live connectors is roadmap. | 07a, 07b |
| 18 | Client portal for management | Business owners respond to requests and findings without seeing the audit file. Desktop and phone. | 24, 26b, 27a |
| 19 | Governance and assurance | Audit trail on every change, framework library, downloadable user manual, quality gates from the roadmap. | 09, 06b |
| 20 | Roadmap | Phase 1 core platform: delivered. Phase 2 risk, controls, planning, dashboards: delivered. Phase 3 AI: delivered in drafting and search; monitoring engine, Teams and Outlook notifications, knowledge graph: in progress. Phase 4 mobile PWA: planned. | none |
| 21 | Next steps | Pilot with one audit plan, data migration from the current tool, Entra ID setup, training using the built-in user manual. | none |

## 7. Honesty guardrails

- Do not claim these as live: automated rule execution against connectors, Teams or Outlook
  notifications, a GraphQL knowledge graph, an offline mobile app. Label them "Roadmap".
- If `AI_ENABLED` was false during capture, the speaker notes for slides 15 and 16 must say
  the screenshots show the local drafting mode and that a model provider can be connected.
- Do not invent metrics (users, hours saved, percentage improvements). Numbers on slides must
  be visible in a screenshot or quoted from the docs in section 8.
- Baraka Holdings and all people named in the data are fictional. Say so in the footer.
- Do not paste any real BDO client name or data into the deck.

## 8. Source documents for slide text

All paths are relative to the repository root.

- `README.md` and `CLAUDE.md`: stack summary and commands.
- `docs/01-architecture.md`: architecture wording for slide 3.
- `docs/03-user-journeys.md`: role journeys for slides 4, 6 and 18.
- `docs/04-roadmap.md`: phases and quality gates for slides 2 and 20.
- `docs/ai-sphere.md`: capability table and limits for slides 15 and 16.
- `docs/client-portal.md`: portal routes and access rules for slide 18.
- `docs/user-manual.md`: authoritative feature descriptions, sections 5 to 22.
- `docs/adr/`: decision records if a technical appendix is wanted.

## 9. Deliverables

1. `AuditSphere-overview.pptx` in the output folder named in the kick-off prompt.
2. `.local-dev/presentation/` containing every screenshot and `shot-log.md`.
3. A short closing summary: slides produced, screenshots captured, screens skipped and why,
   and whether AI Sphere ran in local or live mode.

## 10. Fallback if the app cannot be reached

Earlier verification runs left screenshots under `.local-dev/*-check/` folders (for example
`portal-check`, `home-dashboard-check`, `ai-sphere-check`, `monitoring-alert-check`,
`report-check`, `control-risks-check`, `user-manual-check`). Use them only as a last resort,
mark each one as "archive" in `shot-log.md`, and tell the user which slides depend on them so
they can be recaptured.

---

## Kick-off prompt for Cowork

Copy from here, fill in the two placeholders, and paste into Cowork with the repository
folder attached.

```
Create a PowerPoint presentation about BDO AuditSphere, the internal audit platform in the
attached folder, using real screenshots captured from the running app.

Read docs/cowork-presentation-brief.md first and follow it exactly: the demo accounts,
capture rules, shot list, slide outline and honesty guardrails are all in that file.

The app is already running at http://localhost:3000 (API at http://localhost:4000).
Use Chrome to sign in with the accounts listed in the brief and capture every screenshot in
the shot list. The session is read-only: navigate, open tabs, run searches and AI Sphere
prompts, but do not create, edit, submit, approve or upload anything.

My existing deck is at <PATH TO EXISTING DECK, or write "none">. Keep its narrative where
it fits and replace all mock-ups with real screenshots.

Save the finished deck as AuditSphere-overview.pptx in <OUTPUT FOLDER>, save screenshots
and shot-log.md under .local-dev/presentation/ in the repository, and finish with a summary
of what was captured, what was skipped and why.
```
