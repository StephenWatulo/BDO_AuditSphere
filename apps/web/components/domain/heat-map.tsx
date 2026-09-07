'use client';

import * as React from 'react';
import { heatMapCells, DEFAULT_THRESHOLDS, type Thresholds } from '@auditsphere/shared';
import { cn } from '@/lib/utils';
import type { HeatmapCell, Severity } from '@/lib/types';

const RATING_BG: Record<Severity, string> = {
  LOW: 'bg-success/15 dark:bg-success/20',
  MEDIUM: 'bg-warning/20 dark:bg-warning/25',
  HIGH: 'bg-orange-500/25 dark:bg-orange-500/30',
  CRITICAL: 'bg-destructive/30 dark:bg-destructive/40',
};

const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
const IMPACT_LABELS = ['Insignificant', 'Minor', 'Moderate', 'Major', 'Severe'];

/**
 * 5x5 risk heat map. Rows = likelihood (5 at top), columns = impact.
 * Built from divs (no chart library) so it renders identically in exports.
 */
export function HeatMap({
  cells,
  thresholds = DEFAULT_THRESHOLDS,
  onCellClick,
  highlight,
  className,
  compact,
  showLabels = true,
}: {
  cells?: HeatmapCell[] | null;
  thresholds?: Thresholds;
  onCellClick?: (likelihood: number, impact: number) => void;
  /** Cell to outline, e.g. a single risk's residual position. */
  highlight?: { likelihood: number; impact: number } | null;
  className?: string;
  compact?: boolean;
  showLabels?: boolean;
}) {
  const grid = React.useMemo(() => heatMapCells(thresholds), [thresholds]);
  const countFor = React.useCallback(
    (l: number, i: number) => cells?.find((c) => c.likelihood === l && c.impact === i)?.count ?? 0,
    [cells],
  );
  const max = React.useMemo(() => Math.max(1, ...(cells?.map((c) => c.count) ?? [1])), [cells]);

  return (
    <div className={cn('flex gap-2', className)}>
      {showLabels ? (
        <div className="flex flex-col items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Likelihood
          </span>
        </div>
      ) : null}
      <div className="flex-1">
        <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
          {[5, 4, 3, 2, 1].map((l) => (
            <React.Fragment key={l}>
              <div
                className={cn(
                  'flex items-center justify-end pr-1 text-2xs text-muted-foreground',
                  compact ? 'h-8' : 'h-12',
                )}
                title={LIKELIHOOD_LABELS[l - 1]}
              >
                {showLabels && !compact ? LIKELIHOOD_LABELS[l - 1] : l}
              </div>
              {[1, 2, 3, 4, 5].map((i) => {
                const cell = grid.find((c) => c.likelihood === l && c.impact === i)!;
                const count = countFor(l, i);
                const isHl = highlight?.likelihood === l && highlight?.impact === i;
                const intensity = count ? 0.5 + (count / max) * 0.5 : 0.35;
                const Comp = onCellClick ? 'button' : 'div';
                return (
                  <Comp
                    key={i}
                    type={onCellClick ? 'button' : undefined}
                    onClick={onCellClick ? () => onCellClick(l, i) : undefined}
                    aria-label={`Likelihood ${l}, impact ${i}: ${count} risk${count === 1 ? '' : 's'}, ${cell.rating.toLowerCase()}`}
                    className={cn(
                      'relative flex items-center justify-center rounded-sm border border-transparent text-sm font-semibold tabular-nums transition-all',
                      compact ? 'h-8' : 'h-12',
                      RATING_BG[cell.rating],
                      onCellClick && 'cursor-pointer hover:border-foreground/40 focus-visible:ring-2',
                      isHl && 'border-2 border-foreground ring-2 ring-primary/40',
                    )}
                    style={{ opacity: intensity }}
                  >
                    {count > 0 ? count : <span className="text-2xs text-muted-foreground/70">{cell.score}</span>}
                  </Comp>
                );
              })}
            </React.Fragment>
          ))}
          <div />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="truncate pt-1 text-center text-2xs text-muted-foreground" title={IMPACT_LABELS[i - 1]}>
              {showLabels && !compact ? IMPACT_LABELS[i - 1] : i}
            </div>
          ))}
        </div>
        {showLabels ? (
          <p className="mt-1 text-center text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Impact</p>
        ) : null}
      </div>
    </div>
  );
}

export function HeatMapLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-2xs text-muted-foreground', className)}>
      {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map((r) => (
        <span key={r} className="inline-flex items-center gap-1">
          <span className={cn('size-3 rounded-sm', RATING_BG[r])} />
          {r.charAt(0) + r.slice(1).toLowerCase()}
        </span>
      ))}
    </div>
  );
}
