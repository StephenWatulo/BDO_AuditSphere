'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FindingStatusBadge, RequestStatusBadge, SeverityBadge } from '@/components/domain/badges';
import { fmtDate, fmtDueIn, isOverdue } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DocumentRequest, FindingSummary } from '@/lib/types';
import { FINDING_CLOSED_STATUSES, findingNeedsAction, findingNextStep, requestNeedsAction, requestNextStep } from './portal-links';

const CARD =
  'surface group block p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function DueLine({ dueDate, active, className }: { dueDate?: string | null; active: boolean; className?: string }) {
  if (!dueDate) return <span className={cn('text-xs text-muted-foreground', className)}>No due date</span>;
  const late = active && isOverdue(dueDate);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', late ? 'font-medium text-destructive' : 'text-muted-foreground', className)}>
      <CalendarClock className="size-3.5" aria-hidden />
      Due {fmtDate(dueDate)}
      {active ? <span aria-hidden>· {fmtDueIn(dueDate)}</span> : null}
    </span>
  );
}

export function RequestCard({ request: r }: { request: DocumentRequest }) {
  const active = requestNeedsAction(r.status);
  const late = active && isOverdue(r.dueDate);
  return (
    <Link href={`/portal/requests/${r.id}`} className={CARD} aria-label={`${r.reference} ${r.title}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-2xs text-muted-foreground">
            {r.reference}
            {r.engagement ? <span> · {r.engagement.auditNumber}</span> : null}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug">{r.title}</p>
          {r.engagement ? <p className="truncate text-xs text-muted-foreground">{r.engagement.title}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <RequestStatusBadge status={r.status} />
          {late ? (
            <Badge variant="danger">
              <AlertTriangle className="size-3" aria-hidden /> Overdue
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <DueLine dueDate={r.dueDate} active={active} />
        <span className={cn('inline-flex items-center gap-1 text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {requestNextStep(r.status)}
          <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function FindingCard({ finding: f }: { finding: FindingSummary }) {
  const closed = FINDING_CLOSED_STATUSES.includes(f.status);
  const active = findingNeedsAction(f.status);
  const late = !closed && isOverdue(f.dueDate);
  return (
    <Link href={`/portal/actions/${f.id}`} className={CARD} aria-label={`${f.reference} ${f.title}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-2xs text-muted-foreground">
            {f.reference}
            {f.engagement ? <span> · {f.engagement.auditNumber}</span> : null}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug">{f.title}</p>
          {f.engagement ? <p className="truncate text-xs text-muted-foreground">{f.engagement.title}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <SeverityBadge severity={f.severity} />
          <FindingStatusBadge status={f.status} />
          {late ? (
            <Badge variant="danger">
              <AlertTriangle className="size-3" aria-hidden /> Overdue
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <DueLine dueDate={f.dueDate} active={!closed} />
        <span className={cn('inline-flex items-center gap-1 text-xs', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {findingNextStep(f.status)}
          <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function CardList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-3', className)}>{children}</div>;
}
