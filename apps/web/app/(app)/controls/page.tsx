'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FlaskConical, Link2, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { PageHeader, DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleSelect } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect } from '@/components/ui/filter-chips';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { EffectivenessBadge, GenericStatusBadge, SeverityBadge } from '@/components/domain/badges';
import { UserPicker } from '@/components/domain/user-picker';
import { Can } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useControl, useControls, useCreateControl, useRecordControlTest, useSetControlRisks, useUpdateControl, type ControlTestInput } from '@/lib/queries/controls';
import { useRisks } from '@/lib/queries/risks';
import { CONTROL_EFFECTIVENESS_LABELS, CONTROL_TEST_RESULT_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, toInputDate } from '@/lib/format';
import { humanize } from '@/lib/utils';
import type { Control, ControlTestResult } from '@/lib/types';

const TYPES = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'DIRECTIVE'] as const;
const NATURES = ['MANUAL', 'AUTOMATED', 'IT_DEPENDENT_MANUAL'] as const;
const FREQUENCIES = ['CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'EVENT_DRIVEN'] as const;

const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional(),
  type: z.enum(TYPES),
  nature: z.enum(NATURES),
  frequency: z.enum(FREQUENCIES),
  isKeyControl: z.boolean(),
  ownerId: z.string().optional().nullable(),
});
type Values = z.infer<typeof schema>;

function ControlDialog({ open, onOpenChange, control }: { open: boolean; onOpenChange: (o: boolean) => void; control?: Control | null }) {
  const create = useCreateControl();
  const update = useUpdateControl(control?.id ?? '');
  const defaults = React.useCallback((): Values => ({ code: control?.code ?? '', title: control?.title ?? '', description: control?.description ?? '', type: control?.type ?? 'PREVENTIVE', nature: control?.nature ?? 'MANUAL', frequency: control?.frequency ?? 'MONTHLY', isKeyControl: control?.isKeyControl ?? false, ownerId: control?.ownerId ?? null }), [control]);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults() });
  React.useEffect(() => { if (open) form.reset(defaults()); }, [open, defaults, form]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{control ? `Edit ${control.code}` : 'New control'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form className="contents" onSubmit={form.handleSubmit(async (v) => { const p = { ...v, description: v.description || null }; if (control) await update.mutateAsync(p); else await create.mutateAsync(p); onOpenChange(false); })}>
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel required>Code</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="ownerId" render={({ field }) => (<FormItem><FormLabel>Control owner</FormLabel><FormControl><UserPicker value={field.value} onChange={(id) => field.onChange(id)} initial={control?.owner} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel required>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={TYPES.map((t) => ({ value: t, label: humanize(t) }))} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="nature" render={({ field }) => (<FormItem><FormLabel>Nature</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={NATURES.map((t) => ({ value: t, label: t === 'IT_DEPENDENT_MANUAL' ? 'IT-dependent manual' : humanize(t) }))} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="frequency" render={({ field }) => (<FormItem><FormLabel>Frequency</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={FREQUENCIES.map((t) => ({ value: t, label: humanize(t) }))} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="isKeyControl" render={({ field }) => (<FormItem className="flex items-center gap-2 pt-5"><FormControl><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} /></FormControl><FormLabel className="!mt-0">Key control</FormLabel></FormItem>)} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending || update.isPending}>{control ? 'Save' : 'Create control'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function LinkRisksDialog({ control, open, onOpenChange }: { control: Control; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = React.useState('');
  const risks = useRisks({ q, pageSize: 50 }, open);
  const setRisks = useSetControlRisks(control.id);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  React.useEffect(() => { if (open) setSelected(new Set((control.risks ?? []).map((r) => r.id))); }, [open, control.risks]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Link risks to {control.code}</DialogTitle><DialogDescription>Defines the risk-control matrix for this control.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search risks…" aria-label="Search risks" />
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {risks.isLoading ? <li className="p-3"><SkeletonRows rows={4} /></li> : (risks.data?.items ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                <Checkbox id={`lr-${r.id}`} checked={selected.has(r.id)} onCheckedChange={(c) => setSelected((s) => { const n = new Set(s); if (c) n.add(r.id); else n.delete(r.id); return n; })} />
                <Label htmlFor={`lr-${r.id}`} className="flex-1 truncate font-normal"><span className="font-mono text-2xs text-muted-foreground">{r.code}</span> {r.title}</Label>
                <SeverityBadge severity={r.rating} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{selected.size} selected</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={setRisks.isPending} onClick={async () => { await setRisks.mutateAsync({ riskIds: Array.from(selected) }); onOpenChange(false); }}>Save links</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({ control, open, onOpenChange }: { control: Control; open: boolean; onOpenChange: (o: boolean) => void }) {
  const record = useRecordControlTest(control.id);
  const [v, setV] = React.useState<ControlTestInput>({ testType: 'OPERATING', result: 'PASS', exceptions: 0, testedAt: toInputDate(new Date()) });
  React.useEffect(() => { if (open) setV({ testType: 'OPERATING', result: 'PASS', exceptions: 0, testedAt: toInputDate(new Date()) }); }, [open]);
  const num = (x?: number) => (x === undefined || Number.isNaN(x) ? undefined : x);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Record test for {control.code}</DialogTitle></DialogHeader>
        <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Test type</Label><SimpleSelect value={v.testType} onValueChange={(x) => setV({ ...v, testType: x as 'DESIGN' | 'OPERATING' })} options={[{ value: 'DESIGN', label: 'Design' }, { value: 'OPERATING', label: 'Operating effectiveness' }]} /></div>
          <div className="space-y-1.5"><Label>Result</Label><SimpleSelect value={v.result} onValueChange={(x) => setV({ ...v, result: x as ControlTestResult })} options={enumOptions(CONTROL_TEST_RESULT_LABELS)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-ps">Period start</Label><Input id="ct-ps" type="date" value={v.periodStart ?? ''} onChange={(e) => setV({ ...v, periodStart: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-pe">Period end</Label><Input id="ct-pe" type="date" value={v.periodEnd ?? ''} onChange={(e) => setV({ ...v, periodEnd: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-pop">Population</Label><Input id="ct-pop" type="number" min={0} value={v.populationSize ?? ''} onChange={(e) => setV({ ...v, populationSize: num(e.target.valueAsNumber) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-sam">Sample size</Label><Input id="ct-sam" type="number" min={0} value={v.sampleSize ?? ''} onChange={(e) => setV({ ...v, sampleSize: num(e.target.valueAsNumber) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-exc">Exceptions</Label><Input id="ct-exc" type="number" min={0} value={v.exceptions ?? 0} onChange={(e) => setV({ ...v, exceptions: num(e.target.valueAsNumber) ?? 0 })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ct-date">Tested on</Label><Input id="ct-date" type="date" value={v.testedAt ?? ''} onChange={(e) => setV({ ...v, testedAt: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ct-proc">Procedure</Label><Textarea id="ct-proc" value={v.procedure ?? ''} onChange={(e) => setV({ ...v, procedure: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ct-con">Conclusion</Label><Textarea id="ct-con" value={v.conclusion ?? ''} onChange={(e) => setV({ ...v, conclusion: e.target.value })} /></div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={record.isPending} onClick={async () => { await record.mutateAsync({ ...v, periodStart: v.periodStart || undefined, periodEnd: v.periodEnd || undefined, testedAt: v.testedAt ? new Date(v.testedAt).toISOString() : undefined }); onOpenChange(false); }}>Record test</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ControlPanel({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (c: Control) => void }) {
  const { data, isLoading, error, refetch } = useControl(id);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [testOpen, setTestOpen] = React.useState(false);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent size="lg">
        {isLoading ? <div className="p-5"><Skeleton className="mb-3 h-6 w-2/3" /><SkeletonRows rows={6} /></div> : error || !data ? <ErrorState error={error} onRetry={() => refetch()} /> : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2"><SheetTitle className="truncate">{data.title}</SheetTitle><EffectivenessBadge value={data.effectiveness} />{data.isKeyControl ? <Badge variant="accent">Key</Badge> : null}</div>
              <SheetDescription><span className="font-mono">{data.code}</span> · {humanize(data.type)} · {humanize(data.nature)} · {humanize(data.frequency)}</SheetDescription>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Can permission="control:manage"><Button size="sm" variant="outline" onClick={() => onEdit(data)}><Pencil /> Edit</Button><Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}><Link2 /> Link risks</Button></Can>
                <Can permission="control:test"><Button size="sm" onClick={() => setTestOpen(true)}><FlaskConical /> Record test</Button></Can>
              </div>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <dl className="grid grid-cols-2 gap-3">
                <DescriptionItem label="Owner">{data.owner?.displayName ?? '—'}</DescriptionItem>
                <DescriptionItem label="Process">{data.process?.name ?? '—'}</DescriptionItem>
                <DescriptionItem label="Design effective">{data.designEffective === null || data.designEffective === undefined ? '—' : data.designEffective ? 'Yes' : 'No'}</DescriptionItem>
                <DescriptionItem label="Operating effective">{data.operatingEffective === null || data.operatingEffective === undefined ? '—' : data.operatingEffective ? 'Yes' : 'No'}</DescriptionItem>
                <DescriptionItem label="Last tested">{fmtDate(data.lastTestedAt)}</DescriptionItem>
                <DescriptionItem label="Framework refs">{data.frameworkReferences?.length ? data.frameworkReferences.map((f) => `${f.framework} ${f.ref}`).join(', ') : '—'}</DescriptionItem>
                <DescriptionItem label="Description" className="col-span-2"><span className="whitespace-pre-wrap">{data.description || '—'}</span></DescriptionItem>
              </dl>
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Mitigated risks</p>
                {data.risks?.length ? <ul className="divide-y divide-border rounded-md border border-border">{data.risks.map((r) => <li key={r.id} className="flex items-center justify-between px-3 py-1.5 text-sm"><span><span className="font-mono text-2xs text-muted-foreground">{r.code}</span> {r.title}</span><SeverityBadge severity={r.rating} /></li>)}</ul> : <EmptyState compact title="No risks linked" />}
              </div>
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Test history</p>
                {data.tests?.length ? <ul className="divide-y divide-border rounded-md border border-border">{data.tests.map((t) => <li key={t.id} className="px-3 py-2 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{t.testType === 'DESIGN' ? 'Design' : 'Operating'} test</span><GenericStatusBadge value={t.result} labels={CONTROL_TEST_RESULT_LABELS} tone={t.result === 'PASS' ? 'success' : t.result === 'FAIL' ? 'danger' : 'warning'} /></div><p className="text-2xs text-muted-foreground">{fmtDate(t.testedAt ?? t.createdAt)}{t.testedBy ? ` · ${t.testedBy.displayName}` : ''}{t.sampleSize ? ` · sample ${t.sampleSize}` : ''}{t.exceptions ? ` · ${t.exceptions} exceptions` : ''}</p>{t.conclusion ? <p className="mt-1 text-xs">{t.conclusion}</p> : null}</li>)}</ul> : <EmptyState compact title="No tests recorded" />}
              </div>
            </SheetBody>
            <LinkRisksDialog control={data} open={linkOpen} onOpenChange={setLinkOpen} />
            <TestDialog control={data} open={testOpen} onOpenChange={setTestOpen} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', type: undefined as string | undefined, nature: undefined as string | undefined, effectiveness: undefined as string | string[] | undefined };

export default function ControlsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('control');
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = useControls({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, type: state.type, nature: state.nature, effectiveness: state.effectiveness });
  const [dialog, setDialog] = React.useState<{ open: boolean; control?: Control | null }>({ open: false });

  const columns = React.useMemo<ColumnDef<Control, unknown>[]>(() => [
    { accessorKey: 'code', header: 'Code', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '90px' } },
    { accessorKey: 'title', header: 'Control', cell: ({ row }) => (<div className="min-w-0"><p className="truncate font-medium">{row.original.title} {row.original.isKeyControl ? <Badge variant="accent" className="ml-1">Key</Badge> : null}</p><p className="truncate text-2xs text-muted-foreground">{row.original.process?.name ?? ''}</p></div>) },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => humanize(getValue<string>()) },
    { accessorKey: 'nature', header: 'Nature', cell: ({ getValue }) => (getValue<string>() === 'IT_DEPENDENT_MANUAL' ? 'IT-dependent manual' : humanize(getValue<string>())) },
    { accessorKey: 'frequency', header: 'Frequency', cell: ({ getValue }) => humanize(getValue<string>()) },
    { accessorKey: 'effectiveness', header: 'Effectiveness', cell: ({ getValue }) => <EffectivenessBadge value={getValue<Control['effectiveness']>()} /> },
    { id: 'owner', header: 'Owner', cell: ({ row }) => row.original.owner?.displayName ?? '—' },
    { accessorKey: 'lastTestedAt', header: 'Last tested', cell: ({ getValue }) => fmtDate(getValue<string>()) },
  ], []);

  const chips = [];
  if (state.type) chips.push({ key: 'type', label: `Type: ${humanize(state.type)}`, onRemove: () => set({ type: undefined }) });
  if (state.nature) chips.push({ key: 'nature', label: `Nature: ${humanize(state.nature)}`, onRemove: () => set({ nature: undefined }) });
  if (state.effectiveness) chips.push({ key: 'eff', label: `Effectiveness: ${(Array.isArray(state.effectiveness) ? state.effectiveness : [state.effectiveness]).map((e) => CONTROL_EFFECTIVENESS_LABELS[e as Control['effectiveness']] ?? e).join(', ')}`, onRemove: () => set({ effectiveness: undefined }) });

  const select = (id: string | null) => { const sp = new URLSearchParams(params.toString()); if (id) sp.set('control', id); else sp.delete('control'); router.replace(`/controls${sp.toString() ? `?${sp}` : ''}`, { scroll: false }); };

  return (
    <>
      <PageHeader title="Controls" description="Control library, risk-control matrix and test results." actions={<Can permission="control:manage"><Button onClick={() => setDialog({ open: true, control: null })}><Plus /> New control</Button></Can>} />
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
        searchPlaceholder="Search controls…"
        chips={chips}
        onClearFilters={reset}
        toolbar={<>
          <ChipSelect label="Type" options={TYPES.map((t) => ({ value: t, label: humanize(t) }))} value={state.type} onChange={(v) => set({ type: v as string | undefined })} />
          <ChipSelect label="Nature" options={NATURES.map((t) => ({ value: t, label: humanize(t) }))} value={state.nature} onChange={(v) => set({ nature: v as string | undefined })} />
          <ChipSelect label="Effectiveness" multiple options={enumOptions(CONTROL_EFFECTIVENESS_LABELS)} value={state.effectiveness} onChange={(v) => set({ effectiveness: v })} />
        </>}
        onRowClick={(c) => select(c.id)}
        emptyIcon={<ShieldCheck />}
        emptyTitle="No controls"
        emptyDescription="Add controls and link them to risks to build the risk-control matrix."
        storageKey="controls"
      />
      {selectedId ? <ControlPanel id={selectedId} onClose={() => select(null)} onEdit={(c) => setDialog({ open: true, control: c })} /> : null}
      <ControlDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} control={dialog.control} />
    </>
  );
}
