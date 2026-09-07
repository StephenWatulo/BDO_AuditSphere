import { ForbiddenException } from '@nestjs/common';
import { AiContextService } from './ai-context.service';

describe('AI context access', () => {
  const doc = { id: 'doc-1', ownerType: 'AiContext', ownerId: 'user-1', uploadedById: 'user-1', fileName: 'policy.txt', extractedText: 'Approval threshold is 5000.', tags: [] };
  const documents = { assertDocument: jest.fn(), upload: jest.fn() };
  const extractor = { extract: jest.fn() };
  const ctx = { userId: 'user-1', hasPermission: jest.fn<boolean, [string]>(() => true) };
  const database = { document: { findMany: jest.fn().mockResolvedValue([]) } };
  const service = new AiContextService(documents as never, extractor as never, { scoped: () => database } as never, ctx as never, {} as never);
  beforeEach(() => { jest.clearAllMocks(); ctx.hasPermission.mockReturnValue(true); documents.assertDocument.mockResolvedValue(doc); });

  it('uses only verified, completed uploads', async () => {
    expect(await service.resolve(['doc-1'])).toEqual([{ documentId: 'doc-1', fileName: 'policy.txt', text: 'Approval threshold is 5000.', truncated: false }]);
    expect(documents.assertDocument).toHaveBeenCalledWith('doc-1', { requireUploaded: true });
  });
  it('allows omitted and null optional context lists', async () => {
    expect(await service.resolve()).toEqual([]);
    expect(await service.resolve(null)).toEqual([]);
    expect(documents.assertDocument).not.toHaveBeenCalled();
  });
  it('checks upload and classification permissions before parsing', async () => {
    ctx.hasPermission.mockReturnValue(false);
    await expect(service.upload({} as never)).rejects.toBeInstanceOf(ForbiddenException);
    ctx.hasPermission.mockImplementation((permission) => permission !== 'document:restricted');
    await expect(service.upload({} as never, 'RESTRICTED')).rejects.toBeInstanceOf(ForbiddenException);
    expect(extractor.extract).not.toHaveBeenCalled();
  });
  it('refuses another users context and other document owner types', async () => {
    documents.assertDocument.mockResolvedValue({ ...doc, ownerId: 'other-user' });
    await expect(service.resolve(['doc-1'])).rejects.toBeInstanceOf(ForbiddenException);
    documents.assertDocument.mockResolvedValue({ ...doc, ownerType: 'Engagement' });
    await expect(service.resolve(['doc-1'])).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not bypass restricted, quarantined or cross-tenant document checks', async () => {
    documents.assertDocument.mockRejectedValue(new ForbiddenException('Document is quarantined'));
    await expect(service.resolve(['doc-1'])).rejects.toThrow('quarantined');
  });
  it('rejects missing read permission, duplicates and too many sources', async () => {
    ctx.hasPermission.mockReturnValue(false);
    await expect(service.resolve(['doc-1'])).rejects.toBeInstanceOf(ForbiddenException);
    ctx.hasPermission.mockReturnValue(true);
    await expect(service.resolve(['doc-1', 'doc-1'])).rejects.toThrow('five different');
    await expect(service.resolve(['1', '2', '3', '4', '5', '6'])).rejects.toThrow('five different');
  });
  it('lists only the current users uploaded, unquarantined context', async () => {
    await service.list();
    expect(database.document.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerType: 'AiContext', ownerId: 'user-1', uploadedById: 'user-1', deletedAt: null, isQuarantined: false, uploadedAt: { not: null } }) }));
  });
  it('never stores a document that failed extraction', async () => {
    extractor.extract.mockRejectedValue(new Error('Unreadable document'));
    await expect(service.upload({} as never)).rejects.toThrow('Unreadable');
    expect(documents.upload).not.toHaveBeenCalled();
  });
});
