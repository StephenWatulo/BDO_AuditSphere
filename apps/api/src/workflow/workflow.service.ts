import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { findTransition, StateMachine, Transition } from '@auditsphere/shared';
import { GuardFailure, WorkflowGuardException } from '../common/errors';
import { GuardContext, GuardRegistry, GuardResult, humanizeGuard, WorkflowActor } from './guard-registry';

export interface TransitionInput<S extends string, E> {
  machine: StateMachine<S>;
  entityType?: string;
  current: S;
  action: string;
  actor: WorkflowActor;
  guardContext: E;
  comment?: string;
  /** Guards enforced in addition to those declared on the transition. */
  extraGuards?: string[];
}

export interface AvailableAction {
  action: string;
  label: string;
  to: string;
  permission: string;
  /** Actor holds the required permission. */
  permitted: boolean;
  /** Permitted and every guard passes. */
  allowed: boolean;
  failedGuards: GuardFailure[];
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private readonly registry: GuardRegistry) {}

  /**
   * Validates a transition: it must exist from the current state (409), the actor
   * must hold the permission (403) and every guard must pass (422). Returns the
   * transition so the caller can apply side effects.
   */
  async transition<S extends string, E>(input: TransitionInput<S, E>): Promise<Transition<S>> {
    const { machine, current, action, actor } = input;
    const transition = findTransition(machine, current, action);
    if (!transition) {
      throw new ConflictException(`Action "${action}" is not available from state ${current}`);
    }
    if (!actor.permissions.includes(transition.permission)) {
      throw new ForbiddenException(`Missing permission: ${transition.permission}`);
    }
    const guards = [...(transition.guards ?? []), ...(input.extraGuards ?? [])];
    const failed = await this.evaluate(machine.name, guards, {
      entity: input.guardContext,
      actor,
      action,
      from: transition.from,
      to: transition.to,
      comment: input.comment,
    });
    if (failed.length > 0) {
      throw new WorkflowGuardException(failed, `Cannot ${transition.label.toLowerCase()}: ${failed.map((f) => f.message).join('; ')}`);
    }
    return transition;
  }

  /** Every transition from `current` with permission and guard evaluation results. */
  async availableActions<S extends string, E>(
    machine: StateMachine<S>,
    current: S,
    actor: WorkflowActor,
    entity: E,
    extraGuardsFor?: (t: Transition<S>) => string[],
  ): Promise<AvailableAction[]> {
    const out: AvailableAction[] = [];
    for (const t of machine.transitions.filter((x) => x.from === current)) {
      const permitted = actor.permissions.includes(t.permission);
      const guards = [...(t.guards ?? []), ...(extraGuardsFor?.(t) ?? [])];
      const failedGuards = await this.evaluate(machine.name, guards, {
        entity,
        actor,
        action: t.action,
        from: t.from,
        to: t.to,
      });
      out.push({
        action: t.action,
        label: t.label,
        to: t.to,
        permission: t.permission,
        permitted,
        allowed: permitted && failedGuards.length === 0,
        failedGuards,
      });
    }
    return out;
  }

  private async evaluate(machine: string, guards: string[], ctx: GuardContext): Promise<GuardFailure[]> {
    const failures: GuardFailure[] = [];
    for (const guard of guards) {
      const fn = this.registry.get(machine, guard);
      if (!fn) {
        this.logger.error(`Guard "${guard}" is not registered for machine "${machine}"`);
        throw new InternalServerErrorException(`Workflow guard "${guard}" is not configured`);
      }
      const raw = await fn(ctx);
      const result: GuardResult = typeof raw === 'boolean' ? { ok: raw } : raw;
      if (!result.ok) failures.push({ guard, message: result.message ?? humanizeGuard(guard) });
    }
    return failures;
  }
}
