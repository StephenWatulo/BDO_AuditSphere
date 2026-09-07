import { ConflictException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { WORKPAPER_WORKFLOW } from '@auditsphere/shared';
import { WorkflowGuardException } from '../common/errors';
import { GuardRegistry } from './guard-registry';
import { WorkflowService } from './workflow.service';

interface Wp {
  id: string;
  procedure: string | null;
  conclusion: string | null;
  preparedById: string | null;
  openNotes: number;
}

describe('WorkflowService', () => {
  let registry: GuardRegistry;
  let service: WorkflowService;
  const preparer = { userId: 'u-prep', permissions: ['workpaper:prepare', 'workpaper:review'] };
  const reviewer = { userId: 'u-rev', permissions: ['workpaper:review', 'workpaper:sign_off'] };

  beforeEach(() => {
    registry = new GuardRegistry();
    service = new WorkflowService(registry);
    registry.register<Wp>('workpaper', 'has_procedure_and_conclusion', ({ entity }) => ({
      ok: Boolean(entity.procedure && entity.conclusion),
      message: 'Procedure and conclusion required',
    }));
    registry.register<Wp>('workpaper', 'reviewer_is_not_preparer', ({ entity, actor }) => entity.preparedById !== actor.userId);
    registry.register<Wp>('workpaper', 'signer_is_not_preparer', ({ entity, actor }) => ({ ok: entity.preparedById !== actor.userId, message: 'SoD' }));
    registry.register<Wp>('workpaper', 'all_notes_addressed', async ({ entity }) => entity.openNotes === 0);
    registry.register<Wp>('workpaper', 'no_open_review_notes', async ({ entity }) => entity.openNotes === 0);
  });

  const wp = (over: Partial<Wp> = {}): Wp => ({ id: 'wp1', procedure: 'p', conclusion: 'c', preparedById: 'u-prep', openNotes: 0, ...over });

  it('rejects an action that does not exist from the current state with 409', async () => {
    await expect(
      service.transition({ machine: WORKPAPER_WORKFLOW, current: 'DRAFT', action: 'sign_off', actor: reviewer, guardContext: wp() }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an actor without the transition permission with 403', async () => {
    const actor = { userId: 'x', permissions: ['finding:read'] };
    await expect(
      service.transition({ machine: WORKPAPER_WORKFLOW, current: 'DRAFT', action: 'mark_prepared', actor, guardContext: wp() }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 422 with the contract guard shape when a guard fails', async () => {
    const promise = service.transition({
      machine: WORKPAPER_WORKFLOW,
      current: 'DRAFT',
      action: 'mark_prepared',
      actor: preparer,
      guardContext: wp({ conclusion: null }),
    });
    await expect(promise).rejects.toBeInstanceOf(WorkflowGuardException);
    const err = (await promise.catch((e) => e)) as WorkflowGuardException;
    expect(err.getStatus()).toBe(422);
    expect(err.guards).toEqual([{ guard: 'has_procedure_and_conclusion', message: 'Procedure and conclusion required' }]);
    const body = err.getResponse() as Record<string, unknown>;
    expect(body.guards).toEqual(err.guards);
    expect(body.statusCode).toBe(422);
  });

  it('uses a humanised default message when a boolean guard fails', async () => {
    const err = (await service
      .transition({ machine: WORKPAPER_WORKFLOW, current: 'PREPARED', action: 'start_review', actor: preparer, guardContext: wp() })
      .catch((e) => e)) as WorkflowGuardException;
    expect(err).toBeInstanceOf(WorkflowGuardException);
    expect(err.guards).toEqual([{ guard: 'reviewer_is_not_preparer', message: 'Reviewer is not preparer' }]);
  });

  it('returns the transition when permission and guards pass', async () => {
    const t = await service.transition({ machine: WORKPAPER_WORKFLOW, current: 'REVIEWED', action: 'sign_off', actor: reviewer, guardContext: wp() });
    expect(t.to).toBe('SIGNED_OFF');
    expect(t.permission).toBe('workpaper:sign_off');
  });

  it('enforces segregation of duties by comparing user ids', async () => {
    const preparerWithSignOff = { userId: 'u-prep', permissions: ['workpaper:sign_off'] };
    const err = (await service
      .transition({ machine: WORKPAPER_WORKFLOW, current: 'REVIEWED', action: 'sign_off', actor: preparerWithSignOff, guardContext: wp() })
      .catch((e) => e)) as WorkflowGuardException;
    expect(err.guards.map((g) => g.guard)).toEqual(['signer_is_not_preparer']);
  });

  it('evaluates extra guards supplied by the caller', async () => {
    registry.register<Wp>('workpaper', 'custom_extra', () => ({ ok: false, message: 'extra failed' }));
    const err = (await service
      .transition({ machine: WORKPAPER_WORKFLOW, current: 'REVIEWED', action: 'sign_off', actor: reviewer, guardContext: wp(), extraGuards: ['custom_extra'] })
      .catch((e) => e)) as WorkflowGuardException;
    expect(err.guards).toEqual([{ guard: 'custom_extra', message: 'extra failed' }]);
  });

  it('fails loudly when a declared guard is not registered', async () => {
    const empty = new WorkflowService(new GuardRegistry());
    await expect(
      empty.transition({ machine: WORKPAPER_WORKFLOW, current: 'DRAFT', action: 'mark_prepared', actor: preparer, guardContext: wp() }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('lists available actions with permission and guard results', async () => {
    const actions = await service.availableActions(WORKPAPER_WORKFLOW, 'PREPARED', preparer, wp());
    const byAction = Object.fromEntries(actions.map((a) => [a.action, a]));
    expect(byAction.reopen.allowed).toBe(true);
    expect(byAction.start_review.permitted).toBe(true);
    expect(byAction.start_review.allowed).toBe(false);
    expect(byAction.start_review.failedGuards[0].guard).toBe('reviewer_is_not_preparer');
  });

  it('marks actions as not permitted when the actor lacks the permission', async () => {
    const actions = await service.availableActions(WORKPAPER_WORKFLOW, 'REVIEWED', preparer, wp({ preparedById: 'someone-else' }));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ action: 'sign_off', permitted: false, allowed: false, failedGuards: [] });
  });
});
