import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const password = process.env.SMOKE_PASSWORD;
assert.ok(password, 'Set SMOKE_PASSWORD for a permitted demo/test user.');
const output = join(process.cwd(), '.local-dev', 'audit-intelligence-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  const login = await context.request.post('/api/v1/auth/login', { data: { email: process.env.SMOKE_EMAIL ?? 'admin@bdo-ea.com', password, tenantSlug: process.env.SMOKE_TENANT ?? 'bdo-ea' }, timeout: 120000 });
  assert.equal(login.status(), 200, await login.text());
  const status = await context.request.get('/api/v1/ai/status');
  assert.equal((await status.json()).intelligenceSearch, true, 'Restart the API with the upgraded code first.');
  await page.goto('/copilot', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('a[href="/requests"]').waitFor({ state: 'attached' });
  await page.getByLabel('Capability', { exact: true }).click();
  await page.getByRole('option', { name: 'Audit Intelligence Search', exact: true }).click();
  assert.match(await page.getByLabel('Search scope', { exact: true }).innerText(), /All audit universe/);
  assert.equal(await page.getByRole('checkbox', { name: 'All record types', exact: true }).isChecked(), true);
  await page.getByLabel(/^Instruction/).fill('Show all findings');
  const responsePromise = page.waitForResponse((r) => r.url().endsWith('/ai/copilot') && r.request().method() === 'POST', { timeout: 120000 });
  await page.getByRole('button', { name: 'Search audit records', exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 201, await response.text());
  const result = await response.json();
  assert.equal(result.model, 'audit-intelligence-index-v1');
  assert.equal(result.reviewRequired, true);
  assert.ok(result.search.intelligence.totalMatches > 0, 'This smoke test requires existing findings; it never creates audit records.');
  const table = page.getByRole('table', { name: 'Audit intelligence results', exact: true });
  await table.waitFor();
  assert.equal(await table.locator('thead th').count(), 7);
  await table.locator('tbody tr').first().locator('summary').click();
  assert.ok(await table.locator('a').count() > 0);
  const tableRegion = page.getByRole('region', { name: 'Audit intelligence table', exact: true });
  await tableRegion.evaluate((el) => { el.scrollLeft = 0; });
  await page.getByRole('heading', { name: 'AI Sphere', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, 'intelligence-desktop-viewport.png') });
  await page.screenshot({ path: join(output, 'intelligence-desktop.png'), fullPage: true });
  const history = await context.request.get(`/api/v1/ai/interactions/${result.id}`);
  assert.equal(history.status(), 200, await history.text());
  assert.deepEqual((await history.json()).search.intelligence, result.search.intelligence);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download audit review', exact: true }).click();
  const download = await downloadPromise;
  const text = await readFile(await download.path(), 'utf8');
  assert.match(text, /Auditor review required/); assert.match(text, /Source register/); assert.match(text, /Coverage/);
  await page.setViewportSize({ width: 390, height: 844 });
  await table.locator('tbody tr').first().locator('summary').click();
  await tableRegion.evaluate((el) => { el.scrollLeft = 0; });
  await table.scrollIntoViewIfNeeded();
  const region = page.getByRole('region', { name: 'Audit intelligence table', exact: true });
  assert.ok(await region.evaluate((el) => el.clientWidth < 390 && el.scrollWidth > el.clientWidth));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: join(output, 'intelligence-mobile.png'), fullPage: true });
  await page.screenshot({ path: join(output, 'intelligence-mobile-viewport.png') });
  for (const prompt of [
    'Show me all procurement-related findings identified across completed audits.',
    'Which risks have linked findings?',
    'Show me all open audit actions with owners and due dates.',
    'Which controls have recurring weaknesses?',
  ]) {
    const response = await context.request.post('/api/v1/ai/copilot', { data: { feature: 'search.nl', prompt }, timeout: 120000 });
    assert.equal(response.status(), 201, await response.text());
    const answer = await response.json(); const info = answer.search.intelligence;
    assert.equal(info.incompleteKinds.length, 0, `Incomplete indexing for ${prompt}`);
    assert.ok(info.totalMatches > 0, `Expected existing linked records for: ${prompt}`);
    console.log(`PASS live query: ${info.totalMatches} results across ${info.engagementCount} engagements: ${prompt}`);
  }
  const procurement = await context.request.post('/api/v1/ai/copilot', { data: { feature: 'search.nl', prompt: 'Show all procurement findings' }, timeout: 120000 });
  assert.equal(procurement.status(), 201, await procurement.text());
  const answer = await procurement.json();
  const match = answer.search.intelligence.rows.find((r) => answer.sourceRegister.find((s) => s.id === r.sourceId)?.label.includes('Incomplete procurement approval evidence and authority validation'));
  assert.ok(match, 'Expected the existing procurement approval finding in all audits');
  assert.equal(match.severity, 'MEDIUM'); assert.equal(match.status, 'CLOSED'); assert.equal(match.owner.replace(/\s+/g, ' '), 'Susan Finance Manager');
  const parent = answer.sourceRegister.find((s) => s.kind === 'Engagement' && s.label.startsWith('IA-2026-020'));
  assert.ok(parent);
  console.log(`PASS existing F-01 retrieved; parent engagement: ${JSON.parse(parent.excerpt).status}. A closed finding does not make its audit completed.`);
  assert.deepEqual(errors, []);
  console.log('PASS intelligence scope controls, results, source links, history, Markdown export and desktop/mobile layout');
} finally { await browser.close(); }
