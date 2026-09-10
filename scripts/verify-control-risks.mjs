import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const output = join(process.cwd(), '.local-dev', 'control-risks-check');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER ?? 'chrome' });
const baseURL = process.env.SMOKE_URL ?? 'http://localhost:3000';
const admin = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const reader = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
const navigation = { waitUntil: 'domcontentloaded', timeout: 120000 };
const page = await admin.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const get = async (context, path) => {
  const res = await context.request.get(path);
  assert.equal(res.status(), 200, await res.text());
  return res.json();
};
const assertFits = async (target) => assert.ok(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page overflows horizontally');

try {
  for (const [context, email] of [[admin, 'admin@bdo-ea.com'], [reader, 'junior@bdo-ea.com']]) {
    const res = await context.request.post('/api/v1/auth/login', { data: { email, password: process.env.SMOKE_PASSWORD ?? 'Admin123!', tenantSlug: 'bdo-ea' }, timeout: 120000 });
    assert.equal(res.status(), 200, await res.text());
  }
  const list = await get(admin, '/api/v1/controls?pageSize=100');
  const linked = list.items.find((c) => c.risks?.length);
  assert.ok(linked, 'A linked control is required for read-only verification');
  for (const c of list.items) for (const r of c.risks) {
    assert.ok(r.id && r.code && r.title && r.rating, 'Expected a risk summary, not a join row');
    assert.equal(r.risk, undefined);
  }
  const detail = await get(admin, `/api/v1/controls/${linked.id}`);
  assert.deepEqual(detail.risks, linked.risks);
  const risk = await get(admin, `/api/v1/risks/${linked.risks[0].id}`);
  assert.ok(risk.controls.some((c) => c.id === linked.id && c.title === linked.title));
  console.log('PASS live control list/detail and reciprocal risk response contracts');

  // Refuse all real control writes from the browser. Synthetic writes below are handled in memory.
  await page.route(/\/api\/v1\/controls(?:\/[^?]*)?(?:\?.*)?$/, (route) => {
    if (route.request().method() !== 'GET') throw new Error('Unexpected write to a real control');
    return route.continue();
  });
  await page.goto('/controls', navigation);
  await page.locator('thead th').filter({ hasText: /^Linked risks$/ }).waitFor();
  await page.getByRole('button', { name: 'New control', exact: true }).waitFor();
  await page.getByRole('row').filter({ hasText: linked.code }).first().click();
  const links = page.getByRole('list', { name: 'Linked risks', exact: true });
  await links.getByRole('link', { name: `${risk.code} ${risk.title}`, exact: true }).waitFor();
  assert.equal(await links.getByRole('link').count(), linked.risks.length);
  await page.screenshot({ path: join(output, 'linked-risks-desktop.png') });
  await links.getByRole('link').first().click();
  await page.getByRole('list', { name: 'Linked controls', exact: true }).getByRole('link', { name: `${linked.code} ${linked.title}`, exact: true }).click();
  await links.waitFor();
  await page.getByRole('button', { name: 'Link risks', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: `Link risks to ${linked.code}`, exact: true });
  for (const r of linked.risks) {
    await dialog.getByRole('checkbox', { name: `${r.code} ${r.title}`, exact: true }).waitFor();
    assert.equal(await dialog.getByRole('checkbox', { name: `${r.code} ${r.title}`, exact: true }).isChecked(), true);
  }
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  console.log('PASS live risk names/ratings, preselected IDs, and two-way navigation');

  const id = randomUUID();
  const risks = Array.from({ length: 51 }, (_, i) => ({ id: randomUUID(), code: `R-TEST-${String(i + 1).padStart(3, '0')}`, title: `Synthetic payment approval risk ${i + 1}`, rating: 'MEDIUM' }));
  let current = { ...detail, id, code: 'C-TEST', title: 'Synthetic linked-risk verification', risks: [risks[0], risks[50]], tests: [] };
  let failDirectory = false;
  let failSave = false;
  const saved = [];
  await page.route(`**/api/v1/controls/${id}`, (route) => route.fulfill({ json: current }));
  await page.route(`**/api/v1/controls/${id}/risks`, (route) => {
    assert.equal(route.request().method(), 'PUT');
    if (failSave) return route.fulfill({ status: 503, json: { message: 'Synthetic save failure. Please retry.' } });
    const { riskIds } = route.request().postDataJSON();
    assert.ok(riskIds.every((riskId) => risks.some((r) => r.id === riskId)), 'Only actual risk IDs may be saved');
    saved.push(riskIds);
    current = { ...current, risks: risks.filter((r) => riskIds.includes(r.id)) };
    return route.fulfill({ json: current });
  });
  await page.route(/\/api\/v1\/risks(?:\?.*)?$/, (route) => {
    if (failDirectory) return route.fulfill({ status: 503, json: { message: 'Synthetic risk directory unavailable' } });
    const params = new URL(route.request().url()).searchParams;
    const matches = risks.filter((r) => `${r.code} ${r.title}`.toLowerCase().includes((params.get('q') ?? '').toLowerCase()));
    const pageNumber = Number(params.get('page') ?? 1);
    return route.fulfill({ json: { items: matches.slice((pageNumber - 1) * 50, pageNumber * 50), total: matches.length, page: pageNumber, pageSize: 50 } });
  });

  await page.goto(`/controls?control=${id}`, navigation);
  await page.getByRole('button', { name: 'Link risks', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Link risks to C-TEST', exact: true });
  const checkbox = (i) => dialog.getByRole('checkbox', { name: `${risks[i].code} ${risks[i].title}`, exact: true });
  await checkbox(0).waitFor();
  assert.ok(await checkbox(0).isChecked());
  await dialog.getByText('2 selected', { exact: true }).waitFor();
  await checkbox(1).check();
  await dialog.getByRole('button', { name: 'Next page of risks', exact: true }).click();
  await checkbox(50).waitFor();
  assert.ok(await checkbox(50).isChecked());
  await dialog.getByLabel('Search risks', { exact: true }).fill(risks[2].code);
  await checkbox(2).check();
  await dialog.getByText('4 selected', { exact: true }).waitFor();
  failSave = true;
  await dialog.getByRole('button', { name: 'Save links', exact: true }).click();
  await page.getByText('Synthetic save failure. Please retry.', { exact: true }).waitFor();
  assert.ok(await checkbox(2).isChecked());
  await dialog.getByText('4 selected', { exact: true }).waitFor();
  failSave = false;
  await dialog.getByRole('button', { name: 'Save links', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(saved[0].sort(), [risks[0].id, risks[1].id, risks[2].id, risks[50].id].sort());
  await page.getByRole('heading', { name: 'Linked risks (4)', exact: true }).waitFor();
  console.log('PASS preserved off-page and off-search links, add/save, and failed-save retry without lost selections');

  await page.getByRole('button', { name: 'Link risks', exact: true }).click();
  await dialog.getByLabel('Search risks', { exact: true }).fill('not-a-real-risk');
  await dialog.getByText('No risks found', { exact: true }).waitFor();
  await dialog.getByText('4 selected', { exact: true }).waitFor();
  failDirectory = true;
  await dialog.getByLabel('Search risks', { exact: true }).fill('failure-case');
  await dialog.getByText('Could not load risks', { exact: true }).waitFor();
  assert.ok(await dialog.getByRole('button', { name: 'Save links', exact: true }).isDisabled());
  failDirectory = false;
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await dialog.getByText('No risks found', { exact: true }).waitFor();
  await dialog.getByLabel('Search risks', { exact: true }).fill('');
  await checkbox(0).waitFor();
  assert.ok(await checkbox(0).isChecked());
  await checkbox(0).uncheck();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Link risks', exact: true }).click();
  await checkbox(0).waitFor();
  assert.ok(await checkbox(0).isChecked(), 'Cancel must discard unsaved changes');
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole('button', { name: 'Save links', exact: true }).scrollIntoViewIfNeeded();
  for (const name of ['Save links', 'Cancel']) {
    const bounds = await dialog.getByRole('button', { name, exact: true }).boundingBox();
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 844, `${name} must fit in the mobile viewport`);
  }
  await assertFits(page);
  await page.screenshot({ path: join(output, 'link-dialog-mobile.png') });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.screenshot({ path: join(output, 'linked-risks-mobile.png') });
  console.log('PASS empty search, directory error/retry, cancel/reset and mobile dialog');

  const readPage = await reader.newPage();
  readPage.setDefaultTimeout(45000);
  readPage.on('pageerror', (error) => errors.push(error.message));
  await readPage.goto(`/controls?control=${linked.id}`, navigation);
  await readPage.getByRole('list', { name: 'Linked risks', exact: true }).getByRole('link').first().waitFor();
  assert.equal(await readPage.getByRole('button', { name: 'Link risks', exact: true }).count(), 0);
  await assertFits(readPage);
  await readPage.screenshot({ path: join(output, 'linked-risks-readonly.png') });
  const unchanged = await get(admin, `/api/v1/controls/${linked.id}`);
  assert.deepEqual(unchanged.risks, linked.risks, 'Live risk-control assignments must remain unchanged');
  assert.deepEqual(errors, [], 'Browser errors');
  console.log('PASS read-only access and unchanged live assignments; no browser errors');
} catch (error) {
  console.error('Browser URL:', page.url());
  console.error('Browser errors:', errors);
  console.error((await page.locator('body').innerText()).slice(0, 6000));
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  for (const context of [admin, reader]) {
    await context.request.post('/api/v1/auth/logout').catch(() => {});
    await context.close();
  }
  await browser.close();
}
