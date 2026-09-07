'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/lib/queries/collaboration';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NotificationBell({
  mapLink,
  allHref = '/notifications',
}: {
  /** Rewrites a notification's deep link before navigating (the client portal maps workspace routes onto portal routes). */
  mapLink?: (link: string) => string;
  allHref?: string;
} = {}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { data } = useNotifications(true, { refetchInterval: 60_000 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = data?.items ?? [];
  const unread = data?.total ?? items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative">
          <Bell />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-xs text-muted-foreground">You are all caught up.</li>
          ) : (
            items.slice(0, 15).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left hover:bg-muted',
                    !n.readAt && 'bg-accent/40',
                  )}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                    setOpen(false);
                    if (n.link) router.push(mapLink ? mapLink(n.link) : n.link);
                  }}
                >
                  <span className="text-sm font-medium leading-tight">{n.title}</span>
                  {n.body ? <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span> : null}
                  <span className="text-2xs text-muted-foreground">{fmtRelative(n.createdAt)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-border px-3 py-2 text-center">
          <Link href={allHref} className="text-xs font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
