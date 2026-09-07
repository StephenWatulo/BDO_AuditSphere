import { Injectable } from '@nestjs/common';

export interface WorkflowActor {
  userId: string;
  permissions: readonly string[];
}

export interface GuardContext<E = unknown> {
  entity: E;
  actor: WorkflowActor;
  action: string;
  from: string;
  to: string;
  comment?: string;
}

export interface GuardResult {
  ok: boolean;
  message?: string;
}

export type GuardFn<E = any> = (ctx: GuardContext<E>) => Promise<boolean | GuardResult> | boolean | GuardResult;

/** Turns `all_workpapers_signed_off` into `All workpapers signed off`. */
export function humanizeGuard(name: string): string {
  const s = name.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

@Injectable()
export class GuardRegistry {
  private readonly guards = new Map<string, Map<string, GuardFn>>();

  register<E>(machine: string, guard: string, fn: GuardFn<E>): void {
    let byMachine = this.guards.get(machine);
    if (!byMachine) {
      byMachine = new Map();
      this.guards.set(machine, byMachine);
    }
    byMachine.set(guard, fn as GuardFn);
  }

  get(machine: string, guard: string): GuardFn | undefined {
    return this.guards.get(machine)?.get(guard);
  }

  has(machine: string, guard: string): boolean {
    return this.get(machine, guard) !== undefined;
  }
}
