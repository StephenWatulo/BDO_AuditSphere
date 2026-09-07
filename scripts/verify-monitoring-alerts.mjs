import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const output = join(process.cwd(), '.local-dev', 'monitoring-alert-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const reader = await browser.newContext({ baseURL });
const denied = await browser.newContext({ baseURL });
const page = await admin.newPage();
page.setDefaultTimeout(25000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const dialog = page.getByRole('dialog');
const assertFits = async (target) => {
  assert.ok(await target.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), 'Alert panel overflows horizontally');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflows horizontally');
};

try {
  for (const [context, email] of [[admin, 'admin@bdo-ea.com'], [reader, 'junior@bdo-ea.com'], [denied, 'owner@client.example']]) {
    const res = await context.request.post('/api/v1/auth/login', { data: { email, password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' }, timeout: 120000 });
    assert.equal(res.status(), 200, await res.text());
  }
  const listRes = await admin.request.get('/api/v1/monitoring/alerts');
  assert.equal(listRes.status(), 200);
  const list = await listRes.json();
  assert.ok(list.items.length >= 2, 'Seed at least two demo monitoring alerts');
  const first = list.items[0];
  const endpoint = `/api/v1/monitoring/alerts/${first.id}`;
  const detailRes = await admin.request.get(endpoint);
  assert.equal(detailRes.status(), 200, await detailRes.text());
  const detail = await detailRes.json();
  assert.equal(typeof detail.amount, 'string');
  assert.equal(Number(detail.amount), Number(detail.detail.amount));
  assert.ok(detail.rule.description);
  assert.equal((await reader.request.get(endpoint)).status(), 200);
  assert.equal((await reader.request.patch(endpoint, { data: { assigneeId: null } })).status(), 403);
  assert.equal((await denied.request.get(endpoint)).status(), 403);
  assert.equal((await admin.request.get('/api/v1/monitoring/alerts/not-a-uuid')).status(), 400);
  assert.equal((await admin.request.get(`/api/v1/monitoring/alerts/${randomUUID()}`)).status(), 404);
  console.log('PASS detail API, amounts, read/manage permissions and missing IDs');

  await page.goto('/monitoring', { timeout: 120000 });
  const titleLink = page.getByRole('link', { name: first.title, exact: true });
  await titleLink.waitFor();
  await page.getByRole('combobox', { name: 'Alert status', exact: true }).first().click();
  assert.equal(await dialog.count(), 0, 'Opening a status menu must not open the alert');
  await page.keyboard.press('Escape');
  await titleLink.click();
  await dialog.getByRole('heading', { name: first.title, exact: true }).waitFor();
  await dialog.getByRole('heading', { name: 'Transaction details', exact: true }).waitFor();
  await dialog.getByText(detail.rule.description, { exact: true }).waitFor();
  for (const invoice of detail.detail.invoices ?? []) await dialog.getByText(invoice, { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('alert'), first.id);
  await dialog.getByRole('button', { name: 'Copy alert link' }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), page.url());
  await assertFits(dialog);
  await page.screenshot({ path: join(output, 'alert-desktop.png'), fullPage: true });
  await page.reload();
  await dialog.getByRole('heading', { name: first.title, exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertFits(dialog);
  await page.screenshot({ path: join(output, 'alert-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.waitForFunction((id) => document.activeElement?.id === `monitoring-alert-${id}`, first.id);
  assert.equal(new URL(page.url()).searchParams.has('alert'), false);
  await titleLink.press('Enter');
  await dialog.getByRole('heading', { name: first.title, exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  console.log('PASS title links, keyboard opening, copy link, refresh, close and mobile layout');

  await page.goto('/monitoring?page=2&pageSize=1');
  await page.getByRole('link', { name: list.items[1].title, exact: true }).waitFor();
  await page.locator('tbody tr').first().focus();
  await page.keyboard.press('Enter');
  await dialog.getByRole('heading', { name: list.items[1].title, exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(new URL(page.url()).searchParams.get('page'), '2');
  assert.equal(new URL(page.url()).searchParams.get('pageSize'), '1');
  console.log('PASS row keyboard opening and preserved list pagination');

  const readPage = await reader.newPage();
  readPage.on('pageerror', (error) => errors.push(error.message));
  await readPage.goto(`/monitoring?alert=${first.id}`);
  await readPage.getByRole('dialog').getByRole('heading', { name: first.title, exact: true }).waitFor();
  await readPage.getByRole('dialog').getByRole('heading', { name: 'Transaction details', exact: true }).waitFor();
  assert.equal(await readPage.getByRole('dialog').getByRole('combobox').count(), 0);
  await readPage.close();
  console.log('PASS read-only alert view');

  // Mutations are intercepted so this check never changes the user's real alerts.
  let current = structuredClone(detail);
  let fail = false;
  const changes = [];
  await page.route(`**${endpoint}`, async (route) => {
    if (fail) return route.fulfill({ status: 503, json: { message: 'Synthetic temporary error' } });
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON();
      changes.push(patch);
      current = { ...current, ...patch, ...(patch.assigneeId === null ? { assignee: null } : {}) };
    }
    return route.fulfill({ json: current });
  });
  await page.route(/\/api\/v1\/monitoring\/alerts(?:\?.*)?$/, (route) => route.fulfill({ json: { ...list, items: list.items.map((alert) => alert.id === first.id ? current : alert) } }));
  await page.goto(`/monitoring?alert=${first.id}`);
  await dialog.getByLabel('Status', { exact: true }).click();
  const changed = page.waitForResponse((res) => res.url().endsWith(endpoint) && res.request().method() === 'PATCH');
  await page.getByRole('option', { name: 'Investigating', exact: true }).click();
  await changed;
  await page.waitForFunction(() => document.getElementById('monitoring-alert-status')?.textContent.includes('Investigating'));
  const unassigned = page.waitForResponse((res) => res.url().endsWith(endpoint) && res.request().method() === 'PATCH');
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await unassigned;
  await dialog.getByRole('combobox', { name: 'Assignee', exact: true }).getByText('Unassigned', { exact: true }).waitFor();
  assert.deepEqual(changes, [{ status: 'INVESTIGATING' }, { assigneeId: null }]);
  console.log('PASS status and assignee controls with safe mocked updates');

  current = { ...current, title: 'Long alert ' + 'TransactionReference'.repeat(20), detail: { repeatedPayment: false, exceptionCount: 0, narrative: '<script>bad()</script>', records: [{ invoice: 'INV-2', flags: ['duplicate', 'review'] }], explanation: 'x'.repeat(500) } };
  await page.reload();
  await dialog.getByRole('heading', { name: 'Transaction details', exact: true }).waitFor();
  await dialog.getByText('<script>bad()</script>', { exact: true }).waitFor();
  await assertFits(dialog);
  await page.screenshot({ path: join(output, 'alert-long-mobile.png'), fullPage: true });
  current = { ...detail, detail: {}, amount: null, rule: null, assignee: null, assigneeId: null };
  await page.reload();
  await dialog.getByText('No transaction details recorded.', { exact: true }).waitFor();
  await dialog.getByText('Rule details unavailable.', { exact: true }).waitFor();
  fail = true;
  await page.reload();
  await dialog.getByText('Could not load alert', { exact: true }).waitFor();
  fail = false;
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await dialog.getByText('No transaction details recorded.', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS long/nested details, safe text rendering, empty state and retry');
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
  console.error('Browser errors:', errors);
  throw error;
} finally {
  for (const context of [admin, reader, denied]) await context.request.post('/api/v1/auth/logout').catch(() => {});
  await browser.close();
}
