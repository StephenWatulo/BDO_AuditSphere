'use client';

import * as React from 'react';
import Link from 'next/link';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertOctagon, ClipboardCheck, Repeat, TrendingUp } from 'lucide-react';
import { AGEING_BUCKETS } from '@auditsphere/shared';
import { StatTile } from '@/components/ui/card';
import { Section } from '@/components/shell/page-header';
import { Progress } from '@/components/ui/progress';
import { SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { HeatMap, HeatMapLegend } from '@/components/domain/heat-map';
import { AgeingBadge, FindingStatusBadge, SeverityBadge } from '@/components/domain/badges';
import { useCommitteeDashboard } from '@/lib/queries/dashboards';
import { fmtPct } from '@/lib/format';
import type { FindingSummary } from '@/lib/types';

function FindingRow({ f }: { f: FindingSummary }) {
  return (
    <li className="flex items-center justify-between gap-2 px-4 py-2">
      <div className="min-w-0">
        <Link href={`/findings/${f.id}`} className="block truncate text-sm font-medium hover:underline">
          <span className="font-mono text-xs text-muted-foreground">{f.reference}</span> {f.title}
        </Link>
        <p className="truncate text-2xs text-muted-foreground">
          {f.engagement?.auditNumber}
          {f.entity ? ` · ${f.entity.name}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <SeverityBadge severity={f.severity} />
        <FindingStatusBadge status={f.status} />
      </div>
    </li>
  );
}

export function CommitteeDashboard() {
  const { data, isLoading, error, refetch } = useCommitteeDashboard();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
        <div className="col-span-full">
          <SkeletonRows rows={6} />
        </div>
      </div>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  const cells = data.riskProfile.cells;
  const criticalHigh = cells.filter((c) => c.rating === 'CRITICAL' || c.rating === 'HIGH').reduce((a, c) => a + c.count, 0);
  const totalRisks = data.riskProfile.totalActiveRisks;
  const overdueTotal = data.overdueActions.total;
  const maxBucket = Math.max(1, ...data.overdueActions.buckets.map((b) => b.count));
  const plan = data.planProgress;
  const planPct = plan?.completionPct ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="High and critical risks" value={criticalHigh} hint={`of ${totalRisks} assessed risks`} icon={<AlertOctagon />} tone={criticalHigh ? 'danger' : 'default'} />
        <StatTile label="Plan progress" value={fmtPct(plan ? planPct : null)} hint={plan ? `${plan.completed} of ${plan.total} completed${plan.title ? ` · ${plan.title}` : ''}` : 'No active audit plan'} icon={<TrendingUp />} tone="info" />
        <StatTile label="Key findings" value={data.keyFindings.count} icon={<ClipboardCheck />} />
        <StatTile label="Overdue actions" value={overdueTotal} hint={`${data.repeatFindings.count} repeat findings`} icon={<Repeat />} tone={overdueTotal ? 'warning' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Section title="Residual risk profile" description="Count of risks by residual likelihood and impact." className="xl:col-span-1">
          <HeatMap cells={cells} />
          <HeatMapLegend className="mt-3" />
        </Section>

        <Section title="Risk trend" description="Average inherent and residual scores by period." className="xl:col-span-2">
          {data.riskTrend.length === 0 ? (
            <EmptyState compact title="No trend data yet" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.riskTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="avgInherentScore" name="Inherent score" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="avgResidualScore" name="Residual score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="Plan progress">
          {!plan ? <EmptyState compact title="No active audit plan" /> : <div className="space-y-3">
            <Progress value={planPct} tone="info" />
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-2xs uppercase tracking-wider text-muted-foreground">Completed</dt><dd className="font-semibold">{plan.completed}</dd></div>
              <div><dt className="text-2xs uppercase tracking-wider text-muted-foreground">In progress</dt><dd className="font-semibold">{plan.inProgress}</dd></div>
              <div><dt className="text-2xs uppercase tracking-wider text-muted-foreground">Planned</dt><dd className="font-semibold">{plan.byStatus.find((s) => s.status === 'PLANNED')?.count ?? 0}</dd></div>
              <div><dt className="text-2xs uppercase tracking-wider text-muted-foreground">Deferred</dt><dd className="font-semibold">{plan.byStatus.find((s) => s.status === 'DEFERRED')?.count ?? 0}</dd></div>
            </dl>
            {plan.planId ? (
              <Link href={`/plans/${plan.planId}`} className="text-xs font-medium text-primary hover:underline">
                Open plan
              </Link>
            ) : null}
          </div>}
        </Section>

        <Section title="Overdue actions by age" description="Open finding actions past their due date.">
          <ul className="space-y-2">
            {AGEING_BUCKETS.filter((b) => b !== 'NOT_DUE').map((bucket) => {
              const count = data.overdueActions.buckets.find((b) => b.bucket === bucket)?.count ?? 0;
              return (
                <li key={bucket} className="flex items-center gap-2">
                  <span className="w-20"><AgeingBadge bucket={bucket} /></span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-destructive/70" style={{ width: `${(count / maxBucket) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums">{count}</span>
                </li>
              );
            })}
          </ul>
          <Link href="/findings?overdue=true" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
            View overdue findings
          </Link>
        </Section>

        <Section title="Repeat findings" bodyClassName="p-0">
          {data.repeatFindings.items.length === 0 ? <EmptyState compact title="No repeat findings" /> : <ul className="divide-y divide-border">{data.repeatFindings.items.map((f) => <FindingRow key={f.id} f={f} />)}</ul>}
        </Section>

        <Section title="Key findings" description="High and critical findings currently open." bodyClassName="p-0" className="xl:col-span-3">
          {data.keyFindings.items.length === 0 ? <EmptyState compact title="No key findings" /> : <ul className="divide-y divide-border">{data.keyFindings.items.map((f) => <FindingRow key={f.id} f={f} />)}</ul>}
        </Section>
      </div>
    </div>
  );
}
