'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Briefcase, Clock, Users } from 'lucide-react';
import { ENGAGEMENT_STAGES, STAGE_LABELS } from '@auditsphere/shared';
import { StatTile } from '@/components/ui/card';
import { Section } from '@/components/shell/page-header';
import { Progress } from '@/components/ui/progress';
import { SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { usePartnerDashboard } from '@/lib/queries/dashboards';
import { fmtDate, fmtHours, fmtPct } from '@/lib/format';
import { cn, pct } from '@/lib/utils';

const tooltipStyle = {
  contentStyle: { background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: 'var(--foreground)' },
  itemStyle: { color: 'var(--foreground)' },
};

export function PartnerDashboard() {
  const { data, isLoading, error, refetch } = usePartnerDashboard();

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

  const byStage = ENGAGEMENT_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: data.engagementsByStage.find((s) => s.stage === stage)?.count ?? 0,
  }));
  const active = byStage.filter((s) => s.stage !== 'CLOSED').reduce((a, b) => a + b.count, 0);
  const totalBudget = data.budgetVsActual.reduce((a, b) => a + (b.budgetHours ?? 0), 0);
  const totalActual = data.budgetVsActual.reduce((a, b) => a + (b.actualHours ?? 0), 0);
  const measuredStaff = data.utilisation.items.filter((u) => u.utilisationPct !== null);
  const avgUtil = measuredStaff.length
    ? measuredStaff.reduce((a, b) => a + (b.utilisationPct ?? 0), 0) / measuredStaff.length
    : null;
  const overBudget = data.budgetVsActual.filter((b) => b.actualHours > b.budgetHours).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active engagements" value={active} icon={<Briefcase />} />
        <StatTile label="Hours: actual vs budget" value={`${fmtPct(pct(totalActual, totalBudget))}`} hint={`${fmtHours(totalActual)} of ${fmtHours(totalBudget)}`} icon={<Clock />} tone={totalActual > totalBudget ? 'danger' : 'default'} />
        <StatTile label="Average utilisation" value={fmtPct(avgUtil)} icon={<Users />} tone={avgUtil === null ? 'default' : avgUtil < 60 ? 'warning' : 'success'} />
        <StatTile label="Overdue milestones" value={data.overdueMilestones.count} hint={overBudget ? `${overBudget} engagements over budget` : undefined} icon={<AlertTriangle />} tone={data.overdueMilestones.count ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Engagements by stage">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStage} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="count" name="Engagements" radius={[3, 3, 0, 0]}>
                  {byStage.map((s) => (
                    <Cell key={s.stage} fill={s.stage === 'CLOSED' ? 'var(--muted-foreground)' : 'var(--primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Budget vs actual hours" description="Top engagements by budgeted hours.">
          {data.budgetVsActual.length === 0 ? (
            <EmptyState compact title="No engagements with budgets" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.budgetVsActual.slice(0, 8)} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="auditNumber" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budgetHours" name="Budget" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actualHours" name="Actual" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="Staff utilisation" bodyClassName="p-0">
          {data.utilisation.items.length === 0 ? (
            <EmptyState compact title="No utilisation data" />
          ) : (
            <ul className="divide-y divide-border">
              {data.utilisation.items.map((u) => (
                <li key={u.userId} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-40 truncate text-sm">{u.displayName}</span>
                  <Progress value={u.utilisationPct} className="flex-1" tone={u.utilisationPct === null ? 'neutral' : u.utilisationPct > 100 ? 'danger' : u.utilisationPct < 60 ? 'warning' : 'success'} size="sm" />
                  <span className="w-12 text-right text-xs tabular-nums">{fmtPct(u.utilisationPct)}</span>
                  <span className="hidden w-24 text-right text-2xs text-muted-foreground sm:block">{fmtHours(u.recordedHours)} / {fmtHours(u.capacityHours)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Overdue milestones" bodyClassName="p-0">
          {data.overdueMilestones.items.length === 0 ? (
            <EmptyState compact title="No overdue milestones" />
          ) : (
            <ul className="divide-y divide-border">
              {data.overdueMilestones.items.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <Link href={`/engagements/${m.engagement.id}`} className="text-2xs text-muted-foreground hover:underline">
                      {m.engagement.auditNumber} · {m.engagement.title}
                    </Link>
                  </div>
                  <span className={cn('shrink-0 text-xs text-destructive')}>
                    {fmtDate(m.dueDate)}
                    {m.daysOverdue ? ` · ${m.daysOverdue}d late` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
