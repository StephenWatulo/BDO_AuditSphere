import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const output = join(process.cwd(), '.local-dev', 'engagement-type-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const context = await browser.newContext({ baseURL: process.env.SMOKE_URL ?? 'http://localhost:3000', viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(45000);
const navigation = { waitUntil: 'domcontentloaded', timeout: 120000 };
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const id = randomUUID();
const title = 'Synthetic internal audit type verification';

try {
  const login = await context.request.post('/api/v1/auth/login', { data: { email: 'admin@bdo-ea.com', password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' }, timeout: 120000 });
  assert.equal(login.status(), 200, await login.text());
  const filtered = await context.request.get('/api/v1/engagements?type=INTERNAL_AUDIT');
  assert.equal(filtered.status(), 200, await filtered.text());
  assert.ok((await filtered.json()).items.every((e) => e.type === 'INTERNAL_AUDIT'));
  // A missing synthetic ID proves PATCH accepts the type without modifying a real record.
  const patch = await context.request.patch(`/api/v1/engagements/${id}`, { data: { type: 'INTERNAL_AUDIT' } });
  assert.equal(patch.status(), 404, await patch.text());
  const list = await context.request.get('/api/v1/engagements?pageSize=1');
  assert.equal(list.status(), 200);
  const sampleId = (await list.json()).items[0]?.id;
  assert.ok(sampleId, 'A demo engagement is required for the read-only fixture');
  const detail = await context.request.get(`/api/v1/engagements/${sampleId}`);
  assert.equal(detail.status(), 200);
  let fixture = { ...await detail.json(), id, title, auditNumber: 'IA-TEST', stage: 'PLANNING', status: 'ACTIVE', milestones: [], members: [], stakeholders: [], availableActions: [] };
  console.log('PASS live API enum validation and database type filtering');

  const writes = [];
  // All form writes are intercepted; no engagement or audit number is created in the database.
  await page.route(/\/api\/v1\/engagements(?:\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON();
      writes.push(input);
      fixture = { ...fixture, ...input };
      return route.fulfill({ status: 201, json: fixture });
    }
    return route.continue();
  });
  await page.route(`**/api/v1/engagements/${id}`, (route) => {
    if (route.request().method() === 'PATCH') {
      const input = route.request().postDataJSON();
      writes.push(input);
      fixture = { ...fixture, ...input };
    }
    return route.fulfill({ json: fixture });
  });
  await page.goto('/engagements/new', navigation);
  await page.getByRole('link', { name: 'Requests', exact: true }).waitFor();
  await page.getByLabel(/^Title/).fill(title);
  const type = page.getByRole('combobox', { name: /^Type/ });
  assert.equal(await type.innerText(), 'Operational', 'The existing default must not change');
  await type.click();
  await page.getByRole('option', { name: 'Internal audit', exact: true }).click();
  await page.screenshot({ path: join(output, 'new-engagement-desktop.png') });
  await page.getByRole('button', { name: 'Create engagement', exact: true }).click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  assert.equal(writes[0]?.type, 'INTERNAL_AUDIT');
  assert.equal(writes[0]?.title, title);
  await page.getByRole('button', { name: 'Internal audit', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Type', exact: true }).click();
  await page.getByRole('combobox').filter({ hasText: 'Internal audit' }).click();
  await page.getByRole('option', { name: 'Operational', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Operational', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Type', exact: true }).click();
  await page.getByRole('combobox').filter({ hasText: 'Operational' }).click();
  await page.getByRole('option', { name: 'Internal audit', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Internal audit', exact: true }).waitFor();
  assert.equal(writes.at(-1).type, 'INTERNAL_AUDIT');
  console.log('PASS new engagement validation/submission, display and inline editing with synthetic saves');

  await page.goto('/engagements', navigation);
  await page.getByRole('link', { name: 'New engagement', exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  const [filterResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/v1/engagements?') && new URL(res.url()).searchParams.get('type') === 'INTERNAL_AUDIT'),
    page.getByRole('option', { name: 'Internal audit', exact: true }).click(),
  ]);
  assert.equal(filterResponse.status(), 200);
  await page.getByText('Type: Internal audit', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/engagements/new', navigation);
  await page.locator('a[href="/requests"]').waitFor({ state: 'attached' });
  await type.click();
  const option = page.getByRole('option', { name: 'Internal audit', exact: true });
  await option.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, 'engagement-types-mobile.png') });
  await option.click();
  assert.equal(await type.innerText(), 'Internal audit');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log('PASS list filtering, mobile selection and no browser runtime errors');
} catch (error) {
  console.error('Browser errors:', errors);
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await context.request.post('/api/v1/auth/logout').catch(() => {});
  await context.close();
  await browser.close();
}
