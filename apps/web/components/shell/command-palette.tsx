'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Briefcase,
  ClipboardCheck,
  FileText,
  Inbox,
  ListTodo,
  Moon,
  Network,
  Plus,
  ShieldCheck,
  Sun,
  Terminal,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { STAGE_LABELS } from '@auditsphere/shared';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useSearch } from '@/lib/queries/collaboration';
import { useCan } from '@/lib/auth';
import { NAV_GROUPS } from './nav-config';
import { SeverityBadge } from '@/components/domain/badges';

interface Cmd {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
  keywords?: string;
  shortcut?: string;
  permission?: Parameters<ReturnType<typeof useCan>>[0];
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const can = useCan();
  const { setTheme } = useTheme();
  const [query, setQuery] = React.useState('');
  const isCommandMode = query.startsWith('>');
  const term = isCommandMode ? query.slice(1).trim() : query.trim();
  const { data, isFetching } = useSearch(isCommandMode ? '' : term);

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [router, onOpenChange],
  );

  const commands = React.useMemo<Cmd[]>(
    () => [
      { id: 'new-engagement', label: 'New engagement', icon: <Plus />, run: () => go('/engagements/new'), permission: 'engagement:create' },
      { id: 'new-finding', label: 'New finding', icon: <Plus />, run: () => go('/findings/new'), permission: 'finding:manage', shortcut: 'n f' },
      { id: 'new-risk', label: 'New risk', icon: <Plus />, run: () => go('/risks?new=1'), permission: 'risk:manage' },
      { id: 'my-tasks', label: 'Go to my tasks', icon: <ListTodo />, run: () => go('/tasks') },
      { id: 'my-requests', label: 'Go to my requests', icon: <Inbox />, run: () => go('/requests?view=mine'), permission: 'request:read' },
      { id: 'theme-light', label: 'Switch to light theme', icon: <Sun />, run: () => { setTheme('light'); onOpenChange(false); } },
      { id: 'theme-dark', label: 'Switch to dark theme', icon: <Moon />, run: () => { setTheme('dark'); onOpenChange(false); } },
    ],
    [go, setTheme, onOpenChange],
  );

  const navCommands = React.useMemo(
    () =>
      NAV_GROUPS.flatMap((g) => g.items)
        .filter((i) => !i.download && can(i.permission))
        .map<Cmd>((i) => ({
          id: `nav-${i.href}`,
          label: `Go to ${i.label}`,
          icon: <i.icon />,
          run: () => go(i.href),
          shortcut: i.shortcut,
        })),
    [can, go],
  );

  const filter = (c: Cmd) => (!term ? true : `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(term.toLowerCase()));
  const visibleCommands = commands.filter((c) => can(c.permission)).filter(filter);
  const visibleNav = navCommands.filter(filter);

  const hasResults =
    !!data &&
    (data.engagements?.length || data.findings?.length || data.workpapers?.length || data.entities?.length || data.risks?.length || data.controls?.length);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false} title="Search and commands">
      <CommandInput
        placeholder="Search engagements, findings, workpapers… or type > for commands"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isCommandMode ? (
          <>
            <CommandGroup heading="Commands">
              {visibleCommands.map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={c.run}>
                  {c.icon}
                  <span>{c.label}</span>
                  {c.shortcut ? <CommandShortcut>{c.shortcut}</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Navigate">
              {visibleNav.map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={c.run}>
                  {c.icon}
                  <span>{c.label}</span>
                  {c.shortcut ? <CommandShortcut>{c.shortcut}</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {visibleCommands.length + visibleNav.length === 0 ? <CommandEmpty>No matching commands.</CommandEmpty> : null}
          </>
        ) : term.length < 2 ? (
          <>
            <CommandGroup heading="Quick actions">
              {commands.filter((c) => can(c.permission)).slice(0, 4).map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={c.run}>
                  {c.icon}
                  <span>{c.label}</span>
                  {c.shortcut ? <CommandShortcut>{c.shortcut}</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Navigate">
              {navCommands.map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={c.run}>
                  {c.icon}
                  <span>{c.label}</span>
                  {c.shortcut ? <CommandShortcut>{c.shortcut}</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-2xs text-muted-foreground">
              <Terminal className="size-3" /> Type <span className="kbd">&gt;</span> to run commands. Type at least two characters to
              search.
            </div>
          </>
        ) : (
          <>
            {isFetching && !data ? <div className="px-3 py-6 text-center text-xs text-muted-foreground">Searching…</div> : null}
            {data && !hasResults ? <CommandEmpty>No results for &ldquo;{term}&rdquo;.</CommandEmpty> : null}
            {data?.engagements?.length ? (
              <CommandGroup heading="Engagements">
                {data.engagements.map((e) => (
                  <CommandItem key={e.id} value={`eng-${e.id}`} onSelect={() => go(`/engagements/${e.id}`)}>
                    <Briefcase />
                    <span className="font-mono text-xs text-muted-foreground">{e.auditNumber}</span>
                    <span className="truncate">{e.title}</span>
                    {e.stage ? <CommandShortcut className="tracking-normal">{STAGE_LABELS[e.stage]}</CommandShortcut> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data?.findings?.length ? (
              <CommandGroup heading="Findings">
                {data.findings.map((f) => (
                  <CommandItem key={f.id} value={`fnd-${f.id}`} onSelect={() => go(`/findings/${f.id}`)}>
                    <ClipboardCheck />
                    <span className="font-mono text-xs text-muted-foreground">{f.reference}</span>
                    <span className="truncate">{f.title}</span>
                    <span className="ml-auto">
                      <SeverityBadge severity={f.severity} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data?.workpapers?.length ? (
              <CommandGroup heading="Workpapers">
                {data.workpapers.map((w) => (
                  <CommandItem key={w.id} value={`wp-${w.id}`} onSelect={() => go(`/workpapers/${w.id}`)}>
                    <FileText />
                    <span className="font-mono text-xs text-muted-foreground">{w.reference}</span>
                    <span className="truncate">{w.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data?.entities?.length ? (
              <CommandGroup heading="Audit universe">
                {data.entities.map((e) => (
                  <CommandItem key={e.id} value={`ent-${e.id}`} onSelect={() => go(`/universe?entity=${e.id}`)}>
                    <Network />
                    <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
                    <span className="truncate">{e.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data?.risks?.length ? (
              <CommandGroup heading="Risks">
                {data.risks.map((r) => (
                  <CommandItem key={r.id} value={`risk-${r.id}`} onSelect={() => go(`/risks?risk=${r.id}`)}>
                    <Activity />
                    <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                    <span className="truncate">{r.title}</span>
                    {r.rating ? (
                      <span className="ml-auto">
                        <SeverityBadge severity={r.rating} />
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {data?.controls?.length ? (
              <CommandGroup heading="Controls">
                {data.controls.map((c) => (
                  <CommandItem key={c.id} value={`ctl-${c.id}`} onSelect={() => go(`/controls?control=${c.id}`)}>
                    <ShieldCheck />
                    <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                    <span className="truncate">{c.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
