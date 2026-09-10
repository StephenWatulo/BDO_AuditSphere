import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const output = join(process.cwd(), '.local-dev', 'finding-owner-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const reviewer = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const admin = await browser.newContext({ baseURL });
const committee = await browser.newContext({ baseURL });
const page = await reviewer.newPage();
page.setDefaultTimeout(45000);
const navigation = { waitUntil: 'domcontentloaded', timeout: 120000 };
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const missingDate = 'A due date is required. The recorded action owner is already sufficient.';
const assertFits = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflows horizontally');

try {
  for (const [context, email] of [[reviewer, 'reviewer@client.example'], [admin, 'admin@bdo-ea.com'], [committee, 'committee@client.example']]) {
    const login = await context.request.post('/api/v1/auth/login', { data: { email, password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' }, timeout: 120000 });
    assert.equal(login.status(), 200, await login.text());
  }
  assert.equal((await reviewer.request.get('/api/v1/users')).status(), 403);
  assert.equal((await committee.request.get('/api/v1/users/options')).status(), 403);
  assert.equal((await admin.request.get('/api/v1/users/options')).status(), 200);
  const optionsRes = await reviewer.request.get('/api/v1/users/options');
  assert.equal(optionsRes.status(), 200, await optionsRes.text());
  const options = await optionsRes.json();
  assert.ok(options.items.length > 0);
  for (const user of options.items) assert.deepEqual(Object.keys(user).sort(), ['avatarUrl', 'displayName', 'email', 'id', 'jobTitle']);
  const searchRes = await reviewer.request.get('/api/v1/users/options?q=reviewer%40client.example&role=MANAGEMENT_REVIEWER');
  assert.equal(searchRes.status(), 200, await searchRes.text());
  const search = await searchRes.json();
  const lydia = search.items.find((user) => user.email === 'reviewer@client.example');
  assert.ok(lydia, 'Seed the demo management reviewer');
  assert.equal((await reviewer.request.get(`/api/v1/users/${lydia.id}`)).status(), 403);
  const statusOverride = await reviewer.request.get('/api/v1/users/options?status=SUSPENDED');
  assert.equal(statusOverride.status(), 200);
  assert.deepEqual((await statusOverride.json()).items, options.items);
  assert.equal((await reviewer.request.get('/api/v1/users/options?pageSize=201')).status(), 400);
  console.log('PASS live assignment directory, contact-only fields, search, role filter, bounds and admin permission isolation');

  const listRes = await admin.request.get('/api/v1/findings?pageSize=1');
  assert.equal(listRes.status(), 200);
  const list = await listRes.json();
  assert.ok(list.items.length, 'Seed at least one demo finding');
  const detailRes = await admin.request.get(`/api/v1/findings/${process.env.SMOKE_FINDING_ID ?? list.items[0].id}`);
  assert.equal(detailRes.status(), 200);
  const detail = await detailRes.json();
  const id = randomUUID();
  const endpoint = `/api/v1/findings/${id}`;
  const fixture = {
    ...detail, id, title: 'Synthetic action-owner verification', reference: 'F-TEST', status: 'MANAGEMENT_REVIEW',
    condition: 'Synthetic condition.', criteria: 'Synthetic criteria.', cause: 'Synthetic cause.', impact: 'Synthetic impact.', recommendation: 'Synthetic corrective action.',
    managementResponse: 'Management agrees', actionOwnerId: null, actionOwner: null, actionOwnerName: lydia.displayName, actionOwnerEmail: lydia.email,
    dueDate: null, originalDueDate: null, extensionCount: 0, agreedAt: null, implementedAt: null, validatedAt: null, closedAt: null,
    engagement: { ...detail.engagement, title: 'Synthetic audit', auditNumber: 'IA-TEST' }, entity: null, workpaper: null, risk: null, control: null, process: null,
    evidence: [], documents: [], recommendations: [], statusHistory: [], evidenceCount: 0, recommendationCount: 0, daysOverdue: 0, ageingBucket: 'NOT_DUE',
    availableActions: [{ action: 'agree', allowed: false, failedGuards: [{ guard: 'has_action_owner_and_due_date', message: missingDate }] }],
  };
  let current = structuredClone(fixture);
  let failSave = false;
  let failDirectory = false;
  const changes = [];
  const transitions = [];

  // All finding writes target an in-memory fixture, never the user's records.
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON();
      if (failSave) return route.fulfill({ status: 503, json: { message: 'Synthetic save failure. Please retry.' } });
      changes.push(patch);
      current = { ...current, ...patch, ...(patch.actionOwnerId ? { actionOwner: lydia } : {}) };
    }
    return route.fulfill({ json: current });
  });
  await page.route(`**${endpoint}/transition`, async (route) => {
    const input = route.request().postDataJSON();
    transitions.push(input);
    assert.equal(input.action, 'agree');
    if (!current.dueDate) return route.fulfill({ status: 422, json: { statusCode: 422, message: 'Workflow guard failed', guards: [{ guard: 'has_action_owner_and_due_date', message: missingDate }] } });
    current = { ...current, status: 'AGREED', agreedAt: new Date().toISOString(), availableActions: [] };
    return route.fulfill({ json: current });
  });
  await page.route(/\/api\/v1\/users\/options(?:\?.*)?$/, (route) => failDirectory
    ? route.fulfill({ status: 503, json: { message: 'Synthetic directory unavailable' } })
    : route.continue());

  await page.goto(`/findings/${id}`, navigation);
  await page.getByRole('heading', { name: fixture.title, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Agree finding', exact: true }).click();
  const guard = page.getByRole('dialog');
  await guard.getByText(missingDate, { exact: true }).waitFor();
  await guard.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.getByRole('button', { name: 'Set due date', exact: true }).click();
  const date = page.getByLabel('Due date', { exact: true });
  await date.fill('2026-12-31');
  failSave = true;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Synthetic save failure' }).waitFor();
  assert.equal(await date.inputValue(), '2026-12-31');
  failSave = false;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await date.waitFor({ state: 'detached' });
  assert.deepEqual(changes, [{ dueDate: '2026-12-31' }]);
  assert.equal(current.actionOwnerId, null);
  await page.getByRole('button', { name: 'Agree finding', exact: true }).click();
  await page.getByRole('button', { name: 'Agree finding', exact: true }).waitFor({ state: 'detached' });
  assert.equal(current.status, 'AGREED');
  assert.equal(transitions.length, 2);
  console.log('PASS precise agreement error, editable due date, failed-save recovery and agreement using external owner');

  current = structuredClone(fixture);
  await page.reload(navigation);
  const picker = page.getByRole('combobox', { name: 'Action owner', exact: true });
  await picker.click();
  const peopleSearch = page.getByPlaceholder(/Search people/);
  await peopleSearch.fill(lydia.email);
  await page.getByRole('option').filter({ hasText: lydia.displayName }).click();
  await picker.getByText(lydia.displayName, { exact: true }).waitFor();
  assert.deepEqual(changes.at(-1), { actionOwnerId: lydia.id, actionOwnerName: lydia.displayName, actionOwnerEmail: lydia.email });
  await assertFits();
  await page.screenshot({ path: join(output, 'owner-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await picker.click();
  await peopleSearch.fill('zz-no-such-person-000');
  await page.getByText('No active users found.', { exact: true }).waitFor();
  await peopleSearch.fill(lydia.email);
  await page.getByRole('option').filter({ hasText: lydia.displayName }).waitFor();
  await assertFits();
  await page.screenshot({ path: join(output, 'owner-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  console.log('PASS populated searchable owner picker, selection payload, empty search and desktop/mobile layout');

  failDirectory = true;
  await page.reload(navigation);
  await picker.click();
  await page.getByText('Could not load people.', { exact: true }).waitFor();
  assert.equal(await page.getByText('No active users found.', { exact: true }).count(), 0);
  await assertFits();
  await page.screenshot({ path: join(output, 'directory-error-mobile.png'), fullPage: true });
  failDirectory = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('option').filter({ hasText: lydia.displayName }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS directory error/retry and no browser runtime errors');
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
  console.error('Browser errors:', errors);
  throw error;
} finally {
  for (const context of [reviewer, admin, committee]) await context.request.post('/api/v1/auth/logout').catch(() => {});
  await browser.close();
}
