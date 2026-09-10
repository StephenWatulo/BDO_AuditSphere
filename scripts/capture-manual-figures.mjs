import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const output = join(process.cwd(), 'apps', 'api', 'assets', 'manual');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const context = await browser.newContext({ baseURL: process.env.SMOKE_URL ?? 'http://localhost:3000', viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1.5 });
const page = await context.newPage();
page.setDefaultTimeout(120000);
const navigation = { waitUntil: 'domcontentloaded', timeout: 120000 };
try {
  const login = await context.request.post('/api/v1/auth/login', { data: { email: 'admin@bdo-ea.com', password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' } });
  assert.equal(login.status(), 200);
  // No record writes are allowed while capturing illustrations.
  await page.route(/\/api\/v1\/(?!auth\/)/, async (route) => {
    assert.equal(route.request().method(), 'GET', 'Manual screenshots must not write business data');
    await route.continue();
  });
  await page.goto('/engagements/new', navigation);
  await page.locator('input[name="title"]').fill('Procurement controls review - demonstration');
  await page.locator('textarea[name="objectives"]').fill('Evaluate the design and operation of procurement approval controls.');
  await page.locator('textarea[name="scope"]').fill('Purchases and supplier changes during the agreed audit period.');
  await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Profile', exact: true }) }).screenshot({ path: join(output, 'engagement-profile.png') });

  const id = randomUUID();
  const fixture = {
    id, reference: 'F-01', title: 'Procurement approval documentation - demonstration', status: 'MANAGEMENT_REVIEW', severity: 'MEDIUM',
    condition: 'Approval evidence was not retained for selected purchases.', criteria: 'The approved policy requires documented authorisation.',
    cause: 'The filing responsibility was not clearly assigned.', impact: 'Purchases may not be supported by an approval record.', recommendation: 'Retain the authorisation record with each purchase.',
    managementResponse: 'Management agrees. The finance team will update the procedure and retain approval evidence.',
    actionOwnerId: null, actionOwner: null, actionOwnerName: 'Example action owner', actionOwnerEmail: 'owner@example.test', dueDate: null,
    originalDueDate: null, extensionCount: 0, ageingBucket: 'NOT_DUE', createdAt: '2026-09-07T08:00:00.000Z', recommendations: [], evidence: [], statusHistory: [],
  };
  await page.route(`**/api/v1/findings/${id}`, (route) => route.fulfill({ json: fixture }));
  await page.goto(`/findings/${id}`, navigation);
  await page.getByRole('button', { name: 'Set due date', exact: true }).waitFor();
  await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Management response', exact: true }) }).screenshot({ path: join(output, 'finding-response.png') });
  console.log('Captured two manual illustrations using unsaved / in-memory demonstration data.');
} finally {
  await context.request.post('/api/v1/auth/logout').catch(() => {});
  await browser.close();
}
