'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Activity, AlertTriangle, Database, Gauge, RadioTower, ShieldAlert } from 'lucide-react';
import { PageHeader, Section } from '@/components/shell/page-header';
import { StatTile } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { SimpleSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge, GenericStatusBadge } from '@/components/domain/badges';
import { UserPicker } from '@/components/domain/user-picker';
import { MonitoringAlertPanel } from '@/components/domain/monitoring-alert-panel';
import { useCan } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import {
  useDataConnectors,
  useMonitoringAlerts,
  useMonitoringRules,
  useMonitoringSummary,
  useRiskSignals,
  useUpdateMonitoringAlert,
  useUpdateRiskSignal,
} from '@/lib/queries/monitoring';
import { MONITORING_ALERT_STATUS_LABELS, RISK_SIGNAL_STATUS_LABELS } from '@/lib/labels';
import { fmtDateTime, fmtNumber } from '@/lib/format';
import type { DataConnector, MonitoringAlert, MonitoringRule, RiskSignal } from '@/lib/types';

const ALERT_STATUS = Object.entries(MONITORING_ALERT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const SIGNAL_STATUS = Object.entries(RISK_SIGNAL_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const ALERT_DEFAULTS = { page: 1, pageSize: 25, sort: '' };

function AlertsTab() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, set, sorting, setSorting } = useListParams(ALERT_DEFAULTS);
  const query = useMonitoringAlerts({ page: state.page, pageSize: state.pageSize, sort: state.sort });
  const update = useUpdateMonitoringAlert();
  const can = useCan();
  const canManage = can('monitoring:manage');
  const alertHref = React.useCallback((id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('alert', id);
    return `/monitoring?${next.toString()}`;
  }, [params]);
  const columns = React.useMemo<ColumnDef<MonitoringAlert, unknown>[]>(
    () => [
      { accessorKey: 'title', header: 'Alert', enableSorting: false, cell: ({ row }) => <div className="min-w-52 max-w-md"><Link id={`monitoring-alert-${row.original.id}`} href={alertHref(row.original.id)} scroll={false} onClick={(event) => event.stopPropagation()} className="block break-words font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{row.original.title}</Link><p className="mt-0.5 break-words text-2xs text-muted-foreground">{row.original.rule?.code} - {row.original.rule?.name}</p></div> },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => canManage ? <div onClick={(event) => event.stopPropagation()}><SimpleSelect value={row.original.status} disabled={update.isPending} onValueChange={(status) => update.mutate({ id: row.original.id, status })} options={ALERT_STATUS} className="h-7 w-36 text-xs" aria-label="Alert status" /></div> : <GenericStatusBadge value={row.original.status} labels={MONITORING_ALERT_STATUS_LABELS} /> },
      { id: 'severity', header: 'Severity', cell: ({ row }) => <SeverityBadge severity={row.original.rule?.severity} /> },
      { accessorKey: 'amount', header: 'Amount', meta: { align: 'right' }, cell: ({ getValue }) => fmtNumber(getValue<number | string | null>(), 0) },
      { id: 'assignee', header: 'Assignee', cell: ({ row }) => canManage ? <div onClick={(event) => event.stopPropagation()}><UserPicker value={row.original.assigneeId} initial={row.original.assignee} disabled={update.isPending} onChange={(assigneeId) => update.mutate({ id: row.original.id, assigneeId })} className="min-w-44" /></div> : row.original.assignee?.displayName ?? 'Unassigned' },
      { accessorKey: 'detectedAt', header: 'Detected', cell: ({ getValue }) => fmtDateTime(getValue<string>()), meta: { nowrap: true } },
    ],
    [update, alertHref, canManage],
  );
  return <DataTable columns={columns} data={query.data?.items} isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} total={query.data?.total} page={state.page} pageSize={state.pageSize} onPageChange={(page) => set({ page })} onPageSizeChange={(pageSize) => set({ pageSize, page: 1 })} sorting={sorting} onSortingChange={setSorting} onRowClick={(alert) => router.push(alertHref(alert.id), { scroll: false })} hideToolbar emptyIcon={<ShieldAlert />} emptyTitle="No monitoring alerts" storageKey="monitoring-alerts" />;
}

function SignalsTab() {
  const query = useRiskSignals({ pageSize: 25 });
  const update = useUpdateRiskSignal();
  const columns = React.useMemo<ColumnDef<RiskSignal, unknown>[]>(
    () => [
      { accessorKey: 'title', header: 'Signal', cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.title}</p>{row.original.summary ? <p className="line-clamp-2 text-2xs text-muted-foreground">{row.original.summary}</p> : null}</div> },
      { accessorKey: 'source', header: 'Source', cell: ({ getValue }) => <Badge variant="outline" className="normal-case tracking-normal">{getValue<string>()}</Badge> },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <SimpleSelect value={row.original.status} onValueChange={(status) => update.mutate({ id: row.original.id, status })} options={SIGNAL_STATUS} className="h-7 w-32 text-xs" aria-label="Signal status" /> },
      { id: 'risk', header: 'Linked risk', cell: ({ row }) => row.original.risk ? <span><span className="font-mono text-2xs text-muted-foreground">{row.original.risk.code}</span> {row.original.risk.title}</span> : '-' },
      { accessorKey: 'relevanceScore', header: 'Relevance', meta: { align: 'right' }, cell: ({ getValue }) => fmtNumber(Number(getValue<number | string | null>() ?? 0) * 100, 0) },
      { accessorKey: 'publishedAt', header: 'Published', cell: ({ getValue }) => fmtDateTime(getValue<string | null>()), meta: { nowrap: true } },
    ],
    [update],
  );
  return <DataTable columns={columns} data={query.data?.items} isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} total={query.data?.total} page={query.data?.page ?? 1} pageSize={query.data?.pageSize ?? 25} hideToolbar emptyIcon={<RadioTower />} emptyTitle="No risk signals" storageKey="risk-signals" />;
}

function RulesTab() {
  const query = useMonitoringRules({ pageSize: 25 });
  const columns = React.useMemo<ColumnDef<MonitoringRule, unknown>[]>(
    () => [
      { accessorKey: 'code', header: 'Code', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '90px', nowrap: true } },
      { accessorKey: 'name', header: 'Rule', cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.name}</p>{row.original.description ? <p className="truncate text-2xs text-muted-foreground">{row.original.description}</p> : null}</div> },
      { accessorKey: 'ruleType', header: 'Type', cell: ({ getValue }) => <Badge variant="outline" className="normal-case tracking-normal">{getValue<string>()}</Badge> },
      { accessorKey: 'severity', header: 'Severity', cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} /> },
      { accessorKey: 'isActive', header: 'Active', cell: ({ getValue }) => getValue<boolean>() ? <GenericStatusBadge value="Active" tone="success" /> : <GenericStatusBadge value="Paused" tone="muted" /> },
      { accessorKey: 'lastRunAt', header: 'Last run', cell: ({ getValue }) => fmtDateTime(getValue<string | null>()), meta: { nowrap: true } },
    ],
    [],
  );
  return <DataTable columns={columns} data={query.data?.items} isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} total={query.data?.total} page={query.data?.page ?? 1} pageSize={query.data?.pageSize ?? 25} hideToolbar emptyIcon={<Gauge />} emptyTitle="No rules configured" storageKey="monitoring-rules" />;
}

function ConnectorsTab() {
  const query = useDataConnectors({ pageSize: 25 });
  const columns = React.useMemo<ColumnDef<DataConnector, unknown>[]>(
    () => [
      { accessorKey: 'name', header: 'Connector', cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.name}</p><p className="truncate text-2xs text-muted-foreground">{row.original.schedule ?? 'Manual run'}</p></div> },
      { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <Badge variant="outline" className="normal-case tracking-normal">{getValue<string>()}</Badge> },
      { accessorKey: 'lastStatus', header: 'Last status', cell: ({ getValue }) => getValue<string | null>() ?? '-' },
      { accessorKey: 'lastRunAt', header: 'Last run', cell: ({ getValue }) => fmtDateTime(getValue<string | null>()), meta: { nowrap: true } },
      { id: 'rules', header: 'Rules', meta: { align: 'right' }, cell: ({ row }) => fmtNumber(row.original._count?.rules ?? 0) },
    ],
    [],
  );
  return <DataTable columns={columns} data={query.data?.items} isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} total={query.data?.total} page={query.data?.page ?? 1} pageSize={query.data?.pageSize ?? 25} hideToolbar emptyIcon={<Database />} emptyTitle="No connectors configured" storageKey="data-connectors" />;
}

export default function MonitoringPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('alert');
  const closeAlert = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('alert');
    router.replace(next.size ? `/monitoring?${next.toString()}` : '/monitoring', { scroll: false });
  };
  const summary = useMonitoringSummary();
  const alertMap = new Map((summary.data?.alertsByStatus ?? []).map((x) => [x.status, x.count]));
  const signalMap = new Map((summary.data?.signalsByStatus ?? []).map((x) => [x.status, x.count]));
  return (
    <>
      <PageHeader title="Monitoring" description="Risk radar signals, continuous audit alerts, connectors and rules." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Open alerts" value={fmtNumber(alertMap.get('OPEN') ?? 0)} icon={<AlertTriangle />} tone="danger" />
        <StatTile label="Assigned to me" value={fmtNumber(summary.data?.openAssignedToMe ?? 0)} icon={<Activity />} tone="warning" />
        <StatTile label="New signals" value={fmtNumber(signalMap.get('NEW') ?? 0)} icon={<RadioTower />} tone="info" />
        <StatTile label="Active rules" value={fmtNumber(summary.data?.activeRules ?? 0)} icon={<Gauge />} tone="success" />
        <StatTile label="Connectors" value={fmtNumber(summary.data?.activeConnectors ?? 0)} icon={<Database />} />
      </div>
      <Section className="mt-4" bodyClassName="pt-0">
        <Tabs defaultValue="alerts">
          <TabsList>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="signals">Risk radar</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="connectors">Connectors</TabsTrigger>
          </TabsList>
          <TabsContent value="alerts"><AlertsTab /></TabsContent>
          <TabsContent value="signals"><SignalsTab /></TabsContent>
          <TabsContent value="rules"><RulesTab /></TabsContent>
          <TabsContent value="connectors"><ConnectorsTab /></TabsContent>
        </Tabs>
      </Section>
      {selectedId ? <MonitoringAlertPanel id={selectedId} onClose={closeAlert} /> : null}
    </>
  );
}
