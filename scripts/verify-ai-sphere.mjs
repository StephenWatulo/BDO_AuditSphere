import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph } from 'docx';
import ExcelJS from 'exceljs';

const prefix = `ai-sphere-check-${Date.now()}`;
const marker = 'Invoice approvals require two independent reviewers.';
const output = join(process.cwd(), '.local-dev', 'ai-sphere-check');
await mkdir(output, { recursive: true });
const pdf = new PDFDocument();
const chunks = [];
const pdfBuffer = new Promise((resolve) => { pdf.on('data', (chunk) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); });
pdf.text(marker).end();
const workbook = new ExcelJS.Workbook();
workbook.addWorksheet('Approvals').addRow([marker]);
const fixtures = [
  { name: `${prefix}.pdf`, mimeType: 'application/pdf', buffer: await pdfBuffer },
  { name: `${prefix}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph(marker)] }] })) },
  { name: `${prefix}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) },
];
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const context = await browser.newContext({ baseURL: process.env.SMOKE_URL ?? 'http://localhost:3000', viewport: { width: 1440, height: 1100 } });
const manager = await browser.newContext({ baseURL: process.env.SMOKE_URL ?? 'http://localhost:3000' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const endpoint = '/api/v1/ai/context-documents';
const generation = { feature: 'evidence.summary', prompt: 'Summarise the invoice approval policy.' };
const upload = (fixture) => context.request.post(endpoint, { multipart: { file: fixture }, timeout: 90000 });

try {
  for (const [ctx, email] of [[context, 'admin@bdo-ea.com'], [manager, 'manager@bdo-ea.com']]) {
    const response = await ctx.request.post('/api/v1/auth/login', { data: { email, password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' }, timeout: 120000 });
    assert.equal(response.status(), 200, await response.text());
  }
  await page.goto('/copilot', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('heading', { name: 'AI Sphere', exact: true }).waitFor();
  await page.getByRole('link', { name: 'AI Sphere', exact: true }).waitFor();
  await page.getByLabel('Upload context documents').setInputFiles(fixtures);
  for (const file of fixtures) await page.getByRole('checkbox', { name: `Use ${file.name} as context`, exact: true }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Upload documents', exact: true }).waitFor({ timeout: 90000 });
  await page.locator('summary').filter({ hasText: fixtures[0].name }).click();
  assert.ok((await page.locator('details[open]').innerText()).includes(marker));
  const documents = (await (await context.request.get(endpoint)).json()).items.filter((doc) => doc.fileName.startsWith(prefix));
  assert.equal(documents.length, 3);
  for (const doc of documents) assert.ok(doc.preview.includes(marker), `${doc.fileName} has no extracted text`);
  console.log('PASS PDF, DOCX, XLSX browser uploads, selection and preview');

  await page.getByLabel('Capability', { exact: true }).click();
  await page.getByRole('option', { name: 'Evidence Review & Exception Analysis', exact: true }).click();
  const generated = page.waitForResponse((response) => response.url().endsWith('/ai/copilot') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Generate review', exact: true }).click();
  const response = await generated;
  assert.equal(response.status(), 201, await response.text());
  const result = await response.json();
  assert.equal(result.sources.length, 3);
  assert.deepEqual([...response.request().postDataJSON().documentIds].sort(), documents.map((doc) => doc.id).sort());
  await page.getByRole('tab', { name: /^Sources/ }).waitFor();
  if (result.provider !== 'openai-compatible') {
    assert.ok(JSON.stringify(result.sections).includes(marker));
    assert.ok(result.caveats.some((caveat) => caveat.includes('not model-based document analysis')));
  }
  await page.getByRole('checkbox', { name: `Use ${fixtures[2].name} as context`, exact: true }).uncheck();
  const regenerated = page.waitForResponse((res) => res.url().endsWith('/ai/copilot') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Generate review', exact: true }).click();
  assert.equal((await (await regenerated).json()).sources.length, 2);
  console.log('PASS generation includes only selected document sources');

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download ${fixtures[0].name}`, exact: true }).click();
  const download = await downloading;
  const destination = join(output, 'context-original.pdf');
  await download.saveAs(destination);
  assert.deepEqual(await readFile(destination), fixtures[0].buffer);
  console.log('PASS original PDF download is byte-for-byte intact in Chrome');

  for (const extension of ['txt', 'csv', 'md']) {
    const res = await upload({ name: `${prefix}.${extension}`, mimeType: 'text/plain', buffer: Buffer.from(marker) });
    assert.equal(res.status(), 201, await res.text());
    assert.equal((await res.json()).preview, marker);
  }
  const excerpt = await upload({ name: `${prefix}-long.txt`, mimeType: 'text/plain', buffer: Buffer.from(marker.repeat(300)) });
  assert.equal(excerpt.status(), 201, await excerpt.text());
  const excerptDoc = await excerpt.json();
  assert.equal(excerptDoc.characters, 12000);
  assert.equal(excerptDoc.truncated, true);
  for (const [name, buffer, status] of [['broken.pdf', Buffer.from(marker), 400], ['empty.txt', Buffer.alloc(0), 400], ['unsafe.exe', Buffer.from(marker), 400], ['large.txt', Buffer.alloc(10 * 1024 * 1024 + 1, 65), 413]]) {
    const res = await upload({ name: `${prefix}-${name}`, mimeType: 'application/octet-stream', buffer });
    assert.equal(res.status(), status, `${name}: ${await res.text()}`);
  }
  for (const documentIds of [[documents[0].id, documents[0].id], Array.from({ length: 6 }, () => randomUUID()), ['invalid-id']]) {
    assert.equal((await context.request.post('/api/v1/ai/copilot', { data: { ...generation, documentIds } })).status(), 400);
  }
  console.log('PASS text formats, excerpts, file validation and context limits');

  const otherList = await manager.request.get(endpoint);
  assert.equal(otherList.status(), 200, await otherList.text());
  assert.ok(!(await otherList.json()).items.some((doc) => doc.fileName.startsWith(prefix)));
  const genericList = await manager.request.get('/api/v1/documents', { params: { q: prefix, pageSize: 200 } });
  assert.equal(genericList.status(), 200, await genericList.text());
  assert.ok(!(await genericList.json()).items.some((doc) => doc.fileName.startsWith(prefix)));
  for (const path of [`/documents/${documents[0].id}`, `/documents/${documents[0].id}/download`, `/documents/${documents[0].id}/content`]) {
    assert.equal((await manager.request.get(`/api/v1${path}`)).status(), 403);
  }
  assert.equal((await manager.request.post('/api/v1/ai/copilot', { data: { ...generation, documentIds: [documents[0].id] } })).status(), 403);
  console.log('PASS other users cannot list, preview, download or use private context');

  await page.screenshot({ path: join(output, 'ai-sphere-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(output, 'ai-sphere-mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'AI Sphere overflows on mobile');
  await page.getByRole('button', { name: `Delete ${fixtures[0].name}`, exact: true }).click();
  await page.getByRole('checkbox', { name: `Use ${fixtures[0].name} as context`, exact: true }).waitFor({ state: 'detached' });
  const deletedDoc = documents.find((doc) => doc.fileName === fixtures[0].name);
  assert.equal((await context.request.post('/api/v1/ai/copilot', { data: { ...generation, documentIds: [deletedDoc.id] } })).status(), 404);
  await page.reload();
  await page.getByRole('checkbox', { name: `Use ${fixtures[1].name} as context`, exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: `Use ${fixtures[1].name} as context`, exact: true }).isChecked(), false);
  assert.deepEqual(errors, []);
  console.log('PASS desktop/mobile layouts, persisted documents and deletion');
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
  console.error('Browser errors:', errors);
  throw error;
} finally {
  const response = await context.request.get(endpoint).catch(() => null);
  if (response?.ok()) for (const doc of (await response.json()).items.filter((item) => item.fileName.startsWith(prefix))) {
    const deleted = await context.request.delete(`/api/v1/documents/${doc.id}`);
    assert.ok(deleted.ok(), `Could not clean up synthetic document ${doc.id}`);
  }
  await context.request.post('/api/v1/auth/logout').catch(() => {});
  await manager.request.post('/api/v1/auth/logout').catch(() => {});
  await browser.close();
}
