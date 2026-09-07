'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, Home, Inbox, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { BdoLogo } from '@/components/brand/bdo-logo';
import { NotificationBell } from '@/components/shell/notification-bell';
import { UserMenu } from '@/components/shell/user-menu';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { canUsePortal, hasWorkspaceAccess, useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { portalLink } from './portal-links';

const NAV = [
  { label: 'Overview', href: '/portal', icon: Home, exact: true },
  { label: 'My requests', href: '/portal/requests', icon: Inbox },
  { label: 'My actions', href: '/portal/actions', icon: ClipboardCheck },
];

/**
 * Focused shell for business owners: a single top bar and three sections, no audit
 * navigation. Access is permission based (request:respond or finding:respond).
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, error, refetch } = useCurrentUser();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  let body: React.ReactNode;
  if (!mounted || (isLoading && !user)) {
    body = (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-7 w-64" />
        <SkeletonRows rows={4} />
      </div>
    );
  } else if (error && !user) {
    body = <ErrorState error={error} onRetry={() => refetch()} />;
  } else if (!canUsePortal(user)) {
    body = (
      <EmptyState
        icon={<ShieldAlert className="text-warning" />}
        title="The client portal is for business owners"
        description="Your account does not respond to document requests or findings. Use the full workspace instead."
        action={
          <Button asChild>
            <Link href="/">Go to the workspace</Link>
          </Button>
        }
      />
    );
  } else {
    body = children;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" aria-label="Client portal overview">
            <BdoLogo className="w-11 dark:hidden" />
            <BdoLogo white className="hidden w-11 dark:inline-block" />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Client portal</span>
              <span className="text-2xs text-muted-foreground">{user?.tenant?.name ?? 'BDO AuditSphere'}</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {hasWorkspaceAccess(user) ? (
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/">
                  <LayoutDashboard /> Workspace
                </Link>
              </Button>
            ) : null}
            <NotificationBell mapLink={portalLink} />
            {!mounted || (isLoading && !user) ? <Skeleton className="size-8 rounded-full" /> : <UserMenu />}
          </div>
        </div>
        <nav aria-label="Portal sections" className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2 sm:px-4">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main id="portal-main" className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-5xl">{body}</div>
      </main>

      <footer className="border-t border-border px-4 py-3 text-center text-2xs text-muted-foreground">
        BDO AuditSphere client portal. Files you upload here are shared with the audit team only.
      </footer>
    </div>
  );
}
