# User manual maintenance

The workspace navigation has a direct PDF download at **Admin > User manual**, immediately below **Audit trail**.
The adjacent menu offers Word and Markdown. The manual is authenticated but deliberately does
not require administrative or report-export permissions; it contains no tenant or client data.
It does not add a new permission or change existing account privileges.

- Canonical content: `apps/api/src/help/user-manual.content.ts`.
- File rendering: `apps/api/src/help/user-manual.renderer.ts` (PDFKit and docx, already installed).
- Endpoint: `GET /api/v1/help/user-manual?format=pdf|docx|md`; default PDF, invalid format 400,
  unauthenticated requests 401. Correct MIME, filename and byte length; `private, no-store`.
- The existing browser download interceptor and `api.download` helper preserve session refresh,
  PDF completeness checks and download-manager compatibility. No direct public attachment link.
- `manual.downloaded` records format, edition and filename in the tenant's audit trail.
- Static files are generated once per format per API process. Concurrent requests share that
  generation; failed generations are evicted. Each successful request is separately audited.
- Screenshots: `apps/api/assets/manual/`. They are cropped from unsaved/in-memory demonstration
  records, never a real client record. The existing supplied BDO logo is preserved.

## Updating an edition

1. Check the actual screens, permission matrix and workflow guards, not just roadmap documents.
2. Update the canonical content and its version/date. Do not hand-edit generated `docs/user-manual.md`.
3. When a screen changes, run `node scripts/capture-manual-figures.mjs` against the seeded local app.
   This capture logs in, fills an unsaved form and mocks a finding. It does not save business data.
4. Run `pnpm manual:build`. It generates `docs/user-manual.md` and PDF, Word and Markdown copies
   in `.local-dev/user-manual/`. The API generates the same formats itself, so serving the manual
   does not depend on that local output folder. The API's `assets` directory must be deployed.
5. Run the help unit tests and `node scripts/verify-user-manual.mjs`. Inspect the cover, contents,
   illustrated pages and last page. Restart the non-watching API dev process to load the edition.

The guide explicitly distinguishes engagement closure from finding closure, platform accounts
from external owners, local AI guidance from provider-backed generation, and recorded monitoring
alerts from an implemented monitoring engine. Keep these distinctions accurate in later editions.
