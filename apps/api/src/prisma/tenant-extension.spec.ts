import { applyTenantScope, createTenantClient, GLOBAL_MODELS, SHARED_MODELS, TENANT_MODELS } from './tenant-extension';

const T = '11111111-1111-4111-8111-111111111111';

describe('applyTenantScope', () => {
  it('injects tenantId into findMany/findFirst/count/aggregate/groupBy where', () => {
    for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']) {
      const out = applyTenantScope('Engagement', op, { where: { stage: 'PLANNING' } }, T);
      expect(out.where).toEqual({ stage: 'PLANNING', tenantId: T });
    }
  });

  it('adds tenantId next to the unique key on findUnique/update/delete', () => {
    expect(applyTenantScope('Finding', 'findUnique', { where: { id: 'f1' } }, T).where).toEqual({ id: 'f1', tenantId: T });
    expect(applyTenantScope('Finding', 'findUniqueOrThrow', { where: { id: 'f1' } }, T).where).toEqual({ id: 'f1', tenantId: T });
    expect(applyTenantScope('Finding', 'update', { where: { id: 'f1' }, data: { title: 'x' } }, T)).toEqual({ where: { id: 'f1', tenantId: T }, data: { title: 'x' } });
    expect(applyTenantScope('Finding', 'delete', { where: { id: 'f1' } }, T).where).toEqual({ id: 'f1', tenantId: T });
  });

  it('scopes updateMany/deleteMany even without a where', () => {
    expect(applyTenantScope('Task', 'deleteMany', undefined, T).where).toEqual({ tenantId: T });
    expect(applyTenantScope('Task', 'updateMany', { data: { status: 'DONE' } }, T).where).toEqual({ tenantId: T });
  });

  it('overrides a caller-supplied tenantId so cross-tenant reads are impossible', () => {
    const out = applyTenantScope('User', 'findMany', { where: { tenantId: 'other' } }, T);
    expect(out.where.tenantId).toBe(T);
  });

  it('sets data.tenantId on create and every createMany row', () => {
    expect(applyTenantScope('Risk', 'create', { data: { code: 'R1' } }, T).data).toEqual({ code: 'R1', tenantId: T });
    expect(applyTenantScope('Risk', 'createMany', { data: [{ code: 'R1' }, { code: 'R2' }] }, T).data).toEqual([
      { code: 'R1', tenantId: T },
      { code: 'R2', tenantId: T },
    ]);
  });

  it('leaves create data alone when the tenant relation is written explicitly', () => {
    const data = { code: 'R1', tenant: { connect: { id: T } } };
    expect(applyTenantScope('Risk', 'create', { data }, T).data).toBe(data);
  });

  it('scopes both where and create on upsert', () => {
    const out = applyTenantScope('Role', 'upsert', { where: { id: 'r' }, update: {}, create: { key: 'AUDIT_MANAGER' } }, T);
    expect(out.where).toEqual({ id: 'r', tenantId: T });
    expect(out.create).toEqual({ key: 'AUDIT_MANAGER', tenantId: T });
    expect(out.update).toEqual({});
  });

  it('reads shared models with OR tenant/null and writes them with tenantId', () => {
    for (const model of SHARED_MODELS) {
      const read = applyTenantScope(model, 'findMany', { where: { status: 'PUBLISHED', AND: { type: 'RISK' } } }, T);
      expect(read.where.AND).toEqual([{ type: 'RISK' }, { OR: [{ tenantId: T }, { tenantId: null }] }]);
      expect(read.where.status).toBe('PUBLISHED');
      expect(applyTenantScope(model, 'create', { data: { name: 'x' } }, T).data).toEqual({ name: 'x', tenantId: T });
    }
  });

  it('never touches global models', () => {
    for (const model of GLOBAL_MODELS) {
      const args = { where: { id: 'x' }, data: { name: 'y' } };
      expect(applyTenantScope(model, 'update', args, T)).toEqual(args);
      expect(applyTenantScope(model, 'create', { data: { name: 'y' } }, T).data).toEqual({ name: 'y' });
    }
  });

  it('covers every model in the schema exactly once', () => {
    const all = [...TENANT_MODELS, ...SHARED_MODELS, ...GLOBAL_MODELS];
    expect(new Set(all).size).toBe(all.length);
    expect(TENANT_MODELS.has('AuditTrail')).toBe(true);
    expect(TENANT_MODELS.has('RefreshToken')).toBe(true);
  });
});

describe('createTenantClient', () => {
  it('registers an $allModels/$allOperations query extension that scopes args', async () => {
    let captured: any;
    const base = { $extends: jest.fn((ext: any) => (captured = ext)) } as any;
    createTenantClient(base, T);
    expect(base.$extends).toHaveBeenCalledTimes(1);
    expect(captured.name).toBe(`tenant:${T}`);
    const query = jest.fn(async (args: any) => args);
    const result = await captured.query.$allModels.$allOperations({ model: 'Workpaper', operation: 'findMany', args: { where: { status: 'DRAFT' } }, query });
    expect(query).toHaveBeenCalledWith({ where: { status: 'DRAFT', tenantId: T } });
    expect(result.where.tenantId).toBe(T);
  });
});
