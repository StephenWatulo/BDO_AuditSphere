'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, HelpCircle, Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { WithTooltip } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useCan, useCurrentUser } from '@/lib/auth';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, isActivePath } from './nav-config';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';
import { CommandPalette } from './command-palette';
import { ShortcutsSheet } from './shortcuts-sheet';
import { BdoLogo } from '@/components/brand/bdo-logo';

const RAIL_KEY = 'as.rail.collapsed';

function BdoMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <BdoLogo className="w-11 dark:hidden" />
      <BdoLogo white className="hidden w-11 dark:inline-block" />
    </span>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const can = useCan();
  return (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 py-3" aria-label="Primary">
      {NAV_GROUPS.map((group, gi) => {
        const items = group.items.filter((i) => can(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi} className="space-y-0.5">
            {group.label && !collapsed ? (
              <p className="px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            ) : group.label && gi > 0 ? (
              <div className="mx-2 my-1 h-px bg-border" />
            ) : null}
            {items.map((item) => {
              const active = isActivePath(pathname, item);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    active
                      ? 'bg-sidebar-active text-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-muted hover:text-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-0 h-5 w-0.5 rounded-r bg-primary transition-opacity',
                      active ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  <item.icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                  {!collapsed ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                </Link>
              );
              return (
                <div key={item.href} className="relative">
                  {collapsed ? (
                    <WithTooltip label={item.label} side="right">
                      {link}
                    </WithTooltip>
                  ) : (
                    link
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(RAIL_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(RAIL_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  useKeyboardShortcuts([
    { keys: 'mod+k', description: 'Command palette', handler: () => setPaletteOpen((o) => !o) },
    { keys: '?', description: 'Shortcuts', handler: () => setShortcutsOpen(true) },
    { keys: 'g h', description: 'Home', handler: () => router.push('/') },
    { keys: 'g e', description: 'Engagements', handler: () => router.push('/engagements') },
    { keys: 'g f', description: 'Findings', handler: () => router.push('/findings') },
    { keys: 'g u', description: 'Universe', handler: () => router.push('/universe') },
    { keys: 'g r', description: 'Risks', handler: () => router.push('/risks') },
    { keys: 'g p', description: 'Plans', handler: () => router.push('/plans') },
    { keys: 'g q', description: 'Requests', handler: () => router.push('/requests') },
    { keys: 'g t', description: 'Tasks', handler: () => router.push('/tasks') },
    { keys: 'n f', description: 'New finding', handler: () => router.push('/findings/new') },
    { keys: 'n e', description: 'New engagement', handler: () => router.push('/engagements/new') },
  ]);

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop rail */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        <div className={cn('flex h-12 items-center gap-2 border-b border-sidebar-border px-3', collapsed && 'justify-center px-0')}>
          <BdoMark />
          {!collapsed ? (
            <span className="truncate text-sm font-semibold tracking-tight">
              AuditSphere
            </span>
          ) : null}
        </div>
        <NavList collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full justify-start text-muted-foreground', collapsed && 'justify-center px-0')}
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            {!collapsed ? <span>Collapse</span> : null}
          </Button>
        </div>
      </aside>

      {/* Mobile nav sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] p-0">
          <SheetHeader className="py-3">
            <SheetTitle className="flex items-center gap-2">
              <BdoMark /> AuditSphere
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto pb-4">
            <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="Home">
            <BdoMark />
          </Link>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:ml-2 sm:mr-auto"
            aria-label="Search (Ctrl+K)"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 truncate text-left sm:inline">Search engagements, findings, workpapers…</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              <kbd className="kbd">Ctrl</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </button>
          <div className="flex items-center gap-1">
            <WithTooltip label="Keyboard shortcuts (?)">
              <Button variant="ghost" size="icon" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts" className="hidden sm:inline-flex">
                <HelpCircle />
              </Button>
            </WithTooltip>
            <NotificationBell />
            {isLoading && !user ? <Skeleton className="size-8 rounded-full" /> : <UserMenu />}
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-5">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
