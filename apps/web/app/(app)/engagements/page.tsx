'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Briefcase, Plus, User } from 'lucide-react';
import { ENGAGEMENT_STAGES, STAGE_LABELS } from '@auditsphere/shared';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect, ToggleChip } from '@/components/ui/filter-chips';
import { StageBadge, SeverityBadge } from '@/components/domain/badges';
import { UserAvatar } from '@/components/ui/avatar';
import { Can } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useEngagements } from '@/lib/queries/engagements';
import { ENGAGEMENT_TYPE_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate } from '@/lib/format';
import type { EngagementSummary } from '@/lib/types';

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', stage: undefined as string | string[] | undefined, type: undefined as string | undefined, status: undefined as string | undefined, mine: false };

export default function EngagementsPage() {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = useEngagements({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, stage: state.stage, type: state.type, status: state.status, mine: state.mine });

  const columns = React.useMemo<ColumnDef<EngagementSummary, unknown>[]>(() => [
    { accessorKey: 'auditNumber', header: 'Number', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '110px', nowrap: true } },
    { accessorKey: 'title', header: 'Engagement', cell: ({ row }) => (<div className="min-w-0"><Link href={`/engagements/${row.original.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.title}</Link><p className="truncate text-2xs text-muted-foreground">{row.original.entity?.name ?? 'No entity'} · {ENGAGEMENT_TYPE_LABELS[row.original.type] ?? row.original.type}</p></div>) },
    { accessorKey: 'stage', header: 'Stage', cell: ({ getValue }) => <StageBadge stage={getValue<string>()} /> },
    { accessorKey: 'riskRating', header: 'Rating', cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} /> },
    { id: 'lead', header: 'Lead', cell: ({ row }) => (row.original.lead ? <span className="flex items-center gap-1.5"><UserAvatar name={row.original.lead.displayName} size="xs" />{row.original.lead.displayName}</span> : '—') },
    { accessorKey: 'progressPct', header: 'Progress', cell: ({ getValue }) => { const v = getValue<number>() ?? 0; return <div className="flex items-center gap-2"><Progress value={v} size="sm" className="w-24" tone={v >= 100 ? 'success' : 'primary'} /><span className="w-8 text-right text-xs tabular-nums">{Math.round(v)}%</span></div>; } },
    { accessorKey: 'workpaperCount', header: 'WPs', meta: { align: 'right' }, cell: ({ getValue }) => getValue<number>() ?? 0 },
    { accessorKey: 'openFindingsCount', header: 'Open findings', meta: { align: 'right' }, cell: ({ getValue }) => { const n = getValue<number>() ?? 0; return <span className={n ? 'font-semibold text-destructive' : ''}>{n}</span>; } },
    { accessorKey: 'plannedStart', header: 'Planned start', cell: ({ getValue }) => fmtDate(getValue<string>()) },
    { accessorKey: 'plannedEnd', header: 'Planned end', cell: ({ getValue }) => fmtDate(getValue<string>()) },
  ], []);

  const chips = [];
  if (state.stage) chips.push({ key: 'stage', label: `Stage: ${(Array.isArray(state.stage) ? state.stage : [state.stage]).map((s) => STAGE_LABELS[s as keyof typeof STAGE_LABELS] ?? s).join(', ')}`, onRemove: () => set({ stage: undefined }) });
  if (state.type) chips.push({ key: 'type', label: `Type: ${ENGAGEMENT_TYPE_LABELS[state.type as keyof typeof ENGAGEMENT_TYPE_LABELS] ?? state.type}`, onRemove: () => set({ type: undefined }) });
  if (state.status) chips.push({ key: 'status', label: `Status: ${state.status}`, onRemove: () => set({ status: undefined }) });

  return (
    <>
      <PageHeader title="Engagements" description="All audits across the lifecycle." actions={mounted ? <Can permission="engagement:create"><Button asChild><Link href="/engagements/new"><Plus /> New engagement</Link></Button></Can> : undefined} />
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
        searchPlaceholder="Search by number or title…"
        chips={chips}
        onClearFilters={reset}
        toolbar={<>
          <ToggleChip label="Mine" icon={<User />} checked={!!state.mine} onChange={(v) => set({ mine: v })} />
          <ChipSelect label="Stage" multiple options={ENGAGEMENT_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} value={state.stage} onChange={(v) => set({ stage: v })} />
          <ChipSelect label="Type" options={enumOptions(ENGAGEMENT_TYPE_LABELS)} value={state.type} onChange={(v) => set({ type: v as string | undefined })} />
          <ChipSelect label="Status" options={['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: s.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) }))} value={state.status} onChange={(v) => set({ status: v as string | undefined })} />
        </>}
        onRowClick={(e) => router.push(`/engagements/${e.id}`)}
        emptyIcon={<Briefcase />}
        emptyTitle="No engagements"
        emptyDescription="Create engagements from the audit plan or directly."
        emptyAction={<Can permission="engagement:create"><Button size="sm" asChild><Link href="/engagements/new"><Plus /> New engagement</Link></Button></Can>}
        storageKey="engagements"
        initialHidden={['plannedEnd', 'workpaperCount']}
      />
    </>
  );
}
