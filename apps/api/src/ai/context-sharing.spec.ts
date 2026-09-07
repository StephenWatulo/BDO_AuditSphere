import { EvidenceService } from '../evidence/evidence.service';
import { RequestsService } from '../requests/requests.service';

describe('Private AI context cannot be exposed through shared records', () => {
  const db = {
    document: { findFirst: jest.fn().mockResolvedValue({ id: 'private-doc', ownerType: 'AiContext' }) },
    engagement: { findFirst: jest.fn().mockResolvedValue({ id: 'engagement' }) },
    evidence: { findFirst: jest.fn().mockResolvedValue({ id: 'evidence', engagementId: 'engagement' }), create: jest.fn(), update: jest.fn() },
    documentRequest: { findFirst: jest.fn().mockResolvedValue({ id: 'request', status: 'OPEN' }), update: jest.fn() },
  };
  const prisma = { scoped: () => db };
  const evidence = new EvidenceService(prisma as never, {} as never, {} as never);
  const requests = new RequestsService(prisma as never, {} as never, {} as never, {} as never, {} as never, { register: jest.fn() } as never);

  it('blocks attaching private context when creating evidence', async () => {
    await expect(evidence.create({ engagementId: 'engagement', documentId: 'private-doc', description: 'Test' })).rejects.toThrow('Private AI context');
    expect(db.evidence.create).not.toHaveBeenCalled();
  });
  it('blocks attaching private context when updating evidence', async () => {
    await expect(evidence.update('evidence', { documentId: 'private-doc' })).rejects.toThrow('Private AI context');
    expect(db.evidence.update).not.toHaveBeenCalled();
  });
  it('blocks attaching private context through a document request', async () => {
    await expect(requests.linkDocument('request', { documentId: 'private-doc' }, { id: 'user', permissions: ['request:manage'] } as never)).rejects.toThrow('Private AI context');
    expect(db.documentRequest.update).not.toHaveBeenCalled();
  });
});
