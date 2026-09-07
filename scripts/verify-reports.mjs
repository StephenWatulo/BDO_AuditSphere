import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import ExcelJS from 'exceljs';
import { archiveTestEngagement } from './report-check-cleanup.cjs';

const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const output = join(process.cwd(), '.local-dev', 'report-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.SMOKE_BROWSER ? { channel: process.env.SMOKE_BROWSER } : {}), headless: true });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const docs = new Set();
let testEngagement;
let actor;
const check = async (response) => { if (!response.ok()) throw new Error(`${response.url()}: ${response.status()} ${await response.text()}`); return response; };
try {
  await page.goto('/sign-in');
  await page.locator('input[name=email]').fill(process.env.SMOKE_EMAIL ?? 'admin@bdo-ea.com');
  await page.locator('input[name=password]').fill(process.env.SMOKE_PASSWORD ?? 'Admin123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 60000 });
  actor = (await (await check(await context.request.get('/api/v1/auth/me'))).json()).user;
  const register = await (await check(await context.request.get('/api/v1/engagements?pageSize=200'))).json();
  const engagement = register.items.find((e) => e.auditNumber === 'IA-2026-001') ?? register.items[0];
  assert.ok(engagement);
  let samplePdf;
  for (const [path, formats] of [['executive', ['pdf', 'docx', 'md']], ['findings', ['pdf', 'xlsx', 'csv']], ['engagements', ['pdf', 'xlsx', 'csv']], [`engagements/${engagement.id}`, ['pdf', 'docx']]]) {
    for (const format of formats) {
      const response = await check(await context.request.get(`/api/v1/reports/${path}/export?format=${format}`));
      assert.match(response.headers()['content-disposition'], /attachment;/);
      assert.match(response.headers()['cache-control'], /no-store/);
      const buffer = await response.body();
      const name = `${path.replaceAll('/', '-')}.${format}`;
      await writeFile(join(output, name), buffer);
      if (format === 'pdf') {
        const pdf = await getDocument({ data: new Uint8Array(buffer), standardFontDataUrl: join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/', useSystemFonts: false }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) text += (await (await pdf.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ');
        assert.ok(text.includes('AuditSphere'));
        if (path.includes(engagement.id)) assert.ok(text.includes(engagement.auditNumber));
        if (path === 'executive') {
          samplePdf = buffer;
          const first = await pdf.getPage(1);
          const viewport = first.getViewport({ scale: 1.5 });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await first.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          await writeFile(join(output, 'executive-pdf.png'), canvas.toBuffer('image/png'));
        }
        console.log(`PASS ${path} PDF: ${pdf.numPages} pages`);
        await pdf.destroy();
      } else if (format === 'xlsx') {
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(buffer);
        const source = await (await check(await context.request.get(`/api/v1/reports/${path}`))).json();
        assert.equal(book.getWorksheet('Data').rowCount, source.total + 1);
      } else if (format === 'docx') assert.equal(buffer.subarray(0, 2).toString(), 'PK');
    }
  }
  assert.equal((await context.request.get('/api/v1/reports/executive/export?format=invalid')).status(), 400);
  const guest = await browser.newContext({ baseURL });
  assert.equal((await guest.request.get('/api/v1/reports/executive/export')).status(), 401);
  await check(await guest.request.post('/api/v1/auth/login', { data: { email: 'owner@client.example', password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' } }));
  assert.equal((await guest.request.get('/api/v1/reports/executive/export')).status(), 403);
  await guest.request.post('/api/v1/auth/logout');
  await guest.close();

  await page.goto('/reports');
  await page.getByRole('button', { name: 'Download report' }).waitFor();
  await page.getByRole('button', { name: 'Download report' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'PDF document' }).click();
  const browserDownload = await downloaded;
  assert.match(browserDownload.suggestedFilename(), /\.pdf$/);
  const browserPdf = await readFile(await browserDownload.path());
  assert.equal(browserPdf.subarray(0, 5).toString(), '%PDF-');
  const parsedDownload = await getDocument({ data: new Uint8Array(browserPdf), stopAtErrors: true }).promise;
  assert.ok(parsedDownload.numPages > 0);
  await parsedDownload.destroy();
  await page.screenshot({ path: join(output, 'reports-desktop.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Engagements', exact: true }).click();
  await page.getByPlaceholder('Search').fill(engagement.auditNumber).catch(async () => page.locator('input[type=text]').last().fill(engagement.auditNumber));
  await page.waitForTimeout(750);
  await page.getByRole('button', { name: 'Download report' }).click();
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'CSV spreadsheet' }).click();
  const csvFile = await csvDownload;
  const csv = await readFile(await csvFile.path(), 'utf8');
  assert.ok(csv.includes(engagement.auditNumber));
  assert.ok(!csv.includes('IA-2025-014'));

  testEngagement = await (await check(await context.request.post('/api/v1/engagements', { data: { title: `Document verification ${Date.now()}`, type: engagement.type, objectives: 'Verify report downloads', scope: 'Synthetic test documents only' } }))).json();
  await page.goto(`/engagements/${testEngagement.id}?tab=documents`);
  await page.locator('input[type=file]').setInputFiles({ name: 'Audit evidence.pdf', mimeType: 'application/pdf', buffer: samplePdf });
  await page.getByRole('button', { name: 'Download Audit evidence.pdf' }).waitFor();
  const docList = await (await check(await context.request.get(`/api/v1/documents?ownerType=Engagement&ownerId=${testEngagement.id}`))).json();
  docList.items.forEach((d) => docs.add(d.id));
  const attachmentDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Audit evidence.pdf' }).click();
  assert.deepEqual(await readFile(await (await attachmentDownload).path()), samplePdf);
  const large = Buffer.alloc(12 * 1024 * 1024, 'x');
  const largeDoc = await (await check(await context.request.post('/api/v1/documents/upload', { multipart: { ownerType: 'Engagement', ownerId: testEngagement.id, file: { name: 'Synthetic extract.txt', mimeType: 'text/plain', buffer: large } } }))).json();
  docs.add(largeDoc.id);
  assert.equal((await context.request.patch(`/api/v1/engagements/${engagement.id}`, { data: { reportDocumentId: largeDoc.id } })).status(), 400);
  assert.equal(largeDoc.sizeBytes, large.length);
  assert.deepEqual(await (await check(await context.request.get(`/api/v1/documents/${largeDoc.id}/content`))).body(), large);
  await page.reload();
  await page.getByRole('button', { name: 'Download Synthetic extract.txt' }).waitFor();
  await page.screenshot({ path: join(output, 'documents-desktop.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Report', exact: true }).click();
  await page.getByText('No report file attached.', { exact: true }).waitFor();
  await page.locator('input[type=file]').setInputFiles({ name: 'Reviewed report.pdf', mimeType: 'application/pdf', buffer: samplePdf });
  await page.getByRole('button', { name: 'Download original' }).waitFor();
  const updated = await (await check(await context.request.get(`/api/v1/engagements/${testEngagement.id}`))).json();
  assert.ok(updated.reportDocumentId);
  docs.add(updated.reportDocumentId);
  assert.equal((await context.request.delete(`/api/v1/documents/${updated.reportDocumentId}`)).status(), 409);
  await page.screenshot({ path: join(output, 'report-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !document.querySelector('[data-sonner-toast]'), null, { timeout: 15000 });
  await page.screenshot({ path: join(output, 'report-mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page overflows');
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page.screenshot({ path: join(output, 'documents-mobile.png'), fullPage: true });
  assert.ok(await page.locator('img[alt=BDO]').evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0)), 'A BDO logo did not load');
  assert.deepEqual(errors, []);
  console.log('PASS browser downloads, filtered CSV, document byte round-trip, 12 MB upload, report attachment, desktop/mobile layouts and permissions');
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png'), fullPage: true });
  throw error;
} finally {
  if (testEngagement) {
    await check(await context.request.patch(`/api/v1/engagements/${testEngagement.id}`, { data: { reportDocumentId: null } }));
    const remaining = await context.request.get(`/api/v1/documents?ownerType=Engagement&ownerId=${testEngagement.id}&pageSize=200`);
    if (remaining.ok()) (await remaining.json()).items.forEach((d) => docs.add(d.id));
    for (const id of docs) await check(await context.request.delete(`/api/v1/documents/${id}`));
    if (['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) {
      await archiveTestEngagement(testEngagement, actor);
      assert.equal((await context.request.get(`/api/v1/engagements/${testEngagement.id}`)).status(), 404);
    }
    else await check(await context.request.post(`/api/v1/engagements/${testEngagement.id}/transition`, { data: { action: 'cancel', comment: 'Automated report verification completed' } }));
  }
  await context.request.post('/api/v1/auth/logout');
  await context.close();
  await browser.close();
}
