# AI Sphere Search and Exception Register Handoff

## Implemented

- Transaction-specific ten-column exception registers, immutable baseline exception
  safeguards for model output, citations, source values and per-transaction follow-up.
- Live permission-scoped audit-universe indexing independent of the 80-source drafting
  context, audit terminology expansion and explicit relationship predicates.
- Findings, risks, controls, workpapers, evidence/documents, actions, teams and reviewer
  comments; type/engagement scopes; result pagination; coverage/confidence; traceability.
- Search uses the local `audit-intelligence-index-v1` engine; only interactions and
  audit-trail entries are written. History rechecks sources and original module coverage.
- Manual source edition 1.2 documents both enhancements. Runtime PDF/Word rendering
  tests passed. The running API serves this edition; generated release copies are in
  `.local-dev/user-manual` and the Markdown edition is `docs/user-manual.md`.

## Verification

The six focused suites passed 94 tests on 9 September, including the requested search acceptance
queries, relationship false-positive cases, date predicates, workpaper-only exceptions,
remediation evidence, permissions, index pagination/limits, exception registers and
manual rendering. API/web type checks and targeted ESLint passed during implementation.
No real business records were changed or seeded for acceptance testing. The manual PDF
test allows 90 seconds for its larger document and local filesystem overhead; all PDF
content, bookmark and branding assertions remain enabled.

## Activated 9 September 2026

The earlier approval limit cleared. The verified API was restarted in a hidden window
without restarting or reseeding the database. API PID at verification: 15956; web PID:
19576. API logs: `.local-dev/audit-intelligence-api-final.out.log` and `.err.log`.
The app is available at `http://localhost:3000/copilot`; API status reports
`intelligenceSearch: true`.

`scripts/verify-audit-intelligence.mjs` passed scope/type controls, source links,
history, Markdown downloads and desktop/mobile layout. The index scanned 305 accessible
records. Live queries returned 1 completed-audit procurement finding, 12 risks with
linked findings, 16 open actions and 4 controls with recurring weaknesses.
`scripts/verify-audit-assistant.mjs` passed all eight capabilities, the transaction
exception register, upload/privacy/download checks, history and unchanged audit records.
Screenshots/download checks remain under ignored `.local-dev` directories.

`pnpm manual:build` succeeded after approval. Manual download verification opened and
rendered all 36 PDF pages, checked 24 contents links/bookmarks and text bounds, and
downloaded PDF/Word/Markdown through desktop and mobile navigation.

## Acceptance Data Note

The user's example procurement finding F-01 is retrievable and CLOSED. Its parent
IA-2026-020 is currently ACTIVE / FIELDWORK, not COMPLETED. Therefore the completed-audit
filter correctly excludes this specific finding. Searching all procurement findings
returns it. No engagement status was changed to make a test pass. A completed-parent
fixture verifies the originally requested completed-audit example separately.

Organisation-wide objectives and mixed-scope engagement text no longer make unrelated
process-linked findings match procurement. Topic matching prioritises the recorded
process/risk/control chain; general organisation background does not establish relevance.

## Limits

This implements audit-domain semantic terminology matching, not a vector embedding
service or arbitrary natural-language reasoning. Coverage is accessible metadata, not
the percentage of hidden tenant data or document bytes. Limits and unreadable text are
reported; scans are not a transactionally frozen snapshot. See `ai-sphere.md` for exact
query, retention, coverage and status semantics.
