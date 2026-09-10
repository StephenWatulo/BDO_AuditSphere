import { ENGAGEMENT_WORKFLOW } from '@auditsphere/shared';
import { GuardRegistry } from '../workflow/guard-registry';
import { WorkflowService } from '../workflow/workflow.service';
import { EngagementsService } from './engagements.service';

describe('Engagement closure', () => {
  const registry = new GuardRegistry();
  const workflow = new WorkflowService(registry);
  const db = { finding: { findMany: jest.fn() } };
  new EngagementsService({ scoped: () => db } as never, {} as never, {} as never, workflow, {} as never, registry, {} as never);
  const actor = { userId: 'manager', permissions: ['engagement:close'] };
  const entity = { id: 'engagement-1' };
  const finding = { status: 'MANAGEMENT_REVIEW', actionOwnerId: 'owner', actionOwnerName: null, actionOwnerEmail: null };
  const close = () => workflow.transition({ machine: ENGAGEMENT_WORKFLOW, current: 'FOLLOW_UP', action: 'close', actor, guardContext: entity });

  beforeEach(() => { jest.clearAllMocks(); db.finding.findMany.mockResolvedValue([finding]); });

  it.each(['MANAGEMENT_REVIEW', 'AGREED', 'IMPLEMENTATION', 'VALIDATION', 'CLOSED', 'RISK_ACCEPTED'])('allows assigned findings at %s', async (status) => {
    db.finding.findMany.mockResolvedValue([{ ...finding, status }]);
    expect((await close()).to).toBe('CLOSED');
  });

  it.each([{ actionOwnerName: 'External owner' }, { actionOwnerEmail: 'owner@example.test' }])('accepts an external owner: %j', async (owner) => {
    db.finding.findMany.mockResolvedValue([{ ...finding, actionOwnerId: null, ...owner }]);
    expect((await close()).to).toBe('CLOSED');
  });

  it('blocks a draft even when assigned', async () => {
    db.finding.findMany.mockResolvedValue([{ ...finding, status: 'DRAFT' }]);
    await expect(close()).rejects.toThrow('must be sent for management review');
  });

  it('blocks an unassigned finding among submitted findings', async () => {
    db.finding.findMany.mockResolvedValue([finding, { ...finding, actionOwnerId: null, actionOwnerName: ' ', actionOwnerEmail: ' ' }]);
    await expect(close()).rejects.toThrow('1 finding(s) still need an action owner');
    const actions = await workflow.availableActions(ENGAGEMENT_WORKFLOW, 'FOLLOW_UP', actor, entity);
    expect(actions[0].allowed).toBe(false);
    expect(actions[0].failedGuards[0].guard).toBe('all_findings_owned_and_submitted');
  });

  it('allows no findings and only queries non-deleted findings for this engagement', async () => {
    db.finding.findMany.mockResolvedValue([]);
    expect((await close()).to).toBe('CLOSED');
    expect(db.finding.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { engagementId: entity.id, deletedAt: null } }));
  });
});
