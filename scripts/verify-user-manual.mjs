import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import JSZip from 'jszip';

const output = join(process.cwd(), '.local-dev', 'user-manual-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const reader = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const anonymous = await browser.newContext({ baseURL });
const page = await admin.newPage();
page.setDefaultTimeout(60000);
const navigation = { waitUntil: 'domcontentloaded', timeout: 120000 };
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const endpoint = '/api/v1/help/user-manual';
const button = (scope) => scope.getByRole('button', { name: 'Download user manual (PDF)', exact: true });

async function download(scope, format = 'pdf', label) {
  if (label) await scope.getByRole('button', { name: 'User manual formats', exact: true }).click();
  const fileEvent = page.waitForEvent('download');
  if (label) await page.getByRole('menuitem', { name: label, exact: true }).click();
  else await button(scope).click();
  const file = await fileEvent;
  assert.equal(await file.failure(), null);
  assert.match(file.suggestedFilename(), new RegExp(`^BDO-AuditSphere-User-Manual-v[\\d.]+\\.${format}$`));
  const data = await readFile(await file.path());
  assert.ok(data.length > 10000, 'Downloaded manual is unexpectedly small');
  await file.saveAs(join(output, file.suggestedFilename()));
  return data;
}

async function inspectPdf(data) {
  const pdf = await getDocument({ data: new Uint8Array(data), stopAtErrors: true, standardFontDataUrl: join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/', useSystemFonts: false }).promise;
  try {
    assert.ok(pdf.numPages >= 26);
    assert.equal((await pdf.getOutline()).length, 24);
    assert.equal((await (await pdf.getPage(2)).getAnnotations()).filter((annotation) => annotation.subtype === 'Link').length, 24);
    const destination = await pdf.getDestination('chapter-24');
    assert.ok(destination);
    const lastChapter = await pdf.getPageIndex(destination[0]) + 1;
    assert.ok(lastChapter <= pdf.numPages);
    let allText = '';
    for (let number = 1; number <= pdf.numPages; number++) {
      const pdfPage = await pdf.getPage(number);
      const content = await pdfPage.getTextContent();
      const text = content.items.map((item) => item.str ?? '').join(' ');
      allText += text + ' ';
      assert.ok(text.length > 180, `Unexpected nearly blank page ${number}`);
      const viewport = pdfPage.getViewport({ scale: 1.4 });
      for (const item of content.items.filter((item) => item.str?.trim())) {
        const [,,,, x, y] = item.transform;
        assert.ok(x >= 25 && x + item.width <= pdfPage.view[2] - 20, `Text runs outside horizontal margins on page ${number}: ${item.str}`);
        assert.ok(y >= 18 && y <= pdfPage.view[3] - 12, `Text runs outside vertical margins on page ${number}: ${item.str}`);
      }
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let offset = 0; offset < pixels.length; offset += 16) if (pixels[offset] < 225 || pixels[offset + 1] < 225 || pixels[offset + 2] < 225) ink++;
      assert.ok(ink > 300, `Blank rendered page ${number}`);
      if (number <= 2 || number === pdf.numPages || text.includes('external owner details are present') || text.includes('Engagement profile: select')) {
        await writeFile(join(output, `page-${number}.png`), canvas.toBuffer('image/png'));
      }
      pdfPage.cleanup();
    }
    const searchable = allText.replace(/\s+/g, '');
    for (const term of ['Finding agreement and action owners', 'Set due date', 'AI Sphere', '12,000', 'scheduled connector/rule execution engine', 'End of manual']) assert.ok(searchable.includes(term.replace(/\s+/g, '')), `Missing manual content: ${term}`);
    assert.ok(!allText.includes('Admin123!'));
    console.log(`PASS PDF: ${pdf.numPages} pages opened/rendered, 24 bookmarks, 24 contents links, all text within page bounds`);
  } finally { await pdf.destroy(); }
}

try {
  assert.equal((await anonymous.request.get(endpoint)).status(), 401);
  for (const [context, email] of [[admin, 'admin@bdo-ea.com'], [reader, 'junior@bdo-ea.com']]) {
    const login = await context.request.post('/api/v1/auth/login', { data: { email, password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' }, timeout: 120000 });
    assert.equal(login.status(), 200);
  }
  assert.equal((await admin.request.get(`${endpoint}?format=xlsx`)).status(), 400);
  const direct = await admin.request.get(endpoint);
  assert.equal(direct.status(), 200, await direct.text());
  assert.match(direct.headers()['content-disposition'], /^attachment; filename="BDO-AuditSphere-User-Manual/);
  assert.equal(direct.headers()['content-type'], 'application/pdf');
  assert.match(direct.headers()['cache-control'], /private, no-store/);
  assert.equal(Number(direct.headers()['content-length']), (await direct.body()).length);
  const browserMode = await reader.request.get(`${endpoint}?format=pdf`, { headers: { 'X-Download-Mode': 'browser' } });
  assert.equal(browserMode.status(), 200);
  assert.equal(browserMode.headers()['content-disposition'], undefined);
  assert.match(browserMode.headers()['x-download-disposition'], /User-Manual/);
  console.log('PASS authentication, format validation, ordinary-user access and download headers');

  await page.goto('/admin/audit-trail', navigation);
  const rail = page.locator('aside');
  await button(rail).scrollIntoViewIfNeeded();
  const trail = rail.getByRole('link', { name: 'Audit trail', exact: true });
  assert.ok(await trail.evaluate((link) => link.parentElement.nextElementSibling?.dataset.testid === 'user-manual-download'), 'Manual is not immediately below Audit trail');
  const beforeUrl = page.url();
  const pdf = await download(rail);
  assert.equal(page.url(), beforeUrl, 'Manual download must not navigate away from current work');
  await rail.screenshot({ path: join(output, 'sidebar-desktop.png') });
  await inspectPdf(pdf);

  const word = await JSZip.loadAsync(await download(rail, 'docx', 'Word document'));
  const xml = await word.file('word/document.xml').async('string');
  assert.ok(xml.includes('Finding agreement and action owners'));
  assert.ok(xml.includes('End of manual'));
  assert.ok(Object.keys(word.files).filter((name) => name.startsWith('word/media/')).length >= 3);
  const markdown = (await download(rail, 'md', 'Markdown')).toString('utf8');
  assert.ok(markdown.startsWith('# BDO AuditSphere User Manual'));
  assert.ok(markdown.includes('## 24. Quick checklists and glossary'));
  console.log('PASS PDF, Word and Markdown browser downloads without leaving the page');

  await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click();
  await button(rail).scrollIntoViewIfNeeded();
  await download(rail);
  await page.getByRole('button', { name: 'Expand navigation', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const mobile = page.getByRole('dialog');
  await button(mobile).scrollIntoViewIfNeeded();
  assert.ok(await mobile.evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
  const box = await button(mobile).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 844, 'Manual download control must be reachable on mobile');
  await page.screenshot({ path: join(output, 'sidebar-mobile.png') });
  await download(mobile, 'md', 'Markdown');
  await page.keyboard.press('Escape');
  console.log('PASS collapsed desktop rail and mobile navigation/download');

  await page.setViewportSize({ width: 1440, height: 1050 });
  let failures = 0;
  let unexpectedDownloads = 0;
  const observe = () => unexpectedDownloads++;
  page.on('download', observe);
  await page.route(`**${endpoint}*`, (route) => { failures++; return route.fulfill({ status: 503, json: { message: 'Synthetic manual download failure' } }); });
  await button(rail).click();
  await page.getByText('Synthetic manual download failure', { exact: true }).waitFor();
  assert.equal(failures, 1);
  assert.equal(unexpectedDownloads, 0);
  assert.ok(await button(rail).isEnabled());
  await page.unroute(`**${endpoint}*`);
  page.off('download', observe);
  await admin.clearCookies({ name: 'as_access' });
  await download(rail);
  console.log('PASS error feedback, enabled retry and expired-session refresh');

  const readPage = await reader.newPage();
  readPage.setDefaultTimeout(60000);
  readPage.on('pageerror', (error) => { errors.push(error.message); console.error('Reader script error:', error.stack); });
  await readPage.goto('/requests', navigation);
  const readRail = readPage.locator('aside');
  await readRail.getByRole('link', { name: 'Requests', exact: true }).waitFor();
  await button(readRail).scrollIntoViewIfNeeded();
  assert.equal(await readRail.getByRole('link', { name: 'Audit trail', exact: true }).count(), 0);
  assert.equal(await readRail.getByRole('link', { name: 'Users', exact: true }).count(), 0);
  const readDownload = readPage.waitForEvent('download');
  await button(readRail).click();
  assert.equal(await (await readDownload).failure(), null);
  assert.deepEqual(errors, []);
  console.log('PASS manual access without administrator menus and no browser runtime errors');
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
  console.error('Browser errors:', errors);
  throw error;
} finally {
  for (const context of [admin, reader]) await context.request.post('/api/v1/auth/logout', { timeout: 10000 }).catch(() => {});
  await browser.close();
}
