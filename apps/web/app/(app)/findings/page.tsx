'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { AlarmClock, ClipboardCheck, Plus, User } from 'lucide-react';
import { FINDING_STATUSES, SEVERITIES } from '@auditsphere/shared';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect, ToggleChip } from '@/components/ui/filter-chips';
import { Skeleton } from '@/components/ui/skeleton';
import { AgeingBadge, FindingStatusBadge, SeverityBadge } from '@/components/domain/badges';
import { UserAvatar } from '@/components/ui/avatar';
import { Can } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useFindings } from '@/lib/queries/findings';
import { FINDING_STATUS_LABELS } from '@/lib/labels';
import { fmtDate, fmtDueIn } from '@/lib/format';
import { cn, humanize } from '@/lib/utils';
import type { FindingSummary } from '@/lib/types';

const DEFAULTS = {
  page: 1,
  pageSize: 25,
  q: '',
  sort: '',
  status: undefined as string | string[] | undefined,
  severity: undefined as string | string[] | undefined,
  overdue: false,
  mine: false,
};

function FindingsTable() {
  const router = useRouter();
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = useFindings({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, status: state.status, severity: state.severity, overdue: state.overdue, mine: state.mine });

  const columns = React.useMemo<ColumnDef<FindingSummary, unknown>[]>(
    () => [
      { accessorKey: 'reference', header: 'Ref', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '70px', nowrap: true } },
      {
        accessorKey: 'title',
        header: 'Finding',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/findings/${row.original.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.title}</Link>
            <p className="truncate text-2xs text-muted-foreground">{row.original.entity?.name ?? 'No entity'}{row.original.isRepeat ? ' · Repeat finding' : ''}</p>
          </div>
        ),
      },
      { accessorKey: 'severity', header: 'Severity', cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} /> },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <FindingStatusBadge status={getValue<string>()} /> },
      {
        id: 'ageing',
        header: 'Ageing',
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <AgeingBadge bucket={row.original.ageingBucket} />
            {row.original.daysOverdue ? <span className="text-2xs text-destructive">{row.original.daysOverdue}d</span> : null}
          </span>
        ),
      },
      {
        id: 'engagement',
        header: 'Engagement',
        cell: ({ row }) =>
          row.original.engagement ? (
            <Link href={`/engagements/${row.original.engagement.id}`} className="block min-w-0 hover:underline" onClick={(e) => e.stopPropagation()}>
              <span className="font-mono text-xs text-muted-foreground">{row.original.engagement.auditNumber}</span>
              <span className="block truncate text-xs">{row.original.engagement.title}</span>
            </Link>
          ) : '—',
      },
      {
        id: 'actionOwner',
        header: 'Action owner',
        cell: ({ row }) =>
          row.original.actionOwner ? (
            <span className="flex items-center gap-1.5"><UserAvatar name={row.original.actionOwner.displayName} src={row.original.actionOwner.avatarUrl} size="xs" />{row.original.actionOwner.displayName}</span>
          ) : row.original.actionOwnerName ? (
            row.original.actionOwnerName
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          ),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due',
        cell: ({ row }) => {
          const open = !['CLOSED', 'RISK_ACCEPTED'].includes(row.original.status);
          const overdue = open && !!row.original.daysOverdue;
          return (
            <span className={cn(overdue && 'text-destructive')}>
              {fmtDate(row.original.dueDate)}
              {row.original.dueDate && open ? <span className="block text-2xs text-muted-foreground">{fmtDueIn(row.original.dueDate)}</span> : null}
            </span>
          );
        },
      },
      { accessorKey: 'updatedAt', header: 'Updated', cell: ({ getValue }) => fmtDate(getValue<string>()) },
    ],
    [],
  );

  const chips = [];
  if (state.status) chips.push({ key: 'status', label: `Status: ${(Array.isArray(state.status) ? state.status : [state.status]).map((s) => FINDING_STATUS_LABELS[s] ?? s).join(', ')}`, onRemove: () => set({ status: undefined }) });
  if (state.severity) chips.push({ key: 'severity', label: `Severity: ${(Array.isArray(state.severity) ? state.severity : [state.severity]).map((s) => humanize(s)).join(', ')}`, onRemove: () => set({ severity: undefined }) });
  if (state.overdue) chips.push({ key: 'overdue', label: 'Overdue only', onRemove: () => set({ overdue: false }) });
  if (state.mine) chips.push({ key: 'mine', label: 'Mine', onRemove: () => set({ mine: false }) });

  return (
    <DataTable
      columns={columns}
      data={query.data?.items}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      total={query.data?.total}
      page={state.page}
      pageSize={state.pageSize}
      onPageChange={(page) => set({ page })}
      onPageSizeChange={(pageSize) => set({ pageSize, page: 1 })}
      sorting={sorting}
      onSortingChange={setSorting}
      search={state.q}
      onSearchChange={(q) => set({ q })}
      searchPlaceholder="Search by reference or title…"
      chips={chips}
      onClearFilters={reset}
      toolbar={
        <>
          <ToggleChip label="Mine" icon={<User />} checked={!!state.mine} onChange={(v) => set({ mine: v })} />
          <ToggleChip label="Overdue" icon={<AlarmClock />} checked={!!state.overdue} onChange={(v) => set({ overdue: v })} />
          <ChipSelect label="Severity" multiple options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} value={state.severity} onChange={(v) => set({ severity: v })} />
          <ChipSelect label="Status" multiple options={FINDING_STATUSES.map((s) => ({ value: s, label: FINDING_STATUS_LABELS[s] ?? s }))} value={state.status} onChange={(v) => set({ status: v })} />
        </>
      }
      onRowClick={(f) => router.push(`/findings/${f.id}`)}
      rowClassName={(f) => (f.daysOverdue && !['CLOSED', 'RISK_ACCEPTED'].includes(f.status) ? 'bg-destructive/[0.03]' : undefined)}
      emptyIcon={<ClipboardCheck />}
      emptyTitle="No findings"
      emptyDescription="Findings raised during fieldwork are tracked here through to closure."
      emptyAction={<Can permission="finding:manage"><Button size="sm" asChild><Link href="/findings/new"><Plus /> New finding</Link></Button></Can>}
      storageKey="findings"
      initialHidden={['updatedAt']}
    />
  );
}

export default function FindingsPage() {
  return (
    <>
      <PageHeader
        title="Findings"
        description="Issues raised across all engagements, with management responses and remediation tracking."
        actions={<Can permission="finding:manage"><Button asChild><Link href="/findings/new"><Plus /> New finding</Link></Button></Can>}
      />
      <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <FindingsTable />
      </React.Suspense>
    </>
  );
}
