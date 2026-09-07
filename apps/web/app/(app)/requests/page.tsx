'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Inbox, Paperclip, Plus } from 'lucide-react';
import { REQUEST_STATUSES } from '@auditsphere/shared';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect, Segmented } from '@/components/ui/filter-chips';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/avatar';
import { RequestStatusBadge } from '@/components/domain/badges';
import { UserPicker } from '@/components/domain/user-picker';
import { Can, useCan } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useCreateRequest, useRequests } from '@/lib/queries/requests';
import { useEngagements } from '@/lib/queries/engagements';
import { REQUEST_STATUS_LABELS } from '@/lib/labels';
import { fmtDate, fmtDueIn, isOverdue } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DocumentRequest } from '@/lib/types';

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', status: undefined as string | string[] | undefined, view: 'mine', new: false };

function NewRequestDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (r: DocumentRequest) => void }) {
  const create = useCreateRequest();
  const engagements = useEngagements({ pageSize: 200, sort: 'auditNumber:desc' }, open);
  const [v, setV] = React.useState<{ engagementId: string; title: string; description: string; dueDate: string; assigneeId: string | null; assigneeEmail: string }>({ engagementId: '', title: '', description: '', dueDate: '', assigneeId: null, assigneeEmail: '' });
  React.useEffect(() => { if (open) setV({ engagementId: '', title: '', description: '', dueDate: '', assigneeId: null, assigneeEmail: '' }); }, [open]);
  const options = (engagements.data?.items ?? []).filter((e) => e.stage !== 'CLOSED').map((e) => ({ value: e.id, label: `${e.auditNumber} · ${e.title}` }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New document request</DialogTitle><DialogDescription>The assignee is notified and reminded before the due date.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1.5"><Label required>Engagement</Label><SimpleSelect value={v.engagementId} onValueChange={(id) => setV({ ...v, engagementId: id })} options={options} placeholder={engagements.isLoading ? 'Loading…' : 'Select engagement'} /></div>
          <div className="space-y-1.5"><Label htmlFor="rq-title" required>Title</Label><Input id="rq-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Fixed asset register as at 30 June" /></div>
          <div className="space-y-1.5"><Label htmlFor="rq-desc">Description</Label><Textarea id="rq-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="What is needed, period, format…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="rq-due" required>Due date</Label><Input id="rq-due" type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="rq-email">Assignee email</Label><Input id="rq-email" type="email" value={v.assigneeEmail} onChange={(e) => setV({ ...v, assigneeEmail: e.target.value })} placeholder="If not a platform user" /></div>
          </div>
          <div className="space-y-1.5"><Label>Assignee</Label><UserPicker value={v.assigneeId} onChange={(id) => setV({ ...v, assigneeId: id })} /></div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={create.isPending} disabled={!v.engagementId || !v.title.trim() || !v.dueDate} onClick={async () => { const r = await create.mutateAsync({ engagementId: v.engagementId, title: v.title.trim(), description: v.description || null, dueDate: new Date(v.dueDate).toISOString(), assigneeId: v.assigneeId, assigneeEmail: v.assigneeEmail || null }); onOpenChange(false); onCreated(r); }}>Raise request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestsTable() {
  const router = useRouter();
  const can = useCan();
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const view = state.view === 'all' && can('request:manage') ? 'all' : 'mine';
  const query = useRequests({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, status: state.status, mine: view === 'mine' });
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { if (state.new) { setOpen(true); set({ new: false }); } }, [state.new, set]);

  const columns = React.useMemo<ColumnDef<DocumentRequest, unknown>[]>(
    () => [
      { accessorKey: 'reference', header: 'Ref', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '90px', nowrap: true } },
      {
        accessorKey: 'title',
        header: 'Request',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/requests/${row.original.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.title}</Link>
            {row.original.description ? <p className="truncate text-2xs text-muted-foreground">{row.original.description}</p> : null}
          </div>
        ),
      },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <RequestStatusBadge status={getValue<string>()} /> },
      {
        accessorKey: 'dueDate',
        header: 'Due',
        cell: ({ row }) => {
          const active = row.original.status === 'OPEN' || row.original.status === 'RETURNED';
          const late = active && isOverdue(row.original.dueDate);
          return (
            <span className={cn(late && 'text-destructive')}>
              {fmtDate(row.original.dueDate)}
              {active ? <span className="block text-2xs text-muted-foreground">{fmtDueIn(row.original.dueDate)}</span> : null}
            </span>
          );
        },
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => (row.original.assignee ? <span className="flex items-center gap-1.5"><UserAvatar name={row.original.assignee.displayName} src={row.original.assignee.avatarUrl} size="xs" />{row.original.assignee.displayName}</span> : row.original.assigneeEmail ?? <span className="text-muted-foreground">Unassigned</span>),
      },
      { id: 'requestedBy', header: 'Requested by', cell: ({ row }) => row.original.requestedBy?.displayName ?? '—' },
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
      { id: 'docs', header: 'Docs', meta: { align: 'right' }, cell: ({ row }) => { const n = row.original.documents?.length ?? 0; return n ? <span className="inline-flex items-center gap-1"><Paperclip className="size-3 text-muted-foreground" />{n}</span> : <span className="text-muted-foreground">0</span>; } },
    ],
    [],
  );

  const chips = [];
  if (state.status) chips.push({ key: 'status', label: `Status: ${(Array.isArray(state.status) ? state.status : [state.status]).map((s) => REQUEST_STATUS_LABELS[s] ?? s).join(', ')}`, onRemove: () => set({ status: undefined }) });

  return (
    <>
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
        searchPlaceholder="Search requests…"
        chips={chips}
        onClearFilters={reset}
        toolbar={
          <>
            {can('request:manage') ? <Segmented aria-label="Scope" value={view} onChange={(v) => set({ view: v })} options={[{ value: 'mine', label: 'My requests' }, { value: 'all', label: 'All requests' }]} /> : null}
            <ChipSelect label="Status" multiple options={REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] ?? s }))} value={state.status} onChange={(v) => set({ status: v })} />
          </>
        }
        actions={<Can permission="request:manage"><Button size="sm" onClick={() => setOpen(true)}><Plus /> New request</Button></Can>}
        onRowClick={(r) => router.push(`/requests/${r.id}`)}
        emptyIcon={<Inbox />}
        emptyTitle={view === 'mine' ? 'No requests assigned to you' : 'No document requests'}
        emptyDescription={view === 'mine' ? 'Requests for documents or information assigned to you appear here.' : 'Raise requests from an engagement or directly from this page.'}
        emptyAction={<Can permission="request:manage"><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus /> New request</Button></Can>}
        storageKey="requests"
        initialHidden={['requestedBy']}
      />
      <NewRequestDialog open={open} onOpenChange={setOpen} onCreated={(r) => router.push(`/requests/${r.id}`)} />
    </>
  );
}

export default function RequestsPage() {
  return (
    <>
      <PageHeader title="Document requests" description="Information and documents requested from the business, tracked to acceptance." />
      <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <RequestsTable />
      </React.Suspense>
    </>
  );
}
