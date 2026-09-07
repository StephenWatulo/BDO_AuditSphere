'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarClock, ClipboardCheck, FileText, Inbox, ListChecks, MessageSquareWarning } from 'lucide-react';
import { StatTile } from '@/components/ui/card';
import { Section } from '@/components/shell/page-header';
import { SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { FindingStatusBadge, RequestStatusBadge, SeverityBadge, WorkpaperStatusBadge } from '@/components/domain/badges';
import { useAuditorDashboard } from '@/lib/queries/dashboards';
import { fmtDate, fmtDueIn, isOverdue } from '@/lib/format';
import { cn } from '@/lib/utils';

function ListCard<T>({
  title,
  items,
  render,
  href,
  emptyText,
  icon,
}: {
  title: string;
  items?: T[];
  render: (item: T) => React.ReactNode;
  href?: string;
  emptyText: string;
  icon?: React.ReactNode;
}) {
  return (
    <Section
      title={title}
      bodyClassName="p-0"
      actions={
        href ? (
          <Link href={href} className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        ) : null
      }
    >
      {!items || items.length === 0 ? (
        <EmptyState compact icon={icon} title={emptyText} />
      ) : (
        <ul className="divide-y divide-border">{items.map((it, i) => <li key={i} className="px-4 py-2.5">{render(it)}</li>)}</ul>
      )}
    </Section>
  );
}

export function AuditorDashboard() {
  const { data, isLoading, error, refetch } = useAuditorDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
        <div className="col-span-full">
          <SkeletonRows rows={6} />
        </div>
      </div>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const overdueDeadlines = data.deadlines.items.filter((d) => isOverdue(d.dueDate)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Assigned steps" value={data.assignedSteps.count} icon={<ListChecks />} />
        <StatTile label="Open review notes" value={data.openReviewNotes.count} icon={<MessageSquareWarning />} tone={data.openReviewNotes.count ? 'danger' : 'default'} />
        <StatTile label="Pending reviews" value={data.pendingReviews.count} icon={<FileText />} tone={data.pendingReviews.count ? 'warning' : 'default'} />
        <StatTile label="Deadlines this week" value={data.deadlines.count} hint={overdueDeadlines ? `${overdueDeadlines} overdue` : undefined} icon={<CalendarClock />} tone={overdueDeadlines ? 'danger' : 'info'} />
        <StatTile label="My findings" value={data.myFindings.count} icon={<ClipboardCheck />} />
        <StatTile label="My requests" value={data.myRequests.count} icon={<Inbox />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ListCard
          title="Assigned programme steps"
          items={data.assignedSteps.items}
          icon={<ListChecks />}
          emptyText="No steps assigned"
          render={(s) => (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground">{s.reference}</span> {s.objective}
                </p>
                {s.engagement ? (
                  <Link href={`/engagements/${s.engagement.id}?tab=programme`} className="text-2xs text-muted-foreground hover:underline">
                    {s.engagement.auditNumber} · {s.engagement.title}
                  </Link>
                ) : null}
              </div>
              <span className="shrink-0 text-2xs text-muted-foreground">{s.status?.toLowerCase().replace('_', ' ')}</span>
            </div>
          )}
        />
        <ListCard
          title="Open review notes"
          items={data.openReviewNotes.items}
          icon={<MessageSquareWarning />}
          emptyText="No open review notes"
          render={(n) => (
            <div className="min-w-0">
              <Link href={`/workpapers/${n.workpaperId}`} className="block truncate text-sm font-medium hover:underline">
                {n.workpaper ? `${n.workpaper.reference} · ${n.workpaper.title}` : 'Workpaper'}
              </Link>
              <p className="line-clamp-2 text-xs text-muted-foreground">{n.text}</p>
            </div>
          )}
        />
        <ListCard
          title="Pending my review"
          items={data.pendingReviews.items}
          icon={<FileText />}
          emptyText="Nothing waiting for review"
          render={(w) => (
            <div className="flex items-center justify-between gap-2">
              <Link href={`/workpapers/${w.id}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{w.reference}</span> {w.title}
              </Link>
              <WorkpaperStatusBadge status={w.status} />
            </div>
          )}
        />
        <ListCard
          title="Deadlines this week"
          items={data.deadlines.items}
          icon={<CalendarClock />}
          emptyText="No deadlines this week"
          render={(d) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {d.link ? (
                  <Link href={d.link} className="block truncate text-sm font-medium hover:underline">{d.title}</Link>
                ) : (
                  <p className="truncate text-sm font-medium">{d.title}</p>
                )}
                <p className="text-2xs text-muted-foreground">{d.type ?? 'Milestone'}{d.engagement ? ` · ${d.engagement.auditNumber}` : ''}</p>
              </div>
              <span className={cn('shrink-0 text-xs', isOverdue(d.dueDate) ? 'text-destructive' : 'text-muted-foreground')}>{fmtDueIn(d.dueDate)}</span>
            </div>
          )}
        />
        <ListCard
          title="My findings"
          href="/findings?mine=true"
          items={data.myFindings.items}
          icon={<ClipboardCheck />}
          emptyText="No findings raised by you"
          render={(f) => (
            <div className="flex items-center justify-between gap-2">
              <Link href={`/findings/${f.id}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{f.reference}</span> {f.title}
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <SeverityBadge severity={f.severity} />
                <FindingStatusBadge status={f.status} />
              </div>
            </div>
          )}
        />
        <ListCard
          title="My document requests"
          href="/requests?view=mine"
          items={data.myRequests.items}
          icon={<Inbox />}
          emptyText="No requests assigned"
          render={(r) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/requests/${r.id}`} className="block truncate text-sm font-medium hover:underline">
                  <span className="font-mono text-xs text-muted-foreground">{r.reference}</span> {r.title}
                </Link>
                <p className="text-2xs text-muted-foreground">Due {fmtDate(r.dueDate)}</p>
              </div>
              <RequestStatusBadge status={r.status} />
            </div>
          )}
        />
      </div>
    </div>
  );
}
