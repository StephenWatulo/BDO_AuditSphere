import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepperStep {
  key: string;
  label: string;
}

/**
 * Horizontal stage stepper. Stages before the current one are complete, the
 * current one is highlighted, the rest are pending. `terminalKeys` renders as
 * a final state without the "in progress" styling.
 */
export function StageStepper({
  steps,
  current,
  terminalKeys = [],
  className,
  compact,
}: {
  steps: readonly StepperStep[];
  current: string;
  terminalKeys?: readonly string[];
  className?: string;
  compact?: boolean;
}) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.key === current),
  );
  const isTerminal = terminalKeys.includes(current);
  return (
    <ol className={cn('flex w-full items-start overflow-x-auto', className)} aria-label="Lifecycle stages">
      {steps.map((step, i) => {
        const done = i < currentIndex || (isTerminal && i === currentIndex);
        const active = i === currentIndex && !isTerminal;
        const last = i === steps.length - 1;
        return (
          <li
            key={step.key}
            className={cn('relative flex min-w-0 flex-1 flex-col items-center', compact ? 'gap-1' : 'gap-1.5')}
            aria-current={active ? 'step' : undefined}
          >
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-1/2 top-3 h-0.5 w-full',
                  compact && 'top-2.5',
                  i < currentIndex ? 'bg-primary' : 'bg-border',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative z-[1] flex items-center justify-center rounded-full border-2 bg-card text-2xs font-semibold',
                compact ? 'size-5' : 'size-6',
                done && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary text-primary ring-4 ring-primary/15',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className={compact ? 'size-3' : 'size-3.5'} /> : i + 1}
            </span>
            <span
              className={cn(
                'max-w-full truncate px-1 text-center',
                compact ? 'text-2xs' : 'text-xs',
                active ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground',
              )}
              title={step.label}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
