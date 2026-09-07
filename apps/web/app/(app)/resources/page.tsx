'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Clock3, Plus, Send, TimerReset, UserMinus, X } from 'lucide-react';
import { PageHeader, Section } from '@/components/shell/page-header';
import { StatTile } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GenericStatusBadge } from '@/components/domain/badges';
import { useCurrentUser, useCan } from '@/lib/auth';
import { useEngagements } from '@/lib/queries/engagements';
import {
  useApproveTimesheet,
  useCreateTimeEntry,
  useCurrentTimesheet,
  useDeleteTimeEntry,
  useResourceSummary,
  useSubmitTimesheet,
  useTimesheets,
} from '@/lib/queries/resources';
import { AVAILABILITY_TYPE_LABELS, TIMESHEET_STATUS_LABELS } from '@/lib/labels';
import { fmtDate, fmtHours, fmtNumber, fmtPct } from '@/lib/format';
import type { StaffAvailability, TimeEntry, Timesheet } from '@/lib/types';

const TODAY = new Date().toISOString().slice(0, 10);

function TimesheetStatus({ status }: { status?: string | null }) {
  const tone = status === 'APPROVED' ? 'success' : status === 'SUBMITTED' ? 'warning' : status === 'REJECTED' ? 'danger' : 'muted';
  return <GenericStatusBadge value={status} labels={TIMESHEET_STATUS_LABELS} tone={tone} />;
}

function EntryDialog({ sheet, open, onOpenChange }: { sheet?: Timesheet | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateTimeEntry(sheet?.id);
  const engagements = useEngagements({ status: 'ACTIVE', pageSize: 100 }, open);
  const summary = useResourceSummary(open);
  const codes = React.useMemo(() => summary.data?.chargeCodes ?? [], [summary.data?.chargeCodes]);
  const [draft, setDraft] = React.useState({ date: TODAY, chargeCodeId: '', engagementId: '', hours: '8', notes: '' });

  React.useEffect(() => {
    if (open) setDraft((s) => ({ ...s, chargeCodeId: s.chargeCodeId || codes[0]?.id || '' }));
  }, [codes, open]);

  const valid = !!sheet && !!draft.date && !!draft.chargeCodeId && Number(draft.hours) > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record time</DialogTitle></DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="te-date" required>
              <Input id="te-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </Field>
            <Field label="Hours" htmlFor="te-hours" required>
              <Input id="te-hours" type="number" min="0.25" max="24" step="0.25" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
            </Field>
          </div>
          <Field label="Charge code" htmlFor="te-code" required>
            <SimpleSelect id="te-code" value={draft.chargeCodeId} onValueChange={(v) => setDraft({ ...draft, chargeCodeId: v })} options={codes.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))} />
          </Field>
          <Field label="Engagement" htmlFor="te-eng">
            <SimpleSelect
              id="te-eng"
              value={draft.engagementId}
              onValueChange={(v) => setDraft({ ...draft, engagementId: v })}
              options={(engagements.data?.items ?? []).map((e) => ({ value: e.id, label: `${e.auditNumber} - ${e.title}` }))}
              allowClear
              clearLabel="No engagement"
              placeholder="No engagement"
            />
          </Field>
          <Field label="Notes" htmlFor="te-notes">
            <Textarea id="te-notes" rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={!valid}
            onClick={async () => {
              await create.mutateAsync({
                date: draft.date,
                chargeCodeId: draft.chargeCodeId,
                engagementId: draft.engagementId || null,
                hours: Number(draft.hours),
                notes: draft.notes || null,
              });
              onOpenChange(false);
            }}
          >
            <Plus /> Add entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CurrentWeek({ sheet }: { sheet?: Timesheet | null }) {
  const [entryOpen, setEntryOpen] = React.useState(false);
  const openCurrent = useCurrentTimesheet();
  const submit = useSubmitTimesheet();
  const removeEntry = useDeleteTimeEntry();
  const editable = sheet?.status === 'OPEN' || sheet?.status === 'REJECTED';
  const columns = React.useMemo<ColumnDef<TimeEntry, unknown>[]>(
    () => [
      { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => fmtDate(getValue<string>()), meta: { nowrap: true } },
      { id: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.chargeCode?.code ?? '-'}</span> },
      { id: 'engagement', header: 'Engagement', cell: ({ row }) => row.original.engagement ? <Link href={`/engagements/${row.original.engagement.id}`} className="hover:underline">{row.original.engagement.auditNumber}</Link> : '-' },
      { accessorKey: 'notes', header: 'Notes', cell: ({ getValue }) => <span className="line-clamp-2">{getValue<string | null>() ?? ''}</span> },
      { accessorKey: 'hours', header: 'Hours', meta: { align: 'right', width: '90px' }, cell: ({ getValue }) => fmtHours(getValue<number | string>()) },
      {
        id: 'actions',
        header: '',
        meta: { width: '44px', align: 'right' },
        cell: ({ row }) => editable ? <Button variant="ghost" size="icon-sm" aria-label="Remove entry" onClick={(e) => { e.stopPropagation(); removeEntry.mutate(row.original.id); }}><X /></Button> : null,
      },
    ],
    [editable, removeEntry],
  );

  return (
    <Section
      title="Current week"
      description={sheet ? `Week of ${fmtDate(sheet.weekStart)} - ${TIMESHEET_STATUS_LABELS[sheet.status]}` : 'Open a timesheet for the current week to begin recording time.'}
      actions={
        sheet ? (
          <>
            {editable ? <Button size="sm" variant="outline" onClick={() => setEntryOpen(true)}><Plus /> Entry</Button> : null}
            {editable ? <Button size="sm" loading={submit.isPending} disabled={Number(sheet.totalHours) <= 0} onClick={() => submit.mutate(sheet.id)}><Send /> Submit</Button> : null}
          </>
        ) : (
          <Button size="sm" onClick={() => openCurrent.mutate({})} loading={openCurrent.isPending}><Clock3 /> Open week</Button>
        )
      }
    >
      {sheet?.rejectReason ? <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{sheet.rejectReason}</p> : null}
      <DataTable
        columns={columns}
        data={sheet?.entries ?? []}
        hideToolbar
        dense
        emptyIcon={<TimerReset />}
        emptyTitle="No time recorded"
        emptyDescription="Record entries against charge codes and engagements."
        storageKey="current-timesheet"
      />
      <EntryDialog sheet={sheet} open={entryOpen} onOpenChange={setEntryOpen} />
    </Section>
  );
}

function TimesheetsTable() {
  const { user } = useCurrentUser();
  const can = useCan();
  const query = useTimesheets({ pageSize: 25, mine: !can('time:approve') });
  const approve = useApproveTimesheet();
  const columns = React.useMemo<ColumnDef<Timesheet, unknown>[]>(
    () => [
      { accessorKey: 'weekStart', header: 'Week', cell: ({ getValue }) => fmtDate(getValue<string>()), meta: { nowrap: true } },
      { id: 'user', header: 'Person', cell: ({ row }) => row.original.user?.displayName ?? '-' },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <TimesheetStatus status={getValue<string>()} /> },
      { accessorKey: 'totalHours', header: 'Hours', meta: { align: 'right' }, cell: ({ getValue }) => fmtHours(getValue<number | string>()) },
      { accessorKey: 'submittedAt', header: 'Submitted', cell: ({ getValue }) => fmtDate(getValue<string | null>()), meta: { nowrap: true } },
      {
        id: 'actions',
        header: '',
        meta: { width: '80px', align: 'right' },
        cell: ({ row }) => can('time:approve') && row.original.status === 'SUBMITTED' && row.original.userId !== user?.id ? (
          <Button size="sm" variant="outline" loading={approve.isPending} onClick={() => approve.mutate(row.original.id)}><Check /> Approve</Button>
        ) : null,
      },
    ],
    [approve, can, user?.id],
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
      hideToolbar
      emptyIcon={<Clock3 />}
      emptyTitle="No timesheets"
      storageKey="timesheets"
    />
  );
}

function AvailabilityList({ items }: { items?: StaffAvailability[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">No upcoming availability constraints.</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-medium">{a.user?.displayName ?? 'Unassigned'}</span>
            <span className="block truncate text-2xs text-muted-foreground">{fmtDate(a.startDate)} to {fmtDate(a.endDate)} - {fmtHours(a.hoursPerDay)} / day</span>
          </span>
          <Badge variant="outline">{AVAILABILITY_TYPE_LABELS[a.type]}</Badge>
        </li>
      ))}
    </ul>
  );
}

export default function ResourcesPage() {
  const summary = useResourceSummary();
  const data = summary.data;
  return (
    <>
      <PageHeader title="Resources" description="Timesheets, utilisation and audit team availability." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Current week" value={fmtHours(data?.currentTimesheet?.totalHours ?? 0)} icon={<TimerReset />} tone="primary" />
        <StatTile label="Utilisation" value={fmtPct(data?.utilisation.utilisationPct ?? 0)} hint={`${fmtHours(data?.utilisation.recordedHours ?? 0)} / ${fmtHours(data?.utilisation.capacityHours ?? 0)}`} icon={<Clock3 />} tone="success" />
        <StatTile label="Pending approvals" value={fmtNumber(data?.pendingApproval ?? 0)} icon={<Check />} tone="warning" />
        <StatTile label="Availability items" value={fmtNumber(data?.upcomingAvailability.length ?? 0)} icon={<UserMinus />} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <CurrentWeek sheet={data?.currentTimesheet} />
          <Section title="Timesheets"><TimesheetsTable /></Section>
        </div>
        <Section title="Upcoming availability">
          <AvailabilityList items={data?.upcomingAvailability} />
        </Section>
      </div>
    </>
  );
}
