'use client';

import Link from 'next/link';
import { ArrowUpRight, Link2 } from 'lucide-react';
import { DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/form';
import { SimpleSelect } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SkeletonRows } from '@/components/ui/skeleton';
import { GenericStatusBadge, SeverityBadge } from '@/components/domain/badges';
import { UserPicker } from '@/components/domain/user-picker';
import { useCan } from '@/lib/auth';
import { fmtDateTime, fmtNumber } from '@/lib/format';
import { MONITORING_ALERT_STATUS_LABELS } from '@/lib/labels';
import { useMonitoringAlert, useUpdateMonitoringAlert } from '@/lib/queries/monitoring';
import { copyToClipboard, humanize } from '@/lib/utils';

const STATUSES = Object.entries(MONITORING_ALERT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

function DetailValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">Not recorded</span>;
  if (typeof value === 'boolean') return <>{value ? 'Yes' : 'No'}</>;
  if (typeof value === 'number') return <>{fmtNumber(value, Number.isInteger(value) ? 0 : 2)}</>;
  if (Array.isArray(value) && value.every((item) => item === null || typeof item !== 'object')) {
    return value.length ? <ul className="space-y-1">{value.map((item, index) => <li key={index}><DetailValue value={item} /></li>)}</ul> : <span className="text-muted-foreground">None</span>;
  }
  if (typeof value === 'object') return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>;
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

function AlertDetails({ detail }: { detail: unknown }) {
  if (detail === null || detail === undefined || detail === '' || (typeof detail === 'object' && !Object.keys(detail).length)) return <p className="text-sm text-muted-foreground">No transaction details recorded.</p>;
  if (typeof detail !== 'object' || Array.isArray(detail)) return <DetailValue value={detail} />;
  return <dl className="space-y-4">{Object.entries(detail).map(([key, value]) => <DescriptionItem key={key} label={humanize(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))} className="break-words"><DetailValue value={value} /></DescriptionItem>)}</dl>;
}

export function MonitoringAlertPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useMonitoringAlert(id);
  const update = useUpdateMonitoringAlert();
  const can = useCan();
  const canManage = can('monitoring:manage');
  return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent size="lg" onCloseAutoFocus={(event) => {
      event.preventDefault();
      document.getElementById(`monitoring-alert-${id}`)?.focus();
    }}>
      <SheetHeader className="max-h-[40vh] shrink-0 overflow-y-auto">
        <SheetTitle className="break-words">{data?.title ?? 'Monitoring alert'}</SheetTitle>
        <SheetDescription>{data?.rule ? `${data.rule.code} - ${data.rule.name}` : 'Alert details'}</SheetDescription>
        {data && !error ? <div className="mt-2 flex flex-wrap items-center gap-2">
          <SeverityBadge severity={data.rule?.severity} />
          <GenericStatusBadge value={data.status} labels={MONITORING_ALERT_STATUS_LABELS} />
          <Button variant="ghost" size="icon-sm" aria-label="Copy alert link" title="Copy alert link" onClick={() => void copyToClipboard(window.location.href)}><Link2 /></Button>
        </div> : null}
      </SheetHeader>
      <SheetBody className="min-h-0 space-y-5">
        {isLoading ? <div role="status" aria-label="Loading alert"><SkeletonRows rows={6} /></div> : error || !data ? <ErrorState error={error} title="Could not load alert" onRetry={() => void refetch()} /> : <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="monitoring-alert-status">
              {canManage ? <SimpleSelect id="monitoring-alert-status" value={data.status} disabled={update.isPending} options={STATUSES} onValueChange={(status) => update.mutate({ id, status })} /> : <p className="text-sm">{MONITORING_ALERT_STATUS_LABELS[data.status]}</p>}
            </Field>
            <Field label="Assignee" htmlFor="monitoring-alert-assignee">
              {canManage ? <UserPicker id="monitoring-alert-assignee" value={data.assigneeId} initial={data.assignee} disabled={update.isPending} placeholder="Unassigned" onChange={(assigneeId) => update.mutate({ id, assigneeId })} /> : <p className="text-sm">{data.assignee?.displayName ?? 'Unassigned'}</p>}
            </Field>
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DescriptionItem label="Amount">{fmtNumber(data.amount, 2)}</DescriptionItem>
            <DescriptionItem label="Detected">{fmtDateTime(data.detectedAt)}</DescriptionItem>
            <DescriptionItem label="Resolved">{data.resolvedAt ? fmtDateTime(data.resolvedAt) : 'Not resolved'}</DescriptionItem>
            {data.findingId && can('finding:read') ? <DescriptionItem label="Linked finding"><Link href={`/findings/${data.findingId}`} className="inline-flex items-center gap-1 text-primary hover:underline">Open finding<ArrowUpRight className="size-3.5" /></Link></DescriptionItem> : null}
          </dl>
          <section className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold">Transaction details</h3>
            <AlertDetails detail={data.detail} />
          </section>
          <section className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold">Monitoring rule</h3>
            {data.rule ? <div className="space-y-3">
              <p className="break-words text-sm font-medium">{data.rule.code} - {data.rule.name}</p>
              {data.rule.description ? <p className="whitespace-pre-wrap break-words text-sm">{data.rule.description}</p> : null}
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DescriptionItem label="Rule type"><span className="break-words">{humanize(data.rule.ruleType)}</span></DescriptionItem>
                <DescriptionItem label="Connector"><span className="break-words">{data.rule.connector?.name ?? 'No connector linked'}</span></DescriptionItem>
              </dl>
            </div> : <p className="text-sm text-muted-foreground">Rule details unavailable.</p>}
          </section>
        </>}
      </SheetBody>
    </SheetContent>
  </Sheet>;
}
