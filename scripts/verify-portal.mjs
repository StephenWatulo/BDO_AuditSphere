import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

// Browser check for the client portal (docs/client-portal.md). Needs the seeded database and
// both dev servers. Creates a synthetic engagement plus one request assigned to the seeded
// business owner, drives the respond-and-submit flow through the UI, then cancels the fixture
// engagement through the workflow.

const output = join(process.cwd(), '.local-dev', 'portal-check');
await mkdir(output, { recursive: true });
const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const password = process.env.SMOKE_PASSWORD ?? 'Admin123!';
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const admin = await browser.newContext({ baseURL });
const owner = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const staff = await browser.newContext({ baseURL });
const stamp = Date.now().toString(36).toUpperCase();
const failures = [];
let engagementId;

const login = async (context, email) => {
  const res = await context.request.post('/api/v1/auth/login', { data: { email, password, tenantSlug: 'bdo-ea' }, timeout: 120000 });
  assert.equal(res.status(), 200, `${email}: ${await res.text()}`);
  return (await res.json()).user;
};
const json = async (context, path) => {
  const res = await context.request.get(path);
  assert.equal(res.status(), 200, `${path}: ${res.status()} ${await res.text()}`);
  return res.json();
};
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const tileValue = (page, label) => page.locator('p').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').locator('p').nth(1);

try {
  await login(admin, 'admin@bdo-ea.com');
  const me = await login(owner, 'owner@client.example');
  await login(staff, 'junior@bdo-ea.com');

  // Fixture: a synthetic engagement with one request assigned to the business owner.
  const eng = await admin.request.post('/api/v1/engagements', {
    data: { title: `Portal check ${stamp}`, type: 'OPERATIONAL', objectives: 'Portal smoke test', scope: 'Synthetic fixture, cancelled on completion' },
  });
  assert.equal(eng.status(), 201, await eng.text());
  engagementId = (await eng.json()).id;
  const req = await admin.request.post('/api/v1/requests', {
    data: {
      engagementId,
      title: `Portal check request ${stamp}`,
      description: 'Please upload the signed policy.',
      assigneeId: me.id,
      dueDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    },
  });
  assert.equal(req.status(), 201, await req.text());
  const fixture = await req.json();

  const mine = await json(owner, '/api/v1/requests?mine=true&pageSize=200');
  const openCount = mine.items.filter((r) => r.status === 'OPEN' || r.status === 'RETURNED').length;
  assert.ok(mine.items.some((r) => r.id === fixture.id), 'fixture request should be in the owner list');
  const findings = await json(owner, '/api/v1/findings?mine=true&pageSize=200');
  const awaiting = findings.items.filter((f) => f.status === 'MANAGEMENT_REVIEW');
  assert.ok(awaiting.length > 0, 'the seed should give the owner a finding under management review');

  const page = await owner.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(120000);

  // Warm up: the dev server compiles each route's client bundle on first visit, which can
  // take minutes on a slow disk. Visiting every route once keeps hot reloads out of the
  // interactive steps below.
  for (const path of ['/portal', '/portal/requests', `/portal/requests/${fixture.id}`, '/portal/actions', `/portal/actions/${awaiting[0].id}`]) {
    await page.goto(path, { timeout: 600000, waitUntil: 'load' });
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 600000 });
  }
  console.log('warm-up complete');

  // 1. The workspace home redirects a portal-only user to /portal.
  await page.goto('/', { timeout: 600000 });
  await page.waitForURL('**/portal', { timeout: 600000 });
  await page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening), Samuel/ }).waitFor();
  await page.getByRole('link', { name: fixture.title }).first().waitFor();
  // Tiles show an ellipsis until both queries have loaded.
  await tileValue(page, 'Awaiting your response').filter({ hasText: /^\d+$/ }).waitFor();
  assert.equal(await tileValue(page, 'Requests needing action').innerText(), String(openCount));
  assert.equal(await tileValue(page, 'Awaiting your response').innerText(), String(awaiting.length));
  assert.ok(await noOverflow(page), 'Overview overflows on desktop');
  await page.screenshot({ path: join(output, 'overview-desktop.png'), fullPage: true });
  console.log('PASS overview: redirect from /, greeting, tile counts');

  // 2. Requests list, then respond and submit on the fixture.
  await page.getByRole('link', { name: 'My requests' }).click();
  await page.waitForURL('**/portal/requests');
  await page.getByRole('link', { name: fixture.title }).first().click();
  await page.waitForURL(`**/portal/requests/${fixture.id}`);
  await page.getByRole('heading', { level: 1, name: fixture.title }).waitFor();
  await page.getByText('Please upload the signed policy.').waitFor();
  await page.getByLabel('Response note').fill('Signed policy attached; the remaining annexes follow next week.');
  assert.equal(await page.getByLabel('Response note').inputValue(), 'Signed policy attached; the remaining annexes follow next week.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByText('Request updated').waitFor();
  await page.screenshot({ path: join(output, 'request-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Submit response' }).first().click();
  await page.getByText(/^Submitted /).waitFor();
  const after = await json(owner, `/api/v1/requests/${fixture.id}`);
  assert.equal(after.status, 'SUBMITTED');
  assert.equal(after.responseNote, 'Signed policy attached; the remaining annexes follow next week.');
  assert.ok(await noOverflow(page), 'Request page overflows on desktop');
  console.log('PASS request: note saved and submitted through the UI');

  // 3. Actions list and a finding awaiting the management response.
  await page.goto('/portal/actions');
  const finding = awaiting[0];
  await page.getByRole('link', { name: finding.title }).first().click();
  await page.waitForURL(`**/portal/actions/${finding.id}`);
  await page.getByRole('heading', { level: 1, name: finding.title }).waitFor();
  await page.getByText('Your management response is needed').first().waitFor();
  await page.getByRole('button', { name: 'Agree finding' }).first().waitFor();
  await page.getByRole('heading', { name: 'The finding', exact: true }).waitFor();
  assert.ok(await noOverflow(page), 'Finding page overflows on desktop');
  await page.screenshot({ path: join(output, 'finding-desktop.png'), fullPage: true });
  console.log('PASS finding: response section, agree action and read-only finding text');

  // 4. Mobile layouts.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, file] of [['/portal', 'overview-mobile.png'], [`/portal/requests/${fixture.id}`, 'request-mobile.png'], [`/portal/actions/${finding.id}`, 'finding-mobile.png']]) {
    await page.goto(path);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.waitForTimeout(400);
    assert.ok(await noOverflow(page), `${path} overflows on mobile`);
    await page.screenshot({ path: join(output, file), fullPage: true });
  }
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS mobile: no horizontal overflow, no page errors');

  // 5. Staff without responder permissions are turned away and keep the workspace home.
  const staffPage = await staff.newPage();
  staffPage.setDefaultTimeout(120000);
  await staffPage.goto('/portal');
  await staffPage.getByText('The client portal is for business owners').waitFor();
  await staffPage.goto('/');
  await staffPage.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ }).waitFor();
  assert.ok(!staffPage.url().includes('/portal'), 'staff must not be redirected to the portal');
  await staffPage.close();
  console.log('PASS access: junior auditor is turned away from /portal and keeps the workspace home');

  // 6. The audit team accepts the submission.
  const accept = await admin.request.post(`/api/v1/requests/${fixture.id}/transition`, { data: { action: 'accept' } });
  assert.equal(accept.status(), 201, await accept.text());
} catch (error) {
  failures.push(error.message);
  console.error(error);
} finally {
  if (engagementId) {
    const cancel = await admin.request
      .post(`/api/v1/engagements/${engagementId}/transition`, { data: { action: 'cancel', comment: 'Portal smoke test fixture' } })
      .catch(() => null);
    if (!cancel || cancel.status() !== 201) console.warn('Could not cancel the fixture engagement', engagementId, cancel ? await cancel.text() : '');
  }
  for (const context of [admin, owner, staff]) await context.request.post('/api/v1/auth/logout', { timeout: 10000 }).catch(() => {});
  await browser.close();
}

if (failures.length) process.exit(1);
console.log(`Client portal check passed. Screenshots in ${output}`);
