import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ObjectAccessService } from './object-access.service';

function harness(roles: string[], permissions: string[] = []) {
  const db = {
    engagement: { count: jest.fn().mockResolvedValue(1) },
    finding: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
    documentRequest: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
    recommendation: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    document: { count: jest.fn().mockResolvedValue(1) },
    workpaper: { count: jest.fn().mockResolvedValue(1) },
    evidence: { count: jest.fn().mockResolvedValue(1) },
    libraryItem: { count: jest.fn().mockResolvedValue(1) },
  };
  const ctx = {
    roles,
    permissions,
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.com',
    hasPermission: (...keys: string[]) => keys.some((key) => permissions.includes(key)),
  };
  return { service: new ObjectAccessService({ scoped: () => db } as never, ctx as never), db };
}

describe('ObjectAccessService', () => {
  it('scopes business owners but not audit-function or committee users', () => {
    expect(harness(['BUSINESS_OWNER']).service.isPortalScoped).toBe(true);
    expect(harness(['MANAGEMENT_REVIEWER']).service.isPortalScoped).toBe(true);
    expect(harness(['JUNIOR_AUDITOR']).service.isPortalScoped).toBe(false);
    expect(harness(['AUDIT_COMMITTEE_VIEWER']).service.isPortalScoped).toBe(false);
  });

  it('builds engagement scope from explicit participation, requests and findings', () => {
    const scope = harness(['BUSINESS_OWNER']).service.engagementScope();
    expect(scope.OR).toEqual(expect.arrayContaining([
      { members: { some: { userId: '11111111-1111-4111-8111-111111111111' } } },
      expect.objectContaining({ requests: expect.any(Object) }),
      expect.objectContaining({ findings: expect.any(Object) }),
    ]));
  });

  it('returns not found when a portal user enumerates another engagement', async () => {
    const { service, db } = harness(['BUSINESS_OWNER'], ['engagement:read']);
    db.engagement.count.mockResolvedValue(0);
    await expect(service.assertEngagement('22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.engagement.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: expect.any(Array) }) }));
  });

  it('blocks portal uploads to generic engagement and workpaper owners', async () => {
    const { service } = harness(['BUSINESS_OWNER'], ['document:upload', 'engagement:read']);
    await expect(service.assertUploadOwner('Engagement', '22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertUploadOwner('Workpaper', '22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the permission belonging to a comment target', async () => {
    const { service } = harness(['JUNIOR_AUDITOR'], ['finding:read']);
    await expect(service.assertCommentTarget('Workpaper', '22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertCommentTarget('Unknown', '22222222-2222-4222-8222-222222222222')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
