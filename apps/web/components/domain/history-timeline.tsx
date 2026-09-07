import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { UserAvatar } from '@/components/ui/avatar';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UserRef } from '@/lib/types';

export interface TimelineEntry {
  id: string;
  from?: string | null;
  to: string;
  actor?: UserRef | null;
  comment?: string | null;
  at: string;
}

export function HistoryTimeline({
  entries,
  labelFor,
  className,
  emptyText = 'No history yet.',
}: {
  entries: TimelineEntry[];
  labelFor: (key: string) => string;
  className?: string;
  emptyText?: string;
}) {
  if (entries.length === 0) return <p className={cn('text-xs text-muted-foreground', className)}>{emptyText}</p>;
  const sorted = [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <ol className={cn('relative space-y-4 border-l border-border pl-5', className)}>
      {sorted.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[26px] top-1 flex size-3 items-center justify-center rounded-full border-2 border-primary bg-card" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {e.from ? (
              <>
                <span className="text-muted-foreground">{labelFor(e.from)}</span>
                <ArrowRight className="size-3 text-muted-foreground" />
              </>
            ) : null}
            <span className="font-medium">{labelFor(e.to)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {e.actor ? (
              <>
                <UserAvatar name={e.actor.displayName} src={e.actor.avatarUrl} size="xs" />
                <span>{e.actor.displayName}</span>
                <span>·</span>
              </>
            ) : null}
            <span>{fmtDateTime(e.at)}</span>
          </div>
          {e.comment ? <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs">{e.comment}</p> : null}
        </li>
      ))}
    </ol>
  );
}
