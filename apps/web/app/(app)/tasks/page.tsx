'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, ListTodo, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { ChipSelect, ToggleChip } from '@/components/ui/filter-chips';
import { GenericStatusBadge } from '@/components/domain/badges';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { UserPicker } from '@/components/domain/user-picker';
import { useCreateTask, useTasks, useUpdateTask } from '@/lib/queries/collaboration';
import { useListParams } from '@/lib/hooks/use-list-params';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, fmtDueIn, isOverdue } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', status: undefined as string | string[] | undefined, mine: true };

export default function TasksPage() {
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = useTasks({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, status: state.status, mine: state.mine });
  const update = useUpdateTask();
  const create = useCreateTask();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ title: string; description: string; dueDate: string; priority: string; assigneeId: string | null }>({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM',
    assigneeId: null,
  });

  const columns = React.useMemo<ColumnDef<Task, unknown>[]>(
    () => [
      {
        id: 'done',
        header: '',
        enableHiding: false,
        meta: { width: '36px' },
        cell: ({ row }) => (
          <button
            type="button"
            aria-label={row.original.status === 'DONE' ? 'Reopen task' : 'Mark done'}
            className={cn('rounded-full text-muted-foreground hover:text-success', row.original.status === 'DONE' && 'text-success')}
            onClick={(e) => {
              e.stopPropagation();
              update.mutate({ id: row.original.id, status: row.original.status === 'DONE' ? 'TODO' : 'DONE' });
            }}
          >
            <CheckCircle2 className="size-4" />
          </button>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Task',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className={cn('font-medium', row.original.status === 'DONE' && 'text-muted-foreground line-through')}>{row.original.title}</p>
            {row.original.engagement ? (
              <Link href={`/engagements/${row.original.engagement.id}`} className="text-2xs text-muted-foreground hover:underline" onClick={(e) => e.stopPropagation()}>
                {row.original.engagement.auditNumber} · {row.original.engagement.title}
              </Link>
            ) : null}
          </div>
        ),
      },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <GenericStatusBadge value={getValue<string>()} labels={TASK_STATUS_LABELS} /> },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ getValue }) => (
          <GenericStatusBadge
            value={getValue<string>()}
            labels={TASK_PRIORITY_LABELS}
            tone={getValue<string>() === 'URGENT' ? 'danger' : getValue<string>() === 'HIGH' ? 'warning' : 'muted'}
          />
        ),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due',
        cell: ({ row }) => (
          <span className={cn(isOverdue(row.original.dueDate) && row.original.status !== 'DONE' && 'text-destructive')}>
            {fmtDate(row.original.dueDate)}
            {row.original.dueDate ? <span className="block text-2xs text-muted-foreground">{fmtDueIn(row.original.dueDate)}</span> : null}
          </span>
        ),
      },
      { id: 'assignee', header: 'Assignee', cell: ({ row }) => row.original.assignee?.displayName ?? '—' },
    ],
    [update],
  );

  const chips = [];
  if (state.status) chips.push({ key: 'status', label: `Status: ${(Array.isArray(state.status) ? state.status : [state.status]).map((s) => TASK_STATUS_LABELS[s as keyof typeof TASK_STATUS_LABELS] ?? s).join(', ')}`, onRemove: () => set({ status: undefined }) });

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Work items assigned to you or raised on your engagements."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New task
          </Button>
        }
      />
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
        chips={chips}
        onClearFilters={reset}
        toolbar={
          <>
            <ToggleChip label="Mine" checked={!!state.mine} onChange={(v) => set({ mine: v })} />
            <ChipSelect label="Status" multiple options={enumOptions(TASK_STATUS_LABELS)} value={state.status} onChange={(v) => set({ status: v })} />
          </>
        }
        emptyIcon={<ListTodo />}
        emptyTitle="No tasks"
        emptyDescription="Tasks created on engagements and assigned to you will show here."
        storageKey="tasks"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Title" required htmlFor="t-title">
              <Input id="t-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="t-desc">
              <Textarea id="t-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due date" htmlFor="t-due">
                <Input id="t-due" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </Field>
              <Field label="Priority" htmlFor="t-pri">
                <SimpleSelect id="t-pri" value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v })} options={enumOptions(TASK_PRIORITY_LABELS)} />
              </Field>
            </div>
            <Field label="Assignee" htmlFor="t-assignee">
              <UserPicker id="t-assignee" value={draft.assigneeId} onChange={(id) => setDraft({ ...draft, assigneeId: id })} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              disabled={!draft.title.trim()}
              onClick={async () => {
                await create.mutateAsync({
                  title: draft.title.trim(),
                  description: draft.description || undefined,
                  dueDate: draft.dueDate || undefined,
                  priority: draft.priority as Task['priority'],
                  assigneeId: draft.assigneeId ?? undefined,
                });
                setOpen(false);
                setDraft({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assigneeId: null });
              }}
            >
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
