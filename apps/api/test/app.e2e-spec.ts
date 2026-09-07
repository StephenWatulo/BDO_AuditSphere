/**
 * End-to-end suite. Requires a seeded Postgres (`pnpm db:deploy && pnpm db:seed`)
 * reachable through DATABASE_URL. When the variable is not exported, the root
 * `.env` is loaded the same way the API does at boot; if it is still missing the
 * whole file is skipped with a visible warning.
 *
 * Seed contract (packages/db/prisma/seed.ts): tenant slug `bdo-ea` with
 * admin@bdo-ea.com / Admin123! holding GLOBAL_ADMIN.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import request from 'supertest';
import { apiRoot, repoRoot } from '../src/config/repo-root';

// Jest gives each test file its own copy of process.env, so process.loadEnvFile
// would populate the wrong object. Parse and assign explicitly; values already
// in the environment win, matching dotenv semantics.
if (!process.env.DATABASE_URL) {
  for (const envFile of [join(apiRoot(), '.env'), join(repoRoot(), '.env')]) {
    if (!existsSync(envFile)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
      process.env[key] ??= value;
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('[e2e] DATABASE_URL is not set and no .env was found; skipping the API e2e suite.');
}
const describeIf = DATABASE_URL ? describe : describe.skip;

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret-at-least-32-characters-long';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? '0123456789abcdef'.repeat(4);
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? 'local';
process.env.RUN_JOBS = 'false';
process.env.SMTP_HOST = '';

const ADMIN = { email: 'admin@bdo-ea.com', password: 'Admin123!' };
const stamp = Date.now().toString(36).toUpperCase();

describeIf('AuditSphere API (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let entityId: string;
  let engagementId: string;
  let workpaperId: string;
  let findingId: string;

  beforeAll(async () => {
    // Imported lazily so the env defaults above are in place before config validation.
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureApp(app);
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health is public and carries x-request-id', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('rejects unauthenticated access with the contract error shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/engagements').expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized', requestId: expect.any(String) });
  });

  it('logs in the seeded admin and sets cookies', async () => {
    const res = await agent.post('/api/v1/auth/login').send(ADMIN).expect(200);
    expect(res.body.user.email).toBe(ADMIN.email);
    expect(res.body.user.permissions).toContain('engagement:create');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('as_access='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('as_refresh='))).toBe(true);
  });

  it('GET /auth/me returns the user', async () => {
    const res = await agent.get('/api/v1/auth/me').expect(200);
    expect(res.body.user.tenant.slug).toBe('bdo-ea');
  });

  it('creates a universe entity', async () => {
    const res = await agent
      .post('/api/v1/universe/entities')
      .send({ type: 'BUSINESS_UNIT', code: `E2E-${stamp}`, name: `E2E Entity ${stamp}`, country: 'KE', riskRating: 'HIGH', auditFrequencyMonths: 12 })
      .expect(201);
    entityId = res.body.id;
    expect(res.body.code).toBe(`E2E-${stamp}`);
  });

  it('creates an engagement with a generated audit number', async () => {
    const res = await agent
      .post('/api/v1/engagements')
      .send({ title: `E2E Engagement ${stamp}`, type: 'OPERATIONAL', entityId, objectives: 'Test objectives', scope: 'Test scope' })
      .expect(201);
    engagementId = res.body.id;
    expect(res.body.auditNumber).toMatch(/^IA-\d{4}-\d{3,}$/);
    const detail = await agent.get(`/api/v1/engagements/${engagementId}`).expect(200);
    expect(detail.body.availableActions.some((a: { action: string }) => a.action === 'start_risk_assessment')).toBe(true);
  });

  it('creates a workpaper, edits it (versioned) and marks it prepared', async () => {
    const created = await agent.post(`/api/v1/engagements/${engagementId}/workpapers`).send({ reference: 'A.1', title: 'Walkthrough' }).expect(201);
    workpaperId = created.body.id;
    expect(created.body.status).toBe('DRAFT');

    const blocked = await agent.post(`/api/v1/workpapers/${workpaperId}/transition`).send({ action: 'mark_prepared' }).expect(422);
    expect(blocked.body.guards[0].guard).toBe('has_procedure_and_conclusion');

    const patched = await agent.patch(`/api/v1/workpapers/${workpaperId}`).send({ procedure: 'Inspect', conclusion: 'No exceptions' }).expect(200);
    expect(patched.body.currentVersion).toBe(2);
    const v1 = await agent.get(`/api/v1/workpapers/${workpaperId}/versions/1`).expect(200);
    expect(v1.body.snapshot.procedure).toBeNull();

    const prepared = await agent.post(`/api/v1/workpapers/${workpaperId}/transition`).send({ action: 'mark_prepared' }).expect(201);
    expect(prepared.body.status).toBe('PREPARED');
  });

  it('enforces segregation of duties on review', async () => {
    const res = await agent.post(`/api/v1/workpapers/${workpaperId}/transition`).send({ action: 'start_review' }).expect(422);
    expect(res.body.guards.map((g: { guard: string }) => g.guard)).toContain('reviewer_is_not_preparer');
  });

  it('creates a finding, submits it and fails the agree guard without a response', async () => {
    const created = await agent
      .post('/api/v1/findings')
      .send({
        engagementId,
        title: 'Missing approvals',
        severity: 'HIGH',
        condition: 'Payments approved after posting',
        criteria: 'Policy requires pre-approval',
        recommendation: 'Enforce workflow approval',
        workpaperId,
      })
      .expect(201);
    findingId = created.body.id;
    expect(created.body.reference).toMatch(/^F-\d{2,}$/);

    const submitted = await agent.post(`/api/v1/findings/${findingId}/transition`).send({ action: 'submit' }).expect(201);
    expect(submitted.body.status).toBe('MANAGEMENT_REVIEW');

    const agree = await agent.post(`/api/v1/findings/${findingId}/transition`).send({ action: 'agree' }).expect(422);
    expect(agree.body.statusCode).toBe(422);
    const guards = agree.body.guards.map((g: { guard: string }) => g.guard);
    expect(guards).toContain('has_management_response');
    expect(guards).toContain('has_action_owner_and_due_date');
  });

  it('lists findings with ageing fields and the audit trail records the mutations', async () => {
    const list = await agent.get(`/api/v1/findings?engagementId=${engagementId}`).expect(200);
    expect(list.body.items[0]).toMatchObject({ id: findingId, ageingBucket: 'NOT_DUE', daysOverdue: 0 });
    const trail = await agent.get(`/api/v1/audit-trail?targetType=Finding&targetId=${findingId}`).expect(200);
    expect(trail.body.items.map((r: { action: string }) => r.action)).toEqual(expect.arrayContaining(['finding.created', 'finding.status_changed']));
  });

  // -------------------------------------------------------------------------
  // Client portal: a provisioned business owner responds to requests and findings
  // -------------------------------------------------------------------------

  const OWNER = { email: 'owner@client.example', password: 'Admin123!' };
  let owner: ReturnType<typeof request.agent>;
  let ownerId: string;
  let requestId: string;
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString();

  it('business owner sees only their own requests and findings through mine=true', async () => {
    owner = request.agent(app.getHttpServer());
    const login = await owner.post('/api/v1/auth/login').send(OWNER).expect(200);
    ownerId = login.body.user.id;
    expect(login.body.user.permissions).toEqual(expect.arrayContaining(['request:respond', 'finding:respond']));
    expect(login.body.user.permissions).not.toContain('request:manage');

    const created = await agent
      .post('/api/v1/requests')
      .send({ engagementId, title: `E2E portal request ${stamp}`, assigneeId: ownerId, dueDate: nextWeek })
      .expect(201);
    requestId = created.body.id;
    expect(created.body.reference).toMatch(/^DR-\d{2,}$/);

    const mine = await owner.get('/api/v1/requests?mine=true&pageSize=200').expect(200);
    expect(mine.body.items.some((r: { id: string }) => r.id === requestId)).toBe(true);
    for (const r of mine.body.items as { assigneeId: string | null; assigneeEmail: string | null }[]) {
      expect(r.assigneeId === ownerId || r.assigneeEmail?.toLowerCase() === OWNER.email).toBe(true);
    }

    await agent.patch(`/api/v1/findings/${findingId}`).send({ actionOwnerId: ownerId }).expect(200);
    const findings = await owner.get('/api/v1/findings?mine=true&pageSize=200').expect(200);
    expect(findings.body.items.some((f: { id: string }) => f.id === findingId)).toBe(true);
  });

  it('business owner may only edit the response note, then submits the request', async () => {
    const blocked = await owner.post(`/api/v1/requests/${requestId}/transition`).send({ action: 'submit' }).expect(422);
    expect(blocked.body.guards[0].guard).toBe('has_attachment_or_response');

    await owner.patch(`/api/v1/requests/${requestId}`).send({ title: 'Renamed by the business' }).expect(403);
    const noted = await owner.patch(`/api/v1/requests/${requestId}`).send({ responseNote: 'Attached the signed matrix.' }).expect(200);
    expect(noted.body.responseNote).toBe('Attached the signed matrix.');

    const submitted = await owner.post(`/api/v1/requests/${requestId}/transition`).send({ action: 'submit' }).expect(201);
    expect(submitted.body.status).toBe('SUBMITTED');
    expect(submitted.body.submittedAt).toBeTruthy();
    // Only the audit team can accept.
    expect(submitted.body.availableActions.filter((a: { allowed?: boolean }) => a.allowed !== false)).toHaveLength(0);
  });

  it('business owner provides the management response and agrees the finding', async () => {
    await owner.patch(`/api/v1/findings/${findingId}`).send({ condition: 'Tampered' }).expect(403);
    const responded = await owner
      .patch(`/api/v1/findings/${findingId}`)
      .send({ managementResponse: 'Agreed. Workflow approval will be enforced from next month.', dueDate: nextWeek })
      .expect(200);
    expect(responded.body.managementResponse).toContain('Agreed');

    const agreed = await owner.post(`/api/v1/findings/${findingId}/transition`).send({ action: 'agree' }).expect(201);
    expect(agreed.body.status).toBe('AGREED');
    expect(agreed.body.agreedAt).toBeTruthy();

    const started = await owner.post(`/api/v1/findings/${findingId}/transition`).send({ action: 'start_implementation' }).expect(201);
    expect(started.body.status).toBe('IMPLEMENTATION');

    const needsEvidence = await owner.post(`/api/v1/findings/${findingId}/transition`).send({ action: 'request_validation' }).expect(422);
    expect(needsEvidence.body.guards.map((g: { guard: string }) => g.guard)).toContain('has_implementation_evidence');
  });

  it('refreshes the session and logs out', async () => {
    await agent.post('/api/v1/auth/refresh').expect(200);
    await agent.post('/api/v1/auth/logout').expect(204);
    await agent.post('/api/v1/auth/refresh').expect(401);
  });
});
