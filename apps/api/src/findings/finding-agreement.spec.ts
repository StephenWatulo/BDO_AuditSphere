import { FINDING_WORKFLOW } from '@auditsphere/shared';
import { GuardRegistry } from '../workflow/guard-registry';
import { WorkflowService } from '../workflow/workflow.service';
import { FindingsService } from './findings.service';

describe('Finding action-owner and due-date requirements', () => {
  const registry = new GuardRegistry();
  const workflow = new WorkflowService(registry);
  const finding = { id: 'finding-1', status: 'MANAGEMENT_REVIEW', dueDate: null, actionOwnerId: null, actionOwnerName: 'Lydia', actionOwnerEmail: 'owner@example.test', managementResponse: 'Management agrees' };
  const actor = { userId: 'reviewer', permissions: ['finding:respond'] };
  const db = {
    user: { findFirst: jest.fn() },
    finding: { findFirst: jest.fn(), update: jest.fn() },
    engagement: { findFirst: jest.fn().mockResolvedValue({ stage: 'PLANNING' }) },
  };
  const service = new FindingsService({ scoped: () => db } as never, {} as never, { record: jest.fn() } as never, workflow, { notify: jest.fn() } as never, registry);
  const transition = (entity: Record<string, unknown>) => workflow.transition({ machine: FINDING_WORKFLOW, current: 'MANAGEMENT_REVIEW', action: 'agree', actor, guardContext: entity });
  beforeEach(() => { jest.clearAllMocks(); db.finding.findFirst.mockResolvedValue(finding); db.finding.update.mockResolvedValue(finding); db.user.findFirst.mockResolvedValue(null); });

  it('identifies the missing date when an external owner is already recorded', async () => {
    await expect(transition(finding)).rejects.toThrow('A due date is required. The recorded action owner is already sufficient.');
  });
  it.each([
    { actionOwnerId: 'platform-user', actionOwnerName: null, actionOwnerEmail: null },
    { actionOwnerId: null, actionOwnerName: 'External owner', actionOwnerEmail: null },
    { actionOwnerId: null, actionOwnerName: null, actionOwnerEmail: 'owner@example.test' },
  ])('allows agreement with an owner and a date: %j', async (owner) => {
    expect((await transition({ ...finding, ...owner, dueDate: new Date('2026-12-31') })).to).toBe('AGREED');
  });
  it('still blocks missing owners and missing management responses', async () => {
    await expect(transition({ ...finding, actionOwnerName: ' ', actionOwnerEmail: ' ', dueDate: new Date() })).rejects.toThrow('An action owner is required');
    await expect(transition({ ...finding, managementResponse: '', dueDate: new Date() })).rejects.toThrow('A management response is required');
  });
  it('refuses an inactive, deleted or out-of-tenant owner before any write', async () => {
    await expect(service.update('finding-1', { actionOwnerId: 'unavailable' }, { id: actor.userId, permissions: actor.permissions } as never)).rejects.toThrow('active user in this organisation');
    expect(db.user.findFirst).toHaveBeenCalledWith({ where: { id: 'unavailable', status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    expect(db.finding.update).not.toHaveBeenCalled();
  });
  it('saves the chosen date without requiring a platform account for an external owner', async () => {
    await service.update('finding-1', { dueDate: '2026-12-31' }, { id: actor.userId, permissions: actor.permissions } as never);
    expect(db.finding.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dueDate: new Date('2026-12-31') }) }));
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
});
