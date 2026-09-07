# AI Sphere document context

AI Sphere replaces the visible AI Copilot name. Existing `/copilot` links and
`POST /api/v1/ai/copilot` integrations remain compatible.

## Context documents

Upload PDF, DOCX, XLSX, TXT, CSV or Markdown files from AI Sphere. Files must be
nonempty and at most 10 MB. Select up to five documents for a generation request.
The document list retains the 50 most recent readable uploads belonging to the
current user; selections are not restored when the page reloads.

Text is extracted on the server before storing the file. PDF extraction reads up
to 50 pages. Each document contributes at most 12,000 characters. Truncated sources
are marked as excerpts. Image-only scans require OCR outside the application;
password-protected PDFs must first be unlocked. Spreadsheet formulas are not run.

Parsing runs in a separate process with a 256 MB V8 heap limit, a 60-second timeout
and a maximum of two concurrent processes per API instance. This is failure
isolation, not an antivirus or operating-system sandbox. Production deployments
should apply container-level memory limits and the organisation's upload scanning
policy. Original files use the existing local or S3 storage configuration.

## Access and generation

Uploads require `ai:use`, `document:upload` and `document:read`. Listing and using
context require `ai:use` and `document:read`. Files are confidential by default;
restricted classification additionally requires `document:restricted`.
Context documents are tenant-scoped and private to their uploader, including
through the general document metadata and download endpoints. Deletion uses the
existing audited soft-delete flow and requires `document:delete`.

The client sends document IDs, not trusted extracted text. The server rechecks
ownership, classification, upload completion, quarantine and deletion status
before reading each source. Supplied documents are labelled as untrusted source
material in the provider instruction. Generated responses include source names,
character counts and truncation flags. Source text and responses remain in the
audited AI interaction record according to the existing retention and AI
administrator access policy; deleting an upload does not erase past interactions.

With an AI provider configured, the selected extracted text is included in the
generation request. The local rulepack returns audit guidance and source excerpts,
not model-based document analysis. Configuring a remote provider means selected
source text is sent to that provider; use an approved endpoint for confidential
audit material.

## API and verification

- `POST /api/v1/ai/context-documents`: multipart `file`, optional `classification`.
- `GET /api/v1/ai/context-documents`: current user's recent context summaries.
- `POST /api/v1/ai/copilot`: existing request plus optional `documentIds` array.
- Existing `/api/v1/documents/:id` routes provide download and deletion.

`pnpm --filter @auditsphere/api exec jest --runInBand` covers real format parsing,
invalid files, access checks and provider payloads. Tests need permission to spawn
child processes. `node scripts/verify-ai-sphere.mjs` exercises uploads, context
selection, generation, PDF downloads, access isolation and desktop/mobile layouts
against the seeded local application using installed Chrome. Its synthetic uploads
are soft-deleted afterward; audit and interaction records remain. Artifacts are
written under `.local-dev/ai-sphere-check`.
