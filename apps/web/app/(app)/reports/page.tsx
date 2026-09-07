'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Briefcase, ClipboardCheck, Download, FileText, PieChart } from 'lucide-react';
import { PageHeader, Section } from '@/components/shell/page-header';
import { StatTile } from '@/components/ui/card';
import { ReportExport } from '@/components/domain/report-export';
import { DataTable } from '@/components/ui/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { FindingStatusBadge, SeverityBadge, StageBadge } from '@/components/domain/badges';
import { useEngagementReportRegister, useExecutiveReport, useFindingReport } from '@/lib/queries/reports';
import { fmtDate, fmtDateTime, fmtNumber, fmtPct } from '@/lib/format';
import type { EngagementSummary, FindingSummary } from '@/lib/types';

function ExecutiveTab() {
  const report = useExecutiveReport();
  if (report.isLoading) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>;
  if (report.error || !report.data) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  const r = report.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Plan completion" value={fmtPct(r.metrics.planCompletionPct)} icon={<PieChart />} tone="success" />
        <StatTile label="Active engagements" value={fmtNumber(r.metrics.activeEngagements)} icon={<Briefcase />} tone="info" />
        <StatTile label="Open findings" value={fmtNumber(r.metrics.openFindings)} icon={<ClipboardCheck />} tone="warning" />
        <StatTile label="High/critical risks" value={fmtNumber(r.metrics.highAndCriticalRisks)} icon={<FileText />} tone="danger" />
        <StatTile label="Issued reports" value={fmtNumber(r.metrics.issuedReports)} icon={<Download />} />
      </div>
      <Section
        title={r.title}
        description={`Generated ${fmtDateTime(r.generatedAt)}`}
        actions={<ReportExport path="/reports/executive" />}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {r.sections.map((s) => (
            <article key={s.heading} className="rounded-md border border-border bg-muted/20 p-3">
              <h3 className="text-sm font-semibold">{s.heading}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}

function FindingsTab() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const query = useFindingReport({ page, pageSize: 25, q: search });
  const columns = React.useMemo<ColumnDef<FindingSummary, unknown>[]>(
    () => [
      { accessorKey: 'reference', header: 'Ref', meta: { width: '80px', nowrap: true }, cell: ({ row }) => <Link href={`/findings/${row.original.id}`} className="font-mono text-xs text-primary hover:underline">{row.original.reference}</Link> },
      { accessorKey: 'title', header: 'Finding', cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.title}</p><p className="truncate text-2xs text-muted-foreground">{row.original.engagement?.auditNumber ?? 'No engagement'} - {row.original.entity?.name ?? 'No entity'}</p></div> },
      { accessorKey: 'severity', header: 'Severity', cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} /> },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <FindingStatusBadge status={getValue<string>()} /> },
      { accessorKey: 'dueDate', header: 'Due', cell: ({ getValue }) => fmtDate(getValue<string | null>()), meta: { nowrap: true } },
      { id: 'owner', header: 'Owner', cell: ({ row }) => row.original.actionOwner?.displayName ?? row.original.actionOwnerName ?? '-' },
    ],
    [],
  );
  return (
    <DataTable
      columns={columns}
      data={query.data?.items}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      total={query.data?.total}
      page={query.data?.page ?? 1}
      pageSize={query.data?.pageSize ?? 25}
      onPageChange={setPage}
      search={search}
      onSearchChange={(value) => { setSearch(value); setPage(1); }}
      actions={<ReportExport path="/reports/findings" params={{ q: search }} register />}
      emptyIcon={<ClipboardCheck />}
      emptyTitle="No findings in this register"
      storageKey="report-findings"
    />
  );
}

function EngagementsTab() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const query = useEngagementReportRegister({ page, pageSize: 25, q: search });
  const columns = React.useMemo<ColumnDef<EngagementSummary, unknown>[]>(
    () => [
      { accessorKey: 'auditNumber', header: 'Audit', meta: { width: '120px', nowrap: true }, cell: ({ row }) => <Link href={`/engagements/${row.original.id}`} className="font-mono text-xs text-primary hover:underline">{row.original.auditNumber}</Link> },
      { accessorKey: 'title', header: 'Engagement', cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.title}</p><p className="truncate text-2xs text-muted-foreground">{row.original.entity?.name ?? 'No entity'}</p></div> },
      { accessorKey: 'stage', header: 'Stage', cell: ({ getValue }) => <StageBadge stage={getValue<string>()} /> },
      { accessorKey: 'riskRating', header: 'Risk', cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} /> },
      { accessorKey: 'plannedEnd', header: 'Planned end', cell: ({ getValue }) => fmtDate(getValue<string | null>()), meta: { nowrap: true } },
      { id: 'lead', header: 'Lead', cell: ({ row }) => row.original.lead?.displayName ?? '-' },
    ],
    [],
  );
  return (
    <DataTable
      columns={columns}
      data={query.data?.items}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => query.refetch()}
      total={query.data?.total}
      page={query.data?.page ?? 1}
      pageSize={query.data?.pageSize ?? 25}
      onPageChange={setPage}
      search={search}
      onSearchChange={(value) => { setSearch(value); setPage(1); }}
      actions={<ReportExport path="/reports/engagements" params={{ q: search }} register />}
      emptyIcon={<Briefcase />}
      emptyTitle="No engagements in this register"
      storageKey="report-engagements"
    />
  );
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Executive reporting, engagement registers and finding registers." />
      <Tabs defaultValue="executive">
        <TabsList>
          <TabsTrigger value="executive">Executive</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="engagements">Engagements</TabsTrigger>
        </TabsList>
        <TabsContent value="executive"><ExecutiveTab /></TabsContent>
        <TabsContent value="findings"><FindingsTab /></TabsContent>
        <TabsContent value="engagements"><EngagementsTab /></TabsContent>
      </Tabs>
    </>
  );
}
