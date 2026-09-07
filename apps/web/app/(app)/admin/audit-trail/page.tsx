'use client';

import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileSearch, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SimpleSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/avatar';
import { JsonDiff, JsonView } from '@/components/domain/json-diff';
import { UserPicker } from '@/components/domain/user-picker';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useAuditTrail } from '@/lib/queries/collaboration';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AuditTrailEntry } from '@/lib/types';

const DEFAULTS = { page: 1, pageSize: 50, targetType: '', targetId: '', actorId: '', from: '', to: '' };

const TARGET_TYPES = ['User', 'Role', 'AuditEntity', 'Process', 'Risk', 'RiskAssessment', 'Control', 'ControlTest', 'AuditPlan', 'PlanItem', 'Engagement', 'AuditProgram', 'ProgramStep', 'Workpaper', 'ReviewNote', 'Document', 'Evidence', 'Finding', 'Recommendation', 'DocumentRequest', 'Task', 'Comment', 'LibraryItem', 'Tenant'];

function actionTone(action: string): 'success' | 'danger' | 'warning' | 'info' | 'secondary' {
  const a = action.toLowerCase();
  if (/create|invite|upload|add/.test(a)) return 'success';
  if (/delete|remove|revoke|deactivat|retire|cancel/.test(a)) return 'danger';
  if (/transition|approve|sign|submit|status|login|logout|mfa/.test(a)) return 'info';
  if (/update|patch|edit|change|extend/.test(a)) return 'warning';
  return 'secondary';
}

function Row({ entry, expanded, onToggle }: { entry: AuditTrailEntry; expanded: boolean; onToggle: () => void }) {
  const hasDiff = !!(entry.before || entry.after);
  const hasMeta = !!entry.metadata && Object.keys(entry.metadata).length > 0;
  return (
    <>
      <TableRow className={cn('cursor-pointer', expanded && 'bg-muted/40')} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onToggle(); }} tabIndex={0} aria-expanded={expanded}>
        <TableCell className="w-8 pr-0"><ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !expanded && '-rotate-90')} /></TableCell>
        <TableCell className="whitespace-nowrap text-xs tabular-nums">{fmtDateTime(entry.occurredAt)}</TableCell>
        <TableCell>
          <span className="flex items-center gap-1.5 text-xs">
            <UserAvatar name={entry.actor?.displayName ?? entry.actorEmail ?? 'System'} src={entry.actor?.avatarUrl} size="xs" />
            <span className="truncate">{entry.actor?.displayName ?? entry.actorEmail ?? 'System'}</span>
          </span>
        </TableCell>
        <TableCell><Badge variant={actionTone(entry.action)} className="normal-case tracking-normal">{entry.action}</Badge></TableCell>
        <TableCell>
          <span className="text-xs">{entry.targetType}</span>
          {entry.targetId ? <span className="block max-w-56 truncate font-mono text-2xs text-muted-foreground" title={entry.targetId}>{entry.targetId}</span> : null}
        </TableCell>
        <TableCell className="hidden text-2xs text-muted-foreground md:table-cell">{entry.ipAddress ?? '—'}</TableCell>
        <TableCell className="hidden max-w-40 truncate font-mono text-2xs text-muted-foreground lg:table-cell" title={entry.requestId ?? undefined}>{entry.requestId ?? '—'}</TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="bg-muted/20 px-4 py-3">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto]">
              <div className="min-w-0 space-y-2">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Changes</p>
                {hasDiff ? <JsonDiff before={entry.before} after={entry.after} /> : <p className="text-xs text-muted-foreground">No before/after payload recorded for this action.</p>}
              </div>
              {hasMeta ? (
                <div className="min-w-0 xl:w-80">
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Metadata</p>
                  <JsonView value={entry.metadata} className="max-h-60" />
                </div>
              ) : null}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-2xs text-muted-foreground">
              <div><dt className="inline font-semibold">Entry</dt> <dd className="inline font-mono">{String(entry.id)}</dd></div>
              {entry.actorId ? <div><dt className="inline font-semibold">Actor id</dt> <dd className="inline font-mono">{entry.actorId}</dd></div> : null}
              {entry.requestId ? <div><dt className="inline font-semibold">Request</dt> <dd className="inline font-mono">{entry.requestId}</dd></div> : null}
              {entry.ipAddress ? <div><dt className="inline font-semibold">IP</dt> <dd className="inline font-mono">{entry.ipAddress}</dd></div> : null}
            </dl>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function AuditTrailTable() {
  const { state, set, reset } = useListParams(DEFAULTS);
  const query = useAuditTrail({
    page: state.page,
    pageSize: state.pageSize,
    targetType: state.targetType || undefined,
    targetId: state.targetId || undefined,
    actorId: state.actorId || undefined,
    from: state.from ? new Date(state.from).toISOString() : undefined,
    to: state.to ? new Date(`${state.to}T23:59:59.999`).toISOString() : undefined,
  });
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [targetIdDraft, setTargetIdDraft] = React.useState(state.targetId);
  React.useEffect(() => setTargetIdDraft(state.targetId), [state.targetId]);
  React.useEffect(() => setExpanded(new Set()), [query.data]);

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const hasFilters = !!(state.targetType || state.targetId || state.actorId || state.from || state.to);
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="surface flex flex-col overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <div className="space-y-1"><Label htmlFor="at-type" className="text-2xs text-muted-foreground">Target type</Label><SimpleSelect id="at-type" value={state.targetType || ''} onValueChange={(v) => set({ targetType: v })} options={TARGET_TYPES.map((t) => ({ value: t, label: t }))} allowClear clearLabel="Any type" placeholder="Any type" className="h-7 text-xs" /></div>
          <div className="space-y-1"><Label htmlFor="at-target" className="text-2xs text-muted-foreground">Target id</Label><Input id="at-target" value={targetIdDraft} onChange={(e) => setTargetIdDraft(e.target.value)} onBlur={() => targetIdDraft !== state.targetId && set({ targetId: targetIdDraft.trim() })} onKeyDown={(e) => { if (e.key === 'Enter') set({ targetId: targetIdDraft.trim() }); }} placeholder="UUID" className="h-7 font-mono text-xs" /></div>
          <div className="space-y-1 md:col-span-2"><Label htmlFor="at-actor" className="text-2xs text-muted-foreground">Actor</Label><UserPicker id="at-actor" value={state.actorId || null} onChange={(id) => set({ actorId: id ?? '' })} placeholder="Anyone" className="h-7 text-xs" /></div>
          <div className="space-y-1"><Label htmlFor="at-from" className="text-2xs text-muted-foreground">From</Label><Input id="at-from" type="date" value={state.from} max={state.to || undefined} onChange={(e) => set({ from: e.target.value })} className="h-7 text-xs" /></div>
          <div className="space-y-1"><Label htmlFor="at-to" className="text-2xs text-muted-foreground">To</Label><Input id="at-to" type="date" value={state.to} min={state.from || undefined} onChange={(e) => set({ to: e.target.value })} className="h-7 text-xs" /></div>
        </div>
        {hasFilters ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{query.isFetching ? 'Loading…' : `${total} entr${total === 1 ? 'y' : 'ies'} match`}</span>
            <Button variant="link" size="sm" className="h-6 px-1 text-xs" onClick={reset}><X /> Clear filters</Button>
          </div>
        ) : null}
      </div>

      <div className="relative w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="hidden md:table-cell">IP</TableHead>
              <TableHead className="hidden lg:table-cell">Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-3.5 w-[70%]" /></TableCell>)}</TableRow>
              ))
            ) : query.error ? (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={7} className="p-0"><ErrorState error={query.error} compact onRetry={() => query.refetch()} /></TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={7} className="p-0"><EmptyState compact icon={<FileSearch />} title="No audit trail entries" description={hasFilters ? 'Try widening the filters.' : 'Every mutating action across the platform is recorded here.'} /></TableCell></TableRow>
            ) : (
              items.map((e) => <Row key={String(e.id)} entry={e} expanded={expanded.has(String(e.id))} onToggle={() => toggle(String(e.id))} />)
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <div>{total > 0 ? <>Showing <span className="font-medium text-foreground">{(state.page - 1) * state.pageSize + 1}–{Math.min(state.page * state.pageSize, total)}</span> of <span className="font-medium text-foreground">{total}</span></> : 'No results'}</div>
        <div className="flex items-center gap-2">
          <SimpleSelect value={String(state.pageSize)} onValueChange={(v) => set({ pageSize: Number(v), page: 1 })} options={[25, 50, 100, 200].map((n) => ({ value: String(n), label: `${n} / page` }))} className="h-7 w-28 text-xs" aria-label="Rows per page" />
          <span className="tabular-nums">Page {state.page} of {pageCount}</span>
          <Button variant="outline" size="icon-sm" onClick={() => set({ page: state.page - 1 })} disabled={state.page <= 1} aria-label="Previous page"><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" onClick={() => set({ page: state.page + 1 })} disabled={state.page >= pageCount} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}

export default function AuditTrailPage() {
  return (
    <>
      <PageHeader title="Audit trail" description="Immutable record of who changed what, and when. Expand a row to see the before and after values." crumbs={[{ label: 'Admin' }, { label: 'Audit trail' }]} />
      <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AuditTrailTable />
      </React.Suspense>
    </>
  );
}
