import { DocumentsService } from './documents.service';

describe('document visibility and validation', () => {
  const db = { document: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) } };
  const prisma = { scoped: () => db };
  const ctx = { hasPermission: jest.fn(() => false) };
  const service = new DocumentsService(prisma as never, ctx as never, {} as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not let a classification filter override restricted document access', async () => {
    await expect(service.list({ classification: 'RESTRICTED' })).rejects.toThrow('document:restricted');
    expect(db.document.findMany).not.toHaveBeenCalled();
  });

  it('lists only completed, non-quarantined uploads', async () => {
    await service.list({ ownerType: 'Engagement', ownerId: 'engagement' });
    expect(db.document.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ uploadedAt: { not: null }, isQuarantined: false, deletedAt: null, classification: { not: 'RESTRICTED' } }) }));
  });

  it('rejects empty and oversized files before creating upload records', async () => {
    const input = { ownerType: 'Engagement' as const, ownerId: 'engagement' };
    await expect(service.upload({ originalname: 'empty.pdf', mimetype: 'application/pdf', size: 0, buffer: Buffer.alloc(0) }, input)).rejects.toThrow('empty');
    await expect(service.upload({ originalname: 'large.pdf', mimetype: 'application/pdf', size: 51 * 1024 * 1024, buffer: Buffer.from('x') }, input)).rejects.toThrow('50 MB');
  });
});
