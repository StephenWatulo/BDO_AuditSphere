import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditContextService } from './audit-context.service';
import { AiFeature } from './ai.dto';
import { AiService } from './ai.service';
import { AuthUser } from '../auth/auth.types';

const user = (permissions: string[]): AuthUser => ({ id: 'user-1', tenantId: 'tenant-1', permissions, roles: [] } as unknown as AuthUser);
const all = user(['ai:use', 'universe:read', 'risk:read', 'control:read', 'engagement:read', 'workpaper:read', 'finding:read', 'document:read', 'monitoring:read']);
function setup() {
  const models = ['auditEntity', 'process', 'risk', 'control', 'engagement', 'workpaper', 'finding', 'evidence', 'document', 'auditProgramStep', 'controlTest', 'riskControl', 'comment', 'riskSignal', 'scoringModel', 'recommendation', 'reviewNote'];
  const db = Object.fromEntries(models.map((name) => [name, { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), groupBy: jest.fn().mockResolvedValue([]) }]));
  const scoped = jest.fn(() => db);
  return { db, scoped, service: new AuditContextService({ scoped } as never, { tenantId: 'tenant-1' } as never) };
}
const dto = { feature: AiFeature.QualityCheck, prompt: 'Review quality.' };

describe('Audit context access and retrieval', () => {
  it('indexes with stable ID cursors, nested tenant guards and private-document filters', async () => {
    const { service, db } = setup();
    await service.fetch('Control', { index: true, afterId: 'cursor', take: 250 }, all);
    expect(db.control.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { gt: 'cursor' }, deletedAt: null }), orderBy: { id: 'asc' }, take: 250, select: expect.objectContaining({ risks: { where: { tenantId: 'tenant-1', risk: { tenantId: 'tenant-1', deletedAt: null } }, select: { riskId: true } } }) }));
    await service.fetch('ActionPlan', { index: true }, all);
    expect(db.recommendation.findMany.mock.calls[0][0].where.finding).toEqual({ tenantId: 'tenant-1', deletedAt: null, engagement: { tenantId: 'tenant-1', deletedAt: null } });
    await service.fetch('Document', { index: true }, all);
    expect(db.document.findMany.mock.calls[0][0].where).toMatchObject({ deletedAt: null, classification: { not: 'RESTRICTED' }, isQuarantined: false, OR: expect.arrayContaining([{ ownerType: 'AiContext', ownerId: 'user-1', uploadedById: 'user-1' }]) });
    await service.fetch('Comment', { index: true }, user(['ai:use', 'finding:read']));
    expect(db.comment.findMany.mock.calls[0][0].where).toMatchObject({ isInternal: false, targetType: { in: ['Finding'] } });
  });
  it('denies historical search aggregates when previously covered module permissions are revoked', async () => {
    const { service } = setup();
    const context = { records: [], links: [], warnings: [], search: { intelligence: { restrictedKinds: [] } } };
    await expect(service.assertSnapshotAccess(context as never, user(['ai:use', 'control:read']))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects incomplete, unsupported and forbidden targets before reading target records', async () => {
    const { service, scoped } = setup();
    await expect(service.build({ ...dto, targetType: 'Control' }, [], all)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.build({ ...dto, targetType: 'User', targetId: 'id' }, [], all)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.build({ ...dto, targetType: 'Finding', targetId: 'id' }, [], user(['ai:use']))).rejects.toBeInstanceOf(ForbiddenException);
    expect(scoped).not.toHaveBeenCalled();
  });
  it('uses only the scoped client and refuses unavailable targets', async () => {
    const { service, db, scoped } = setup();
    await expect(service.build({ ...dto, targetType: 'Control', targetId: 'other-tenant-id' }, [], all)).rejects.toBeInstanceOf(NotFoundException);
    expect(scoped).toHaveBeenCalled();
    expect(db.control.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['other-tenant-id'] }, deletedAt: null }), select: expect.any(Object) }));
  });
  it('does not traverse modules without their read permission', async () => {
    const { service, db } = setup();
    db.control.findMany.mockResolvedValue([{ id: 'c1', title: 'Approval', processId: 'p1' }]);
    const context = await service.build({ ...dto, targetType: 'Control', targetId: 'c1' }, [], user(['ai:use', 'control:read']));
    expect(db.process.findMany).not.toHaveBeenCalled(); expect(db.finding.findMany).not.toHaveBeenCalled(); expect(db.workpaper.findMany).not.toHaveBeenCalled(); expect(db.riskControl.findMany).not.toHaveBeenCalled();
    expect(context.warnings.join(' ')).toContain('permission');
  });
  it('filters document privacy independently of evidence search text', async () => {
    const { service, db } = setup();
    await service.build({ ...dto, feature: AiFeature.NaturalLanguageSearch, prompt: 'Which suppliers had approval exceptions?' }, [], all);
    const where = db.evidence.findMany.mock.calls[0][0].where;
    const document = where.AND[0].OR[1].document;
    expect(document).toMatchObject({ tenantId: 'tenant-1', deletedAt: null, uploadedAt: { not: null }, isQuarantined: false, classification: { not: 'RESTRICTED' }, OR: expect.arrayContaining([{ ownerType: 'AiContext', ownerId: 'user-1', uploadedById: 'user-1' }]) });
    const nested = where.AND[1].OR[2].document.AND;
    expect(nested[0]).toEqual(document); expect(nested[1].OR).toBeDefined();
  });
  it('filters control tests by actual test date and exception count', async () => {
    const { service, db } = setup();
    await service.build({ ...dto, feature: AiFeature.NaturalLanguageSearch, prompt: 'Show procurement controls tested in 2026 with exceptions' }, [], all);
    const where = db.control.findMany.mock.calls[0][0].where;
    expect(where.tests.some).toMatchObject({ tenantId: 'tenant-1', exceptions: { gt: 0 }, testedAt: { gte: new Date('2026-01-01'), lt: new Date('2027-01-01') } });
    expect(where.AND[0].OR[0].title.contains).toBe('procur');
  });
  it('retrieves matching comments only after verifying their parent permission and existence', async () => {
    const { service, db } = setup();
    db.comment.findMany.mockResolvedValue([{ id: 'comment-1', targetType: 'Finding', targetId: 'f1', body: 'Supplier approval exception', isInternal: false }]);
    db.finding.findMany.mockImplementation(async (q) => q.where.id ? [{ id: 'f1', title: 'Approval gap' }] : []);
    const context = await service.build({ ...dto, feature: AiFeature.NaturalLanguageSearch, prompt: 'Which suppliers had approval exceptions?' }, [], user(['ai:use', 'finding:read']));
    expect(db.comment.findMany.mock.calls[0][0].where.isInternal).toBe(false);
    expect(context.search!.results.some((r) => context.records.find((s) => s.source.id === r.sourceId)?.source.kind === 'Comment')).toBe(true);
    db.finding.findMany.mockClear();
    const limited = await service.build({ ...dto, feature: AiFeature.NaturalLanguageSearch, prompt: 'supplier approval' }, [], user(['ai:use']));
    expect(db.finding.findMany).not.toHaveBeenCalled(); expect(limited.records.some((r) => r.source.kind === 'Comment')).toBe(false);
  });
  it('loads control workpapers even when no control-test record exists', async () => {
    const { service, db } = setup();
    db.control.findMany.mockResolvedValue([{ id: 'c1', title: 'Approval' }]);
    db.workpaper.findMany.mockResolvedValue([{ id: 'w1', title: 'Approval test', controlId: 'c1' }]);
    const context = await service.build({ ...dto, targetType: 'Control', targetId: 'c1' }, [], all);
    expect(context.records.map((r) => r.source.kind)).toEqual(expect.arrayContaining(['Control', 'Workpaper']));
    expect(context.links.some((l) => l.relationship === 'control')).toBe(true);
  });
  it('reserves exact aggregate counts before bounded engagement details', async () => {
    const { service, db } = setup();
    db.engagement.findMany.mockResolvedValue([{ id: 'e1', title: 'Audit' }]);
    db.finding.groupBy.mockResolvedValue([{ severity: 'HIGH', status: 'DRAFT', _count: { _all: 103 } }]);
    const context = await service.build({ ...dto, targetType: 'Engagement', targetId: 'e1' }, [], all);
    expect(context.records[1]).toMatchObject({ source: { kind: 'Metrics' }, fields: { counts: [{ severity: 'HIGH', status: 'DRAFT', count: 103 }] } });
  });
  it('rechecks historical sources after permissions, classification or availability change', async () => {
    const { service, db } = setup();
    const context = { records: [{ source: { id: 'S1', kind: 'Document' as const, recordId: 'd1', label: 'Source', excerpt: '', truncated: false }, fields: {} }], links: [], warnings: [] };
    await expect(service.assertSnapshotAccess(context, user(['ai:use']))).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.document.findMany).not.toHaveBeenCalled();
    await expect(service.assertSnapshotAccess(context, all)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.document.findMany.mock.calls[0][0].where.classification).toEqual({ not: 'RESTRICTED' });
  });
});

describe('AI interaction history privacy', () => {
  it('validates legacy document snapshots and requester ownership', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'i1', request: { ...dto, documents: [{ documentId: 'legacy-d1' }] }, response: {} });
    const resolve = jest.fn().mockRejectedValue(new ForbiddenException('Restricted document'));
    const service = new AiService({ scoped: () => ({ aiInteraction: { findFirst } }) } as never, {} as never, {} as never, {} as never, { resolve } as never, {} as never, {} as never);
    await expect(service.get('i1', all)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'i1', userId: 'user-1' } });
    expect(resolve).toHaveBeenCalledWith(['legacy-d1']);
  });
});
