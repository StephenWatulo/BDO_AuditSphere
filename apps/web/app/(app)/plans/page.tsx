'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarRange, Plus } from 'lucide-react';
import { PLAN_STATUSES } from '@auditsphere/shared';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect } from '@/components/ui/filter-chips';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlanStatusBadge } from '@/components/domain/badges';
import { Can } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useCreatePlan, usePlans } from '@/lib/queries/plans';
import { PLAN_STATUS_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, fmtHours } from '@/lib/format';
import type { AuditPlan } from '@/lib/types';

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  horizonYears: z.coerce.number().int().min(1).max(5),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalBudgetHours: z.coerce.number().min(0).optional(),
  currency: z.string().min(3).max(3),
  narrative: z.string().optional(),
});
type Values = z.infer<typeof schema>;

function NewPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const create = useCreatePlan();
  const year = new Date().getFullYear();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: `Annual audit plan ${year}`, fiscalYear: year, horizonYears: 1, startDate: `${year}-01-01`, endDate: `${year}-12-31`, currency: 'USD', narrative: '' } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>New audit plan</DialogTitle></DialogHeader>
        <Form {...form}>
          <form className="contents" onSubmit={form.handleSubmit(async (v) => { const plan = await create.mutateAsync({ ...v, narrative: v.narrative || null }); onOpenChange(false); router.push(`/plans/${plan.id}`); })}>
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel required>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="fiscalYear" render={({ field }) => (<FormItem><FormLabel required>Fiscal year</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="horizonYears" render={({ field }) => (<FormItem><FormLabel>Horizon (years)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel required>Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel required>End</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="totalBudgetHours" render={({ field }) => (<FormItem><FormLabel>Total budget hours</FormLabel><FormControl><Input type="number" min={0} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><Input maxLength={3} className="uppercase" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="narrative" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Narrative</FormLabel><FormControl><Textarea placeholder="Planning approach, risk assessment basis, key themes…" {...field} /></FormControl></FormItem>)} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Create plan</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', status: undefined as string | undefined };

export default function PlansPage() {
  const router = useRouter();
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = usePlans({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, status: state.status });
  const [open, setOpen] = React.useState(false);

  const columns = React.useMemo<ColumnDef<AuditPlan, unknown>[]>(() => [
    { accessorKey: 'fiscalYear', header: 'FY', meta: { width: '70px' } },
    { accessorKey: 'title', header: 'Plan', cell: ({ row }) => <span className="font-medium">{row.original.title}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <PlanStatusBadge status={getValue<string>()} /> },
    { accessorKey: 'version', header: 'Version', cell: ({ getValue }) => `v${getValue<number>()}`, meta: { align: 'center' } },
    { id: 'period', header: 'Period', cell: ({ row }) => `${fmtDate(row.original.startDate)} – ${fmtDate(row.original.endDate)}` },
    { accessorKey: 'itemCount', header: 'Items', cell: ({ getValue }) => getValue<number>() ?? '—', meta: { align: 'right' } },
    { accessorKey: 'totalBudgetHours', header: 'Budget', cell: ({ getValue }) => fmtHours(getValue<number>()), meta: { align: 'right' } },
    { id: 'approvedBy', header: 'Approved by', cell: ({ row }) => (row.original.approvedBy ? `${row.original.approvedBy.displayName} · ${fmtDate(row.original.approvedAt)}` : '—') },
  ], []);

  const chips = [];
  if (state.status) chips.push({ key: 'status', label: `Status: ${PLAN_STATUS_LABELS[state.status] ?? state.status}`, onRemove: () => set({ status: undefined }) });

  return (
    <>
      <PageHeader title="Audit plans" description="Risk-based annual and multi-year plans." actions={<Can permission="plan:manage"><Button onClick={() => setOpen(true)}><Plus /> New plan</Button></Can>} />
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
        toolbar={<ChipSelect label="Status" options={enumOptions(PLAN_STATUS_LABELS)} value={state.status} onChange={(v) => set({ status: v as string | undefined })} />}
        onRowClick={(p) => router.push(`/plans/${p.id}`)}
        emptyIcon={<CalendarRange />}
        emptyTitle="No audit plans"
        emptyDescription="Create the annual plan and populate it with risk-based items."
        storageKey="plans"
      />
      <NewPlanDialog open={open} onOpenChange={setOpen} />
      <span className="sr-only">{PLAN_STATUSES.length}</span>
    </>
  );
}
