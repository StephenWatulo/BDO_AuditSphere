import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const output = join(process.cwd(), '.local-dev', 'audit-assistant-check');
await mkdir(output, { recursive: true });
const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const prefix = `assistant-check-${Date.now()}`;
const notice = 'AI-generated output. Auditor review required before inclusion in audit documentation.';
const csv = Buffer.from('PO Number,Supplier,Amount (KES),Approver,Approval Date,Commitment Date\nSYN-001,"Synthetic Supplier, Ltd",100000,,2026-08-20,2026-08-10\nSYN-002,Synthetic Vendor,250000,Jane,,2026-08-10\nSYN-003,Synthetic Vendor,300000,John,2026-08-09,2026-08-10\nSYN-006,Supplier F,650000,,2026-08-09,2026-08-10');
const registerColumns = ['Exception ID', 'Transaction Reference', 'Supplier/Vendor', 'Amount', 'Control Requirement', 'Evidence Observed', 'Exception Identified', 'Risk Impact', 'Severity', 'Auditor Follow-up'];
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const other = await browser.newContext({ baseURL });
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const results = [];
let documentId;
const get = async (path) => { const res = await context.request.get(`/api/v1${path}`, { timeout: 120000 }); assert.equal(res.status(), 200, `${path}: ${await res.text()}`); return res.json(); };
const generate = async (data) => { const res = await context.request.post('/api/v1/ai/copilot', { data, timeout: 120000 }); assert.equal(res.status(), 201, await res.text()); return res.json(); };
try {
  for (const [ctx, email] of [[context, 'admin@bdo-ea.com'], [other, 'manager@bdo-ea.com']]) {
    const res = await ctx.request.post('/api/v1/auth/login', { data: { email, password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' }, timeout: 120000 });
    assert.equal(res.status(), 200, await res.text());
  }
  const status = await get('/ai/status'); assert.equal(status.version, '2.1');
  const targets = {};
  for (const kind of ['Engagement', 'Workpaper', 'Finding', 'Control', 'Risk', 'Entity', 'Process', 'Evidence', 'Procedure']) {
    const list = await get(`/ai/targets?type=${kind}`); assert.ok(Array.isArray(list.items));
    targets[kind] = list.items[0];
  }
  assert.ok(targets.Engagement && targets.Control && targets.Workpaper && targets.Finding, 'Expected existing demo audit records');
  const unchanged = [];
  for (const [kind, path, fields] of [['Control', 'controls', ['effectiveness', 'designEffective', 'operatingEffective']], ['Risk', 'risks', ['rating', 'residualImpact', 'residualLikelihood']], ['Workpaper', 'workpapers', ['status', 'conclusion']], ['Finding', 'findings', ['status', 'severity', 'dueDate']], ['Engagement', 'engagements', ['stage', 'status', 'opinion', 'reportIssuedAt']]]) {
    if (!targets[kind]) continue;
    const url = `/${path}/${targets[kind].id}`; const record = await get(url);
    unchanged.push({ url, fields, snapshot: Object.fromEntries(fields.map((f) => [f, record[f]])) });
  }
  console.log('PASS assistant status, all nine target pickers and existing audit records');
  await page.goto('/copilot', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('a[href="/requests"]').waitFor({ state: 'attached' });
  await page.getByRole('heading', { name: 'AI Sphere', exact: true }).waitFor();
  await page.getByLabel('Upload context documents').setInputFiles({ name: `${prefix}.csv`, mimeType: 'text/csv', buffer: csv });
  await page.getByRole('checkbox', { name: `Use ${prefix}.csv as context`, exact: true }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Upload documents', exact: true }).waitFor({ timeout: 120000 });
  documentId = (await get('/ai/context-documents')).items.find((d) => d.fileName === `${prefix}.csv`).id;
  await page.getByLabel('Capability', { exact: true }).click();
  await page.getByRole('option', { name: 'Evidence Review & Exception Analysis', exact: true }).click();
  await page.getByLabel('Audit context type', { exact: true }).click();
  await page.getByRole('option', { name: 'Control', exact: true }).click();
  await page.getByLabel('Audit record', { exact: true }).click();
  await page.getByLabel('Search audit records', { exact: true }).fill(targets.Control.label.split(' - ')[0]);
  await page.getByRole('button', { name: targets.Control.label, exact: true }).click();
  const generated = page.waitForResponse((r) => r.url().endsWith('/ai/copilot') && r.request().method() === 'POST', { timeout: 120000 });
  await page.getByRole('button', { name: 'Generate review', exact: true }).click();
  const response = await generated; assert.equal(response.status(), 201, await response.text());
  const evidence = await response.json(); results.push(evidence);
  assert.equal(evidence.reviewRequired, true); assert.equal(evidence.reviewNotice, notice);
  assert.ok(evidence.exceptions.some((e) => e.observation.includes('SYN-001') && e.observation.includes('after the commitment')));
  assert.ok(evidence.exceptions.some((e) => e.observation.includes('did not identify the approver')));
  const register = evidence.sections.find((s) => s.title === 'Exception Register');
  assert.deepEqual(register.columns, registerColumns);
  const supplierF = register.rows.find((r) => r.cells[1] === 'SYN-006');
  assert.equal(supplierF.cells[2], 'Supplier F'); assert.equal(supplierF.cells[3], 'KES 650,000');
  assert.ok(supplierF.cells[6].includes('Approval authority could not be confirmed for Supplier F amounting to KES 650,000'));
  assert.ok(supplierF.cells[9].includes('delegation matrix'));
  assert.equal(new Set(register.rows.map((r) => r.cells[0])).size, register.rows.length);
  assert.equal(evidence.evidenceAssessment.status, 'PARTIALLY_SUFFICIENT');
  await page.getByRole('heading', { name: evidence.title, exact: true }).waitFor();
  assert.ok(await page.getByText(notice, { exact: true }).first().isVisible());
  await page.getByRole('heading', { name: 'AI Sphere', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, 'assistant-desktop.png') });
  const registerRegion = page.getByRole('region', { name: 'Exception Register table', exact: true });
  await registerRegion.scrollIntoViewIfNeeded();
  assert.deepEqual(await page.getByRole('table', { name: 'Exception Register', exact: true }).locator('thead th').allTextContents(), registerColumns);
  await page.screenshot({ path: join(output, 'exception-register-desktop.png') });
  await registerRegion.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.screenshot({ path: join(output, 'exception-register-follow-up.png') });
  assert.ok(await registerRegion.evaluate((el) => el.scrollLeft > 0));
  await registerRegion.evaluate((el) => { el.scrollLeft = 0; });
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download audit review', exact: true }).click();
  const download = await downloading; await download.saveAs(join(output, 'review.md'));
  const markdown = await readFile(join(output, 'review.md'), 'utf8'); assert.ok(markdown.includes(notice) && markdown.includes('SYN-001') && markdown.includes('Source register'));
  assert.ok(markdown.includes('## Exception Register') && registerColumns.every((column) => markdown.includes(column)) && markdown.includes('KES 650,000'));
  const docSource = evidence.sourceRegister.find((s) => s.recordId === documentId);
  await page.getByTitle(`View source ${docSource.id}`, { exact: true }).first().click();
  await page.getByRole('tab', { name: /^Sources/ }).waitFor();
  const sourcePanel = page.getByRole('tabpanel');
  const originalDownload = page.waitForEvent('download');
  await sourcePanel.getByRole('button', { name: `Download ${prefix}.csv`, exact: true }).click();
  await (await originalDownload).saveAs(join(output, 'original.csv'));
  assert.deepEqual(await readFile(join(output, 'original.csv')), csv);
  await page.getByRole('tab', { name: 'Context links', exact: true }).click();
  assert.ok((await page.getByRole('tabpanel').innerText()).length > 40);
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  console.log('PASS uploaded evidence, late/missing approval checks, citations, hierarchy and Markdown/original downloads');

  for (const [feature, kind] of [['planning.scope', 'Engagement'], ['fieldwork.procedures', 'Control'], ['finding.draft', 'Finding'], ['report.summary', 'Engagement'], ['quality.check', 'Workpaper'], ['risk.radar', 'Entity'], ['search.nl', null]]) {
    const data = { feature, prompt: feature === 'search.nl' ? 'Show me all procurement controls tested in the last year with exceptions.' : 'Review the selected audit context and cite sources.', documentIds: feature === 'finding.draft' ? [documentId] : [], ...(kind && targets[kind] ? { targetType: kind, targetId: targets[kind].id } : {}), ...(feature === 'finding.draft' ? { impact: 4, likelihood: 3, ratingRationale: 'Synthetic validation factors, subject to auditor confirmation.' } : {}), ...(feature === 'fieldwork.procedures' ? { populationSize: 5000 } : {}) };
    const result = await generate(data); results.push(result);
    assert.equal(result.reviewRequired, true); assert.ok(result.sections.length >= 3); assert.ok(result.sourceRegister.length > 0);
    const sourceIds = new Set(result.sourceRegister.map((s) => s.id));
    for (const s of result.sections) for (const statement of [...s.items, ...s.rows]) for (const id of statement.sourceIds) assert.ok(sourceIds.has(id));
    if (feature === 'finding.draft') { assert.equal(result.ratingProposal.score, 12); assert.ok(result.sections.some((s) => s.title === 'Cause')); }
    if (feature === 'report.summary') { const metrics = result.sections.find((s) => s.title === 'Dashboard'); assert.ok(metrics.rows.every((r) => /^\d+$/.test(r.cells[1]))); }
    if (feature === 'search.nl') { assert.equal(result.search.exceptionsOnly, true); assert.ok(result.search.results.length > 0, 'Expected seeded procurement control test with exceptions'); }
    console.log(`PASS ${feature}: ${result.sourceRegister.length} sources, ${result.reviewerNotes.length} review notes`);
  }
  const supplierSearch = await generate({ feature: 'search.nl', prompt: 'Which suppliers had approval exceptions?' });
  assert.ok(supplierSearch.search.terms.includes('approval'));
  assert.ok(supplierSearch.search.intelligence.sourcesAnalysed > 0);
  assert.ok(['High', 'Medium', 'Low'].includes(supplierSearch.search.intelligence.confidence));
  const history = await get('/ai/interactions?pageSize=10'); assert.ok(history.items.every((i) => !('request' in i) && !('response' in i)));
  assert.equal((await get(`/ai/interactions/${evidence.id}`)).prompt, response.request().postDataJSON().prompt);
  assert.equal((await other.request.get(`/api/v1/ai/interactions/${evidence.id}`)).status(), 404);
  assert.equal((await other.request.post('/api/v1/ai/copilot', { data: { feature: 'evidence.summary', prompt: 'Review.', documentIds: [documentId] } })).status(), 403);
  assert.equal((await context.request.post('/api/v1/ai/copilot', { data: { feature: 'quality.check', prompt: 'Review.', targetType: 'Workpaper', targetId: randomUUID() } })).status(), 404);
  assert.equal((await context.request.get('/api/v1/ai/targets?type=User')).status(), 400);
  console.log('PASS requester-only history, private sources and invalid target handling');
  await page.getByRole('button', { name: 'Open interaction', exact: true }).first().click();
  await page.getByRole('button', { name: 'Download audit review', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open interaction', exact: true }).first().click();
  await page.getByRole('button', { name: 'Download audit review', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('heading', { name: 'AI Sphere', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, 'assistant-mobile.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile document overflow');
  await page.getByRole('button', { name: 'Download audit review', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, 'assistant-mobile-review.png') });
  await registerRegion.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, 'exception-register-mobile.png') });
  assert.ok(await registerRegion.evaluate((el) => el.clientWidth < 390 && el.scrollWidth > el.clientWidth));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Register causes mobile page overflow');
  const historic = await get(`/ai/interactions/${evidence.id}`);
  assert.deepEqual(historic.sections.find((s) => s.title === 'Exception Register').rows, register.rows);
  for (const record of unchanged) { const after = await get(record.url); assert.deepEqual(Object.fromEntries(record.fields.map((f) => [f, after[f]])), record.snapshot, `AI mutated ${record.url}`); }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(), provider: status.provider, capabilities: results.map((r) => ({ title: r.title, sources: r.sourceRegister.length, reviewerNotes: r.reviewerNotes.length })), domainRecordsUnchanged: true, browserErrors: errors }, null, 2));
  console.log('PASS repeat history opening, desktop/mobile views and unchanged audit statuses/ratings');
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  console.error('Browser errors:', errors); throw error;
} finally {
  if (documentId) { const res = await context.request.delete(`/api/v1/documents/${documentId}`); assert.ok(res.ok(), 'Synthetic context cleanup failed'); }
  await context.request.post('/api/v1/auth/logout').catch(() => {});
  await other.request.post('/api/v1/auth/logout').catch(() => {});
  await browser.close();
}
