# Reports and documents

Reports > Executive offers PDF, Word (.docx) and Markdown downloads. Reports > Findings
and Reports > Engagements offer PDF, Excel (.xlsx) and CSV. Search applies to downloads;
exports include every matching record, independently of the page displayed. More than
10,000 matches returns an error asking for a narrower selection.

An engagement's Download report menu exports its current audit report draft, including
scope, objectives, opinion, findings, recommendations, management responses, action
owners and due dates. Downloading a draft does not issue or approve a report.

The engagement Report tab provides a preview and an upload area for a reviewed report
file. Download original retrieves that attachment without conversion. Managers may
replace or detach it while the engagement is open. The server verifies that the file
is uploaded, accessible and owned by that engagement. Attached report files must be
detached before deletion; reports on closed engagements cannot be changed.

The Documents tab holds supporting engagement documents. Existing upload areas remain
available in requests, workpaper evidence and finding remediation. Files are limited
to 50 MB each. Empty files are rejected. Classification permissions, tenant isolation,
upload completion, checksums and audit history apply to document access. Local content
downloads pass through the web proxy and can refresh expired sessions. S3 downloads
use the configured presigned URLs.

PDF, Word and Excel documents use the supplied colour BDO PNG. Navigation and sign-in
use the supplied colour/white versions. The source PNGs are preserved, with their clear
space fitted to the display. API assets live in `apps/api/assets`; browser assets in
`apps/web/public/brand`. Both are included by the existing Docker builds.

## API

All binary export routes require `report:export`, return an attachment with its correct
media type, disable response caching and record `report.exported` in the audit trail.

| Route | Query |
| --- | --- |
| `GET /api/v1/reports/executive/export` | `format=pdf|docx|md` |
| `GET /api/v1/reports/findings/export` | `format=pdf|xlsx|csv`, `q`, `severity`, `status`, `sort` |
| `GET /api/v1/reports/engagements/export` | `format=pdf|xlsx|csv`, `q`, `stage`, `status`, `leadId`, `sort` |
| `GET /api/v1/reports/engagements/:id/export` | `format=pdf|docx|md` |

Exports are generated with [PDFKit](https://pdfkit.org/docs/getting_started.html),
[docx](https://docx.js.org/) and [ExcelJS](https://github.com/exceljs/exceljs).
CSV formula prefixes are escaped, and Excel text values are stored as strings.

## Verification

`pnpm --filter @auditsphere/api exec jest --runInBand` covers file containers, embedded
branding, pagination and document validation. With the seeded database and dev servers
running, after `pnpm build`, `node scripts/verify-reports.mjs` checks downloads, permissions, uploads and
desktop/mobile screenshots using headless Chromium. Install it once with
`pnpm exec playwright install chromium --only-shell`. Set `SMOKE_BROWSER=msedge` to
use the installed Edge browser instead. Optional environment variables:
`SMOKE_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`.

The browser check creates its own synthetic engagement and attachments, removes the
attachments via the API, and archives its local fixture through the existing tenant-scoped
database service with an audit entry. Against a remote URL it cancels the test engagement
through the workflow instead. Screenshots and downloaded samples go into `.local-dev/report-check`.
