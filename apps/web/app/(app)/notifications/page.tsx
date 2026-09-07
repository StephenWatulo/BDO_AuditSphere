'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/filter-chips';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/lib/queries/collaboration';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const [view, setView] = React.useState<'unread' | 'all'>('unread');
  const query = useNotifications(view === 'unread');
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="outline" onClick={() => markAll.mutate()} loading={markAll.isPending}>
            <CheckCheck /> Mark all as read
          </Button>
        }
      >
        <Segmented
          aria-label="Notification filter"
          value={view}
          onChange={setView}
          options={[
            { value: 'unread', label: 'Unread' },
            { value: 'all', label: 'All' },
          ]}
        />
      </PageHeader>
      <div className="surface">
        {query.isLoading ? (
          <div className="p-4">
            <SkeletonRows rows={6} />
          </div>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell />} title="No notifications" description="You will be notified about assignments, review notes, due dates and approvals." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', !n.readAt && 'bg-accent/30')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-0.5 text-2xs text-muted-foreground">{fmtDateTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {n.link ? (
                    <Button variant="link" size="sm" asChild>
                      <Link href={n.link} onClick={() => !n.readAt && markRead.mutate(n.id)}>
                        Open
                      </Link>
                    </Button>
                  ) : null}
                  {!n.readAt ? (
                    <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
