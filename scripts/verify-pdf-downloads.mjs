import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import JSZip from 'jszip';

const output = join(process.cwd(), '.local-dev', 'pdf-download-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER ? { channel: process.env.SMOKE_BROWSER } : {}) });
const context = await browser.newContext({ baseURL: process.env.SMOKE_URL ?? 'http://localhost:3000', acceptDownloads: true });

async function downloadFile(page, label) {
  await page.getByRole('button', { name: 'Download report' }).first().click({ timeout: 60000 });
  const pending = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  const download = await pending;
  assert.equal(await download.failure(), null);
  return download;
}

async function downloadPdf(page, name, expectedText = 'AuditSphere') {
  const download = await downloadFile(page, 'PDF document');
  const buffer = await readFile(await download.path());
  await download.saveAs(join(output, `${name}.pdf`));
  assert.match(download.suggestedFilename(), /^bdo-.+\.pdf$/);
  assert.notEqual(download.suggestedFilename(), 'bdo-report.pdf', 'Server filename was lost');
  assert.ok(buffer.length > 0, 'Browser saved an empty PDF');
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/',
    useSystemFonts: false,
    stopAtErrors: true,
  }).promise;
  try {
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const pdfPage = await pdf.getPage(i);
      text += (await pdfPage.getTextContent()).items.map((item) => item.str).join(' ');
      const viewport = pdfPage.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (i === 1) await writeFile(join(output, `${name}.png`), canvas.toBuffer('image/png'));
    }
    assert.ok(text.includes(expectedText));
    console.log(`PASS ${name}: ${buffer.length} bytes, ${pdf.numPages} pages opened and rendered`);
  } finally { await pdf.destroy(); }
}

try {
  const login = await context.request.post('/api/v1/auth/login', {
    data: { email: process.env.SMOKE_EMAIL ?? 'admin@bdo-ea.com', password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' },
    timeout: 120000,
  });
  assert.equal(login.status(), 200);
  const direct = await context.request.get('/api/v1/reports/executive/export?format=pdf');
  assert.equal(direct.status(), 200);
  assert.match(direct.headers()['content-disposition'], /^attachment;/);
  assert.equal((await direct.body()).subarray(0, 5).toString(), '%PDF-');
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  if (process.env.SMOKE_DEBUG) {
    page.on('console', (message) => console.log('Browser:', message.type(), message.text()));
    page.on('response', async (response) => {
      if (response.url().includes('/export')) console.log('Export:', response.status(), await response.allHeaders());
    });
    page.on('requestfailed', (request) => console.log('Request failed:', request.url(), request.failure()));
  }
  await page.goto('/reports', { timeout: 120000 });
  await downloadPdf(page, 'executive');
  const word = await downloadFile(page, 'Word document');
  const wordZip = await JSZip.loadAsync(await readFile(await word.path()));
  assert.ok((await wordZip.file('word/document.xml').async('string')).includes('AuditSphere'));
  const markdown = await downloadFile(page, 'Markdown');
  assert.ok((await readFile(await markdown.path(), 'utf8')).includes('AuditSphere'));
  console.log('PASS Word and Markdown browser downloads');
  for (const tab of ['Findings', 'Engagements']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await downloadPdf(page, tab.toLowerCase());
  }
  const excel = await downloadFile(page, 'Excel workbook');
  const excelZip = await JSZip.loadAsync(await readFile(await excel.path()));
  assert.ok(excelZip.file('xl/workbook.xml'));
  const csv = await downloadFile(page, 'CSV spreadsheet');
  assert.ok((await readFile(await csv.path(), 'utf8')).includes('IA-2026-006'));
  console.log('PASS Excel and CSV browser downloads');
  const register = await context.request.get('/api/v1/engagements?pageSize=200');
  assert.equal(register.status(), 200);
  const engagement = (await register.json()).items.find((item) => item.auditNumber === 'IA-2026-006');
  assert.ok(engagement);
  await page.goto(`/engagements/${engagement.id}?tab=report`);
  await downloadPdf(page, 'engagement', engagement.auditNumber);
  await page.goto('/reports');

  const exportUrl = '**/api/v1/reports/executive/export*';
  let attempts = 0;
  await page.route(exportUrl, (route) => ++attempts === 1
    ? route.fulfill({ status: 204, body: '' })
    : route.continue());
  await downloadPdf(page, 'empty-response-recovered');
  assert.equal(attempts, 2, 'An empty response should be retried once');
  await page.unroute(exportUrl);

  for (const [label, body, contentType, status = 200] of [
    ['empty', '', 'application/pdf'],
    ['no-content', '', 'application/pdf', 204],
    ['HTML', '<html>Sign in</html>', 'text/html'],
    ['JSON', '{"message":"Unable to generate report"}', 'application/json'],
    ['truncated', '%PDF-1.3\nTruncated report', 'application/pdf'],
  ]) {
    await page.reload();
    attempts = 0;
    let downloads = 0;
    const onDownload = () => downloads++;
    page.on('download', onDownload);
    await page.route(exportUrl, (route) => {
      attempts++;
      return route.fulfill({ status, body, contentType });
    });
    await page.getByRole('button', { name: 'Download report' }).click();
    await page.getByRole('menuitem', { name: 'PDF document' }).click();
    await page.getByText('The server returned an empty or incomplete file. Please try downloading again.', { exact: true }).waitFor();
    assert.equal(attempts, 2);
    assert.equal(downloads, 0, `${label} response must not be saved as a PDF`);
    await page.unroute(exportUrl);
    page.off('download', onDownload);
    console.log(`PASS ${label} response: rejected without a broken download`);
  }
  await page.reload();
  // Exercise the same download after the access cookie expires, preserving refresh.
  await context.clearCookies({ name: 'as_access' });
  await downloadPdf(page, 'refreshed-session');
  assert.deepEqual(errors, []);
} catch (error) {
  const page = context.pages()[0];
  if (page) {
    await page.screenshot({ path: join(output, 'failure.png'), fullPage: true });
    console.log('Visible alerts:', await page.locator('[data-sonner-toast]').allTextContents());
    if (process.env.SMOKE_DEBUG) console.log('Browser fetch:', await page.evaluate(async () => {
      const response = await fetch('/api/v1/reports/executive/export?format=pdf', { cache: 'no-store', credentials: 'include' });
      const bytes = await response.arrayBuffer();
      return { status: response.status, type: response.type, headers: Object.fromEntries(response.headers), size: bytes.byteLength, head: new TextDecoder().decode(bytes.slice(0, 20)) };
    }));
  }
  throw error;
} finally {
  await context.request.post('/api/v1/auth/logout', { timeout: 10000 }).catch((error) => console.error('Test logout failed:', error.message));
  await browser.close();
}
