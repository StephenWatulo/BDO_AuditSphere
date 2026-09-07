import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const output = join(process.cwd(), '.local-dev', 'home-dashboard-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const context = await browser.newContext({ baseURL: process.env.SMOKE_URL ?? 'http://localhost:3000', viewport: { width: 1440, height: 1100 } });
const failures = [];
const stat = (page, label) => page.locator('p').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').locator('p').nth(1);

function emptyDashboard(key, data) {
  if (key === 'partner') return { ...data, engagementsByStage: [], budgetVsActual: [], utilisation: { periodDays: 28, items: [] }, overdueMilestones: { count: 0, items: [] } };
  return { ...data, riskProfile: { ...data.riskProfile, cells: [], totalActiveRisks: 0 }, planProgress: null, keyFindings: { count: 0, items: [] }, repeatFindings: { count: 0, items: [] }, overdueActions: { total: 0, buckets: [] }, riskTrend: [] };
}

function boundaryDashboard(key, data) {
  if (key === 'partner') return {
    ...data,
    utilisation: { periodDays: 28, items: [
      { userId: 'zero-capacity', displayName: 'No capacity configured', capacityHours: 0, recordedHours: 12, utilisationPct: null },
      { userId: 'measured-capacity', displayName: 'Measured staff', capacityHours: 160, recordedHours: 80, utilisationPct: 50 },
    ] },
    overdueMilestones: { count: 37, items: data.overdueMilestones.items.slice(0, 1) },
  };
  return {
    ...data,
    planProgress: { planId: 'test-plan', title: 'Dashboard test plan', fiscalYear: 2026, total: 7, completed: 1, inProgress: 1, completionPct: 14, byStatus: [{ status: 'PLANNED', count: 3 }, { status: 'DEFERRED', count: 2 }] },
    keyFindings: { count: 47, items: data.keyFindings.items.slice(0, 1) },
    repeatFindings: { count: 31, items: data.repeatFindings.items.slice(0, 1) },
    overdueActions: { total: 29, buckets: data.overdueActions.buckets.map((bucket, i) => ({ ...bucket, count: i === 0 ? 29 : 0 })) },
    riskTrend: [
      { period: '2026-Q1', assessments: 2, avgInherentScore: 16, avgResidualScore: 9 },
      { period: '2026-Q2', assessments: 2, avgInherentScore: 20, avgResidualScore: 10 },
    ],
  };
}

try {
  const login = await context.request.post('/api/v1/auth/login', {
    data: { email: process.env.SMOKE_EMAIL ?? 'admin@bdo-ea.com', password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' },
    timeout: 120000,
  });
  assert.equal(login.status(), 200);
  for (const [key, tab, heading] of [['partner', 'Portfolio', 'Engagements by stage'], ['committee', 'Audit committee', 'Residual risk profile']]) {
    const response = await context.request.get(`/api/v1/dashboards/${key}`);
    assert.equal(response.status(), 200);
    const data = await response.json();
    console.log(`${tab} API: 200`);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto('/', { timeout: 120000 });
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor({ timeout: 15000 });
      assert.equal(await stat(page, key === 'partner' ? 'Overdue milestones' : 'Key findings').innerText(), String(key === 'partner' ? data.overdueMilestones.count : data.keyFindings.count));
      await page.waitForTimeout(600);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(output, `${key}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: join(output, `${key}-mobile.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tab} overflows on mobile`);
      console.log(`PASS ${tab}: desktop and mobile`);
    } catch (error) {
      await page.screenshot({ path: join(output, `${key}-failure.png`), fullPage: true });
      failures.push({ tab, errors, message: error.message });
    } finally { await page.close(); }

    for (const scenario of ['empty', 'boundary']) {
      const testPage = await context.newPage();
      const errors = [];
      testPage.on('pageerror', (error) => errors.push(error.message));
      const payload = scenario === 'empty' ? emptyDashboard(key, data) : boundaryDashboard(key, data);
      await testPage.route(`**/api/v1/dashboards/${key}`, (route) => route.fulfill({ json: payload }));
      try {
        await testPage.goto('/');
        await testPage.getByRole('tab', { name: tab, exact: true }).click();
        await testPage.getByRole('heading', { name: heading, exact: true }).waitFor();
        if (scenario === 'empty') {
          await testPage.getByText(key === 'partner' ? 'No utilisation data' : 'No active audit plan', { exact: true }).first().waitFor();
          await testPage.getByText(key === 'partner' ? 'No overdue milestones' : 'No trend data yet', { exact: true }).waitFor();
        } else if (key === 'partner') {
          assert.equal(await stat(testPage, 'Overdue milestones').innerText(), '37');
          assert.equal(await stat(testPage, 'Average utilisation').innerText(), '50%');
          await testPage.getByText('12 h / 0 h', { exact: true }).waitFor();
        } else {
          assert.equal(await stat(testPage, 'Key findings').innerText(), '47');
          assert.equal(await stat(testPage, 'Overdue actions').innerText(), '29');
          await testPage.getByText('31 repeat findings', { exact: true }).waitFor();
          const plan = testPage.locator('section').filter({ has: testPage.getByRole('heading', { name: 'Plan progress', exact: true }) });
          assert.equal(await plan.locator('div').filter({ has: testPage.locator('dt').filter({ hasText: /^Deferred$/ }) }).last().locator('dd').innerText(), '2');
          await testPage.locator('.recharts-line-curve').nth(1).waitFor();
          assert.equal(await testPage.locator('.recharts-line-curve').count(), 2);
          assert.ok(await testPage.locator('.recharts-line-curve').evaluateAll((paths) => paths.every((path) => path.getAttribute('d')?.length > 10)));
        }
        assert.deepEqual(errors, []);
        assert.ok(!/NaN|undefined/.test(await testPage.locator('main').innerText()));
        console.log(`PASS ${tab}: ${scenario} data`);
      } catch (error) { failures.push({ tab, scenario, errors, message: error.message }); }
      finally { await testPage.close(); }
    }
  }
  assert.deepEqual(failures, []);
} finally {
  await context.request.post('/api/v1/auth/logout', { timeout: 10000 }).catch(() => {});
  await browser.close();
}
