# AI Sphere: Internal Audit AI Assistant

Version 2.1 provides read-only audit assistance across eight capabilities. The existing
`/copilot` page, `POST /api/v1/ai/copilot` endpoint and feature identifiers remain
compatible. The evidence capability is labelled **Evidence Review & Exception Analysis**.

## Using the assistant

Select a capability, enter an instruction and optionally select an audit context type
and record using the searchable picker. Entity, process, risk, control, procedure,
engagement, workpaper, evidence and finding targets are supported. Related records
are retrieved automatically, not inferred from a pasted UUID or from the model.

Upload approved context documents and select the ones to use. Finding drafts accept
optional impact and likelihood factors (both required together, integers 1-5) and a
rationale. Procedure requests accept an optional population size. These are proposals,
not changes to the audit file.

The Review tab distinguishes source-reported facts, assessments, assumptions,
recommendations and missing information. Potential exceptions are separate from
exceptions already recorded by auditors. Each source reference opens the Sources
tab, where the user can inspect the excerpt, open the record or download the original
document. Context links shows retrieved relationships. Copy and Markdown download
retain the review notice and citations. History can reopen earlier permitted output.

## Capability outputs

| Capability | Outputs |
| --- | --- |
| Planning scope | Objective; in/out boundaries, period and units; process-linked risks; walkthrough/control/substantive/analytics approach; information requests. |
| Audit procedures | Risk-control-test objective linkage; steps; expected evidence; sampling considerations. The local draft covers up to six controls at once. |
| Evidence review | Completeness checks; recorded and potential exceptions with references; sufficiency assessment; follow-up procedures. |
| Finding draft | Title, Condition, Criteria, Cause, Consequence/Impact, Recommendation; owner/timeframe proposal; explained impact x likelihood rating proposal. |
| Report summary | Objective and scope; recorded opinion or no opinion; key findings; complete engagement finding counts; subset management themes and commitments. |
| Quality check | Objective/procedure gaps; missing work performed, evidence or conclusion; unsupported effectiveness; no-exception contradictions; weak finding support, criteria, cause, impact and actions; self-review flags. |
| Risk radar | Recorded signals, weak controls, absent control links, repeated findings, prior/current audits, process-change information gaps and high-risk audit focus. |
| Audit Intelligence Search | Permission-scoped universe indexing, audit terminology expansion, relationship predicates, action tracking, source traceability and measured coverage. |

Causes are hypotheses until corroborated. A proposed finding rating uses supplied
factors, or an unambiguous linked risk's factors with an explicit applicability
assumption. Configured scoring thresholds are used when available; otherwise the
application defaults are disclosed. No factor, sample count, policy clause, actual
loss, action owner or audit opinion is invented as an established fact.

## Evidence checks and limitations

Evidence Review includes an **Exception Register** with Exception ID, Transaction
Reference, Supplier/Vendor, Amount, Control Requirement, Evidence Observed, Exception
Identified, Risk Impact, Severity and Auditor Follow-up. It is displayed before general
reviewer notes, supports horizontal scrolling, and is retained in Markdown exports and
permission-checked history. Each row links back to its source document and available
control/risk context. IDs are unique within the review and agree with the exception list.

For example, if a supplied row identifies Supplier F, PO-006 and KES 650,000 but leaves
the approver unidentified, the register explicitly states that approval authority could
not be confirmed for that supplier, amount and transaction because the supplied approval
evidence did not identify the approver. Follow-up requests attributable approval records
and verification against the delegation matrix for the amount and transaction date.

Amounts retain recorded currency and precision; the tenant currency is never assumed.
Absent references, suppliers and amounts are marked Not supplied. Unassessed severity
is UNRATED, not guessed from transaction value; any severity provided in a source is
labelled source-reported and requires confirmation. A control requirement is either
source-stated, linked to a specifically identifiable control, or explicitly a review
criterion whose applicability must be confirmed. Multiple exceptions can refer to the
same transaction, so their amounts must not be summed as exposure or proven loss.
Registers are bounded to 100 exceptions, with any limit disclosed.

The deterministic local engine parses CSV and tab-separated XLSX text using ExcelJS,
including quoted CSV fields, worksheet locations, Markdown pipe tables and page markers
when present in extracted text. It recognises common transaction/PO/invoice reference,
supplier/vendor, amount, currency, approver, approval-date and commitment/PO-date headers,
plus source-stated control requirements, evidence observations and severity. Up to 200
rows per supplied excerpt are checked. Dates must be unambiguous ISO dates such as
`2026-08-10` or UTC ISO timestamps. Ambiguous/impossible dates remain unresolved.

It flags missing references, approvers and dates, and approval after commitment.
An empty approval field is a potential evidence gap, not proof that approval never
occurred. Clean rows do not authenticate a signature, verify approver authority or
establish population completeness. Local mode does not understand arbitrary narrative
exceptions, scanned images or complex causation. Ordinary linked documents contribute
available extracted text; documents without extracted text contribute metadata only.
Upload a readable copy as private context when needed. Spreadsheet formulas are not run.

Evidence is insufficient or partially sufficient until support is established.
`SUFFICIENT` in local mode reports an existing independent human review, only when
the retrieved file includes reviewed/signed-off workpapers, distinct preparer/reviewer,
documented test work/results, period/sample records, sufficient linked evidence with
provenance and readable untruncated documents, without unresolved parsed-row gaps or
context-limit warnings. It is limited to the recorded test scope and is not a new AI
assurance opinion. Sufficient evidence can support an adverse conclusion; it does not
mean a control is effective.

## Search and context boundaries

All reads use the tenant-scoped Prisma client and the relevant module read permission.
Private AI context belongs to its uploader; restricted, quarantined, incomplete or
deleted documents cannot be read through context traversal or search. Comments require
a readable parent record and applicable internal-comment visibility. Relationship
queries enforce tenant/deletion checks on joined records.

Non-search review context is bounded to 80 sources and 140,000 serialized characters, with 12,000-character
field limits and per-query row limits. Limits and missing permissions are disclosed.
Source registers use short previews; the retained context snapshot holds the bounded
fields used in the review. Report finding totals use a separate full aggregate query,
not the count of retrieved detail records.

Audit Intelligence Search uses a separate live read-through index, rebuilt for each
request through tenant-scoped, permission-filtered, ID-ordered pages of 250 records.
It indexes entities/business-unit hierarchy, processes, engagements and teams, risks,
controls and risk-control links, procedures, workpapers, control tests, evidence and
readable document text, findings, recommendations/action plans, review notes and comments.
Owner display names come from a tenant-scoped directory projection, never credentials.

Default scope is All audit universe. Current engagement requires a selected engagement;
record-type checkboxes constrain the requested answer types. A query requesting findings
does not return risks merely because the words "high-risk" appear before "findings".
Procurement/purchasing/accounts-payable/vendor concepts and approval/authorisation/
delegation weaknesses use explicit audit-domain synonym expansion. Other terms must
match the record or its confirmed relationships. This is semantic terminology retrieval,
not an embedding model or unrestricted understanding of arbitrary questions.

Risk-to-finding and recurring-control questions traverse explicit control, procedure,
workpaper and finding paths; a shared entity alone does not establish a finding link.
Repeated linked findings or an explicit repeat flag produce review candidates, not a
confirmed common cause. Open actions include implemented recommendations awaiting
validation, excluding validated/superseded actions. Finding-level management actions
are returned when no separate recommendation exists, with their origin labelled.
Closed/risk-accepted findings are not unresolved. Due dates before today are overdue.
Closed-finding and low/medium/high/critical severity queries use explicit stored values.
Queries for no linked findings and recorded testing without exceptions are supported;
other unsupported negation is rejected with a validation message, not silently inverted.

Last year means a rolling 12 months; control failures and their tested dates must occur
on the same control-test record. Workpapers with recorded exceptions are also searchable
when no separate control test exists, using their prepared date (or updated date as a
disclosed fallback). Original documents are returned alongside linked evidence entries;
these are distinct source records, not unique transactions. This month uses the current UTC calendar month.
Calendar-year searches are also supported. Date interpretation is included in output.
Completed-audit queries use the recorded COMPLETED engagement status.

Coverage reports records actually scanned. 100% means accessible metadata exhausted,
not all hidden tenant records or all document bytes. Per-kind/total/character limits
(5,000 / 20,000 / 25 million) or read failures produce incomplete coverage with an
unknown percentage. Missing/truncated text and permission exclusions are disclosed.
A total database retrieval failure returns HTTP 503, not a fabricated no-match result.
No-match responses distinguish absent indexed data, filters, permissions and incomplete
indexing. Record reads are not a transactionally frozen snapshot.

Results are paginated at 25 with total match and engagement counts, owner/status/due
dates, source links and traceability. Up to 400 source snapshots and 60 trace links per
result are displayed; these display limits do not change the indexed match count.
Each page is a new audited read, so concurrent data changes can affect pagination.
Search runs locally even when a model provider is configured. No generated SQL, model
rewriting of counts or domain mutations are permitted. History rechecks source access
and the module permissions used for the original coverage before exposing snapshots.

## Uploads and privacy

Supported formats: PDF, DOCX, XLSX, TXT, CSV and Markdown. Files must be nonempty and
at most 10 MB. Select up to five per request; the list shows 50 recent readable private
uploads. Selection is not restored on reload. PDF extraction reads up to 50 pages and
each document contributes up to 12,000 characters. Truncated sources are marked.
Image-only scans require external OCR; protected PDFs must first be unlocked.

Parsing uses a separate process with a 256 MB V8 heap, a 60-second timeout and at most
two concurrent processes per API instance. This is failure isolation, not antivirus
or an OS sandbox. Apply approved scanning and container limits in production.

Uploads require `ai:use`, `document:upload` and `document:read`; restricted uploads
also require `document:restricted`. Ownership, classification, upload completion,
quarantine and deletion are checked on use. General document download endpoints enforce
the same private-context ownership. Deletion is audited and requires `document:delete`.

## Governance and provider mode

Every response and export includes:

> AI-generated output. Auditor review required before inclusion in audit documentation.

Generation writes an `AiInteraction` containing prompt, requester, date, selected
documents, bounded source snapshot, generated output, model/provider, version, estimated
tokens and latency. An audit-trail entry records the generation and source IDs.
History lists requester-only metadata; opening output revalidates access to every
source, including legacy uploaded-document snapshots. Deleted/restricted sources may
prevent reopening a retained interaction. Source deletion does not erase audit snapshots;
apply the organisation's retention policy. Feedback records usefulness, not sign-off.

The assistant has no tool to approve workpapers, close findings, issue reports or
update risk ratings. Reviewer suggestions are not automatically posted as formal notes.
No output is automatically included in audit documentation.

With `AI_ENABLED=false` or no key, the provider is `local-rulepack`. An approved existing
compatible endpoint can be configured through `AI_ENABLED`, `AI_BASE_URL`, `AI_API_KEY`
and `AI_MODEL` on the server. **Enabling a remote provider sends the permitted retrieved
audit context and selected extracted text to that provider.** Obtain organisational
approval and appropriate information-handling arrangements before enabling it.

Provider instructions treat document text as untrusted source material. Responses are
schema-checked, citations must reference supplied sources, and required sections are
retained. Unsupported effectiveness wording is rejected; deterministic exceptions,
reviewer flags, complete dashboard counts, sufficiency and rating calculations cannot
be downgraded by the model. This validates structure and references, not semantic truth;
auditor review remains essential. A 45-second timeout, malformed response, unsupported
claim or oversized response triggers a clearly labelled `local-fallback` with the actual
local model recorded. Credentials and provider diagnostics are not exposed to users.

## API and verification

- `GET /api/v1/ai/status`: provider mode, version and model.
- `GET /api/v1/ai/targets?type=Control&q=approval`: readable record options.
- `POST /api/v1/ai/context-documents`: multipart `file`, optional `classification`.
- `GET /api/v1/ai/context-documents`: recent private context summaries.
- `POST /api/v1/ai/copilot`: generation/search request.
- `GET /api/v1/ai/interactions`: requester-only metadata with feature/pagination filters.
- `GET /api/v1/ai/interactions/:id`: access-rechecked historical output and prompt.
- `PATCH /api/v1/ai/interactions/:id`: requester usefulness feedback.

Run `pnpm --filter @auditsphere/api exec jest --runInBand` for the regression suite
(document tests require child-process permission). `node scripts/verify-audit-assistant.mjs`
tests the local browser/API across all eight capabilities, nine target pickers, synthetic
CSV exceptions, citations, downloads, history, privacy and desktop/mobile layouts. It
checks that audit statuses/ratings remain unchanged. Synthetic uploads are soft-deleted;
their audit interactions remain. Artifacts are under `.local-dev/audit-assistant-check`.
`node scripts/verify-ai-sphere.mjs` additionally exercises all upload formats and limits.
The downloadable user manual includes the version-2 workflow and review limitations.
