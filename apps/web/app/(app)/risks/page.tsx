'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, Gauge, Pencil, Plus } from 'lucide-react';
import { DEFAULT_THRESHOLDS, SEVERITIES, scoreRisk, type RiskInput as ScoreInput } from '@auditsphere/shared';
import { PageHeader, DescriptionItem, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SimpleSelect } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect } from '@/components/ui/filter-chips';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { HeatMap, HeatMapLegend } from '@/components/domain/heat-map';
import { SeverityBadge, GenericStatusBadge } from '@/components/domain/badges';
import { UserPicker } from '@/components/domain/user-picker';
import { EntityPicker } from '@/components/domain/entity-picker';
import { Can } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useAssessRisk, useCreateRisk, useRisk, useRiskCategories, useRiskHeatmap, useRisks, useScoringModels, useUpdateRisk } from '@/lib/queries/risks';
import { fmtDate, fmtNumber } from '@/lib/format';
import { humanize } from '@/lib/utils';
import type { Risk, RiskVelocity } from '@/lib/types';

const VELOCITIES: RiskVelocity[] = ['SLOW', 'MODERATE', 'FAST', 'IMMEDIATE'];
const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

const riskSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  source: z.string().optional(),
  status: z.enum(['ACTIVE', 'MONITORING', 'RETIRED']),
  inherentLikelihood: z.coerce.number().int().min(1).max(5),
  inherentImpact: z.coerce.number().int().min(1).max(5),
  controlEffectiveness: z.coerce.number().int().min(1).max(5),
  velocity: z.enum(['SLOW', 'MODERATE', 'FAST', 'IMMEDIATE']),
  appetiteThreshold: z.coerce.number().optional(),
});
type RiskValues = z.infer<typeof riskSchema>;

function ScorePreview({ input, thresholds }: { input: ScoreInput; thresholds?: typeof DEFAULT_THRESHOLDS }) {
  const result = React.useMemo(() => {
    try {
      return scoreRisk(input, undefined, thresholds);
    } catch {
      return null;
    }
  }, [input, thresholds]);
  if (!result) return null;
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live score preview</p>
        <SeverityBadge severity={result.rating} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-2xs text-muted-foreground">Inherent</p><p className="text-lg font-semibold tabular-nums">{result.inherentScore}</p></div>
        <div><p className="text-2xs text-muted-foreground">Residual L × I</p><p className="text-lg font-semibold tabular-nums">{result.residualLikelihood} × {result.residualImpact}</p></div>
        <div><p className="text-2xs text-muted-foreground">Residual</p><p className="text-lg font-semibold tabular-nums text-primary">{result.residualScore}</p></div>
      </div>
      {result.withinAppetite !== null ? (
        <p className={`mt-2 text-center text-xs ${result.withinAppetite ? 'text-success' : 'text-destructive'}`}>
          {result.withinAppetite ? 'Within risk appetite' : 'Exceeds risk appetite'}
        </p>
      ) : null}
    </div>
  );
}

function RiskDialog({ open, onOpenChange, risk }: { open: boolean; onOpenChange: (o: boolean) => void; risk?: Risk | null }) {
  const create = useCreateRisk();
  const update = useUpdateRisk(risk?.id ?? '');
  const categories = useRiskCategories();
  const models = useScoringModels();
  const thresholds = models.data?.find((m) => m.isDefault)?.thresholds ?? DEFAULT_THRESHOLDS;
  const defaults = React.useCallback(
    (): RiskValues => ({
      code: risk?.code ?? '',
      title: risk?.title ?? '',
      description: risk?.description ?? '',
      categoryId: risk?.categoryId ?? null,
      entityId: risk?.entityId ?? null,
      ownerId: risk?.ownerId ?? null,
      source: risk?.source ?? '',
      status: risk?.status ?? 'ACTIVE',
      inherentLikelihood: risk?.inherentLikelihood ?? 3,
      inherentImpact: risk?.inherentImpact ?? 3,
      controlEffectiveness: risk?.controlEffectiveness ?? 3,
      velocity: risk?.velocity ?? 'MODERATE',
      appetiteThreshold: risk?.appetiteThreshold ? Number(risk.appetiteThreshold) : undefined,
    }),
    [risk],
  );
  const form = useForm<RiskValues>({ resolver: zodResolver(riskSchema), defaultValues: defaults() });
  React.useEffect(() => {
    if (open) form.reset(defaults());
  }, [open, defaults, form]);
  const w = form.watch();

  const submit = async (v: RiskValues) => {
    const payload = { ...v, description: v.description || null, source: v.source || null, appetiteThreshold: v.appetiteThreshold || null };
    if (risk) await update.mutateAsync(payload);
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{risk ? `Edit ${risk.code}` : 'New risk'}</DialogTitle>
          <DialogDescription>Scores are recalculated by the server using the tenant scoring model.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="contents">
            <DialogBody className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2">
                <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel required>Code</FormLabel><FormControl><Input className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={['ACTIVE', 'MONITORING', 'RETIRED'].map((s) => ({ value: s, label: humanize(s) }))} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel required>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="categoryId" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} allowClear clearLabel="None" placeholder="Select category" /></FormControl></FormItem>)} />
                <FormField control={form.control} name="source" render={({ field }) => (<FormItem><FormLabel>Source</FormLabel><FormControl><Input placeholder="e.g. Risk workshop 2026" {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="entityId" render={({ field }) => (<FormItem><FormLabel>Entity</FormLabel><FormControl><EntityPicker value={field.value} onChange={(id) => field.onChange(id)} initialName={risk?.entity?.name} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="ownerId" render={({ field }) => (<FormItem><FormLabel>Risk owner</FormLabel><FormControl><UserPicker value={field.value} onChange={(id) => field.onChange(id)} initial={risk?.owner} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="inherentLikelihood" render={({ field }) => (<FormItem><FormLabel>Inherent likelihood (1-5)</FormLabel><FormControl><SimpleSelect value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} options={SCALE} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="inherentImpact" render={({ field }) => (<FormItem><FormLabel>Inherent impact (1-5)</FormLabel><FormControl><SimpleSelect value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} options={SCALE} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="controlEffectiveness" render={({ field }) => (<FormItem><FormLabel>Control effectiveness (1 none - 5 full)</FormLabel><FormControl><SimpleSelect value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} options={SCALE} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="velocity" render={({ field }) => (<FormItem><FormLabel>Velocity</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={VELOCITIES.map((v) => ({ value: v, label: humanize(v) }))} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="appetiteThreshold" render={({ field }) => (<FormItem><FormLabel>Appetite threshold (score)</FormLabel><FormControl><Input type="number" min={1} max={25} step={0.5} {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
              </div>
              <div className="space-y-3">
                <ScorePreview
                  thresholds={thresholds}
                  input={{
                    inherentLikelihood: Number(w.inherentLikelihood) || 1,
                    inherentImpact: Number(w.inherentImpact) || 1,
                    controlEffectiveness: Number(w.controlEffectiveness) || 1,
                    velocity: w.velocity,
                    appetiteThreshold: w.appetiteThreshold ? Number(w.appetiteThreshold) : undefined,
                  }}
                />
                <HeatMap compact showLabels={false} highlight={previewCell(w)} />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending || update.isPending}>{risk ? 'Save' : 'Create risk'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function previewCell(w: RiskValues) {
  try {
    const r = scoreRisk({ inherentLikelihood: Number(w.inherentLikelihood) || 1, inherentImpact: Number(w.inherentImpact) || 1, controlEffectiveness: Number(w.controlEffectiveness) || 1, velocity: w.velocity });
    return { likelihood: Math.round(r.residualLikelihood), impact: Math.round(r.residualImpact) };
  } catch {
    return null;
  }
}

function AssessDialog({ risk, open, onOpenChange }: { risk: Risk; open: boolean; onOpenChange: (o: boolean) => void }) {
  const assess = useAssessRisk(risk.id);
  const [v, setV] = React.useState({ periodLabel: '', inherentLikelihood: risk.inherentLikelihood, inherentImpact: risk.inherentImpact, controlEffectiveness: risk.controlEffectiveness, velocity: risk.velocity, rationale: '' });
  React.useEffect(() => {
    if (open) {
      const d = new Date();
      setV({ periodLabel: `FY${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`, inherentLikelihood: risk.inherentLikelihood, inherentImpact: risk.inherentImpact, controlEffectiveness: risk.controlEffectiveness, velocity: risk.velocity, rationale: '' });
    }
  }, [open, risk]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Assess {risk.code}</DialogTitle><DialogDescription>Records a periodic assessment and updates the current risk scores.</DialogDescription></DialogHeader>
        <DialogBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="a-period" required>Period</Label><Input id="a-period" value={v.periodLabel} onChange={(e) => setV({ ...v, periodLabel: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Likelihood</Label><SimpleSelect value={String(v.inherentLikelihood)} onValueChange={(x) => setV({ ...v, inherentLikelihood: Number(x) })} options={SCALE} /></div>
              <div className="space-y-1.5"><Label>Impact</Label><SimpleSelect value={String(v.inherentImpact)} onValueChange={(x) => setV({ ...v, inherentImpact: Number(x) })} options={SCALE} /></div>
              <div className="space-y-1.5"><Label>Control effectiveness</Label><SimpleSelect value={String(v.controlEffectiveness)} onValueChange={(x) => setV({ ...v, controlEffectiveness: Number(x) })} options={SCALE} /></div>
              <div className="space-y-1.5"><Label>Velocity</Label><SimpleSelect value={v.velocity} onValueChange={(x) => setV({ ...v, velocity: x as RiskVelocity })} options={VELOCITIES.map((x) => ({ value: x, label: humanize(x) }))} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="a-rat">Rationale</Label><Textarea id="a-rat" value={v.rationale} onChange={(e) => setV({ ...v, rationale: e.target.value })} /></div>
          </div>
          <ScorePreview input={{ inherentLikelihood: v.inherentLikelihood, inherentImpact: v.inherentImpact, controlEffectiveness: v.controlEffectiveness, velocity: v.velocity }} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={assess.isPending} disabled={!v.periodLabel} onClick={async () => { await assess.mutateAsync(v); onOpenChange(false); }}>Record assessment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RiskPanel({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (r: Risk) => void }) {
  const { data, isLoading, error, refetch } = useRisk(id);
  const [assessOpen, setAssessOpen] = React.useState(false);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent size="lg">
        {isLoading ? <div className="p-5"><Skeleton className="mb-3 h-6 w-2/3" /><SkeletonRows rows={6} /></div> : error || !data ? <ErrorState error={error} onRetry={() => refetch()} /> : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2"><SheetTitle className="truncate">{data.title}</SheetTitle><SeverityBadge severity={data.rating} /></div>
              <SheetDescription><span className="font-mono">{data.code}</span>{data.category ? ` · ${data.category.name}` : ''}{data.entity ? ` · ${data.entity.name}` : ''}</SheetDescription>
              <div className="mt-2 flex gap-1.5">
                <Can permission="risk:manage"><Button size="sm" variant="outline" onClick={() => onEdit(data)}><Pencil /> Edit</Button></Can>
                <Can permission="risk:assess"><Button size="sm" onClick={() => setAssessOpen(true)}><Gauge /> Assess</Button></Can>
              </div>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="surface p-3"><p className="text-2xs text-muted-foreground">Inherent</p><p className="text-xl font-semibold">{fmtNumber(data.inherentScore, 1)}</p><p className="text-2xs text-muted-foreground">{data.inherentLikelihood} × {data.inherentImpact}</p></div>
                <div className="surface p-3"><p className="text-2xs text-muted-foreground">Controls</p><p className="text-xl font-semibold">{data.controlEffectiveness}/5</p><p className="text-2xs text-muted-foreground">{humanize(data.velocity)} velocity</p></div>
                <div className="surface p-3"><p className="text-2xs text-muted-foreground">Residual</p><p className="text-xl font-semibold text-primary">{fmtNumber(data.residualScore, 1)}</p><p className="text-2xs text-muted-foreground">{data.residualLikelihood} × {data.residualImpact}</p></div>
              </div>
              <HeatMap compact highlight={{ likelihood: data.residualLikelihood, impact: data.residualImpact }} />
              <dl className="grid grid-cols-2 gap-3">
                <DescriptionItem label="Status"><GenericStatusBadge value={data.status} tone={data.status === 'ACTIVE' ? 'success' : 'muted'} /></DescriptionItem>
                <DescriptionItem label="Owner">{data.owner?.displayName ?? '—'}</DescriptionItem>
                <DescriptionItem label="Appetite">{data.appetiteThreshold ? `${fmtNumber(data.appetiteThreshold, 1)} · ${data.withinAppetite ? 'within' : 'exceeded'}` : '—'}</DescriptionItem>
                <DescriptionItem label="Last assessed">{fmtDate(data.lastAssessedAt)}</DescriptionItem>
                <DescriptionItem label="Description" className="col-span-2"><span className="whitespace-pre-wrap">{data.description || '—'}</span></DescriptionItem>
              </dl>
              {data.controls?.length ? (
                <div><p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Linked controls</p>
                  <ul className="divide-y divide-border rounded-md border border-border">{data.controls.map((c) => <li key={c.id} className="px-3 py-1.5 text-sm"><span className="font-mono text-2xs text-muted-foreground">{c.code}</span> {c.title}</li>)}</ul></div>
              ) : null}
              {data.assessments?.length ? (
                <div><p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Assessment history</p>
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {data.assessments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                        <div><span className="font-medium">{a.periodLabel}</span><span className="ml-2 text-xs text-muted-foreground">{a.assessedBy?.displayName} · {fmtDate(a.assessedAt)}</span></div>
                        <div className="flex items-center gap-2"><span className="tabular-nums text-xs">{fmtNumber(a.residualScore, 1)}</span><SeverityBadge severity={a.rating} /></div>
                      </li>
                    ))}
                  </ul></div>
              ) : null}
            </SheetBody>
            <AssessDialog risk={data} open={assessOpen} onOpenChange={setAssessOpen} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', rating: undefined as string | string[] | undefined, status: undefined as string | undefined, categoryId: undefined as string | undefined, entityId: undefined as string | undefined };

export default function RisksPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('risk');
  const openNew = params.get('new') === '1';
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = useRisks({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, rating: state.rating, status: state.status, categoryId: state.categoryId, entityId: state.entityId });
  const heatmap = useRiskHeatmap();
  const categories = useRiskCategories();
  const [dialog, setDialog] = React.useState<{ open: boolean; risk?: Risk | null }>({ open: openNew });
  React.useEffect(() => { if (openNew) setDialog({ open: true, risk: null }); }, [openNew]);

  const columns = React.useMemo<ColumnDef<Risk, unknown>[]>(() => [
    { accessorKey: 'code', header: 'Code', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '90px' } },
    { accessorKey: 'title', header: 'Risk', cell: ({ row }) => (<div className="min-w-0"><p className="truncate font-medium">{row.original.title}</p><p className="truncate text-2xs text-muted-foreground">{row.original.category?.name ?? ''}{row.original.entity ? ` · ${row.original.entity.name}` : ''}</p></div>) },
    { accessorKey: 'inherentScore', header: 'Inherent', cell: ({ getValue }) => fmtNumber(getValue<number>(), 1), meta: { align: 'right' } },
    { accessorKey: 'controlEffectiveness', header: 'Controls', cell: ({ getValue }) => `${getValue<number>()}/5`, meta: { align: 'center' } },
    { accessorKey: 'residualScore', header: 'Residual', cell: ({ getValue }) => <span className="font-semibold">{fmtNumber(getValue<number>(), 1)}</span>, meta: { align: 'right' } },
    { accessorKey: 'rating', header: 'Rating', cell: ({ getValue }) => <SeverityBadge severity={getValue<string>()} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <GenericStatusBadge value={getValue<string>()} tone={getValue<string>() === 'ACTIVE' ? 'success' : 'muted'} /> },
    { id: 'owner', header: 'Owner', cell: ({ row }) => row.original.owner?.displayName ?? '—' },
    { accessorKey: 'lastAssessedAt', header: 'Last assessed', cell: ({ getValue }) => fmtDate(getValue<string>()) },
  ], []);

  const chips = [];
  if (state.rating) chips.push({ key: 'rating', label: `Rating: ${(Array.isArray(state.rating) ? state.rating : [state.rating]).map(humanize).join(', ')}`, onRemove: () => set({ rating: undefined }) });
  if (state.status) chips.push({ key: 'status', label: `Status: ${humanize(state.status)}`, onRemove: () => set({ status: undefined }) });
  if (state.categoryId) chips.push({ key: 'cat', label: `Category: ${categories.data?.find((c) => c.id === state.categoryId)?.name ?? '…'}`, onRemove: () => set({ categoryId: undefined }) });
  if (state.entityId) chips.push({ key: 'ent', label: 'Entity filter', onRemove: () => set({ entityId: undefined }) });

  const select = (id: string | null) => {
    const sp = new URLSearchParams(params.toString());
    sp.delete('new');
    if (id) sp.set('risk', id); else sp.delete('risk');
    router.replace(`/risks${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
  };

  return (
    <>
      <PageHeader title="Risk register" description="Inherent and residual risk scoring across the audit universe." actions={<Can permission="risk:manage"><Button onClick={() => setDialog({ open: true, risk: null })}><Plus /> New risk</Button></Can>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
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
            searchPlaceholder="Search risks…"
            chips={chips}
            onClearFilters={reset}
            toolbar={<>
              <ChipSelect label="Rating" multiple options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} value={state.rating} onChange={(v) => set({ rating: v })} />
              <ChipSelect label="Status" options={['ACTIVE', 'MONITORING', 'RETIRED'].map((s) => ({ value: s, label: humanize(s) }))} value={state.status} onChange={(v) => set({ status: v as string | undefined })} />
              <ChipSelect label="Category" options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={state.categoryId} onChange={(v) => set({ categoryId: v as string | undefined })} />
            </>}
            onRowClick={(r) => select(r.id)}
            emptyIcon={<Activity />}
            emptyTitle="No risks recorded"
            emptyDescription="Add risks from workshops, the library or the annual assessment."
            storageKey="risks"
            initialHidden={['lastAssessedAt']}
          />
        </div>
        <Section title="Residual heat map" description="Click a cell to filter by rating.">
          {heatmap.isLoading ? <SkeletonRows rows={5} /> : <HeatMap cells={heatmap.data} compact onCellClick={(l, i) => { const score = l * i; const rating = score <= 5 ? 'LOW' : score <= 10 ? 'MEDIUM' : score <= 16 ? 'HIGH' : 'CRITICAL'; set({ rating }); }} />}
          <HeatMapLegend className="mt-3" />
          <div className="mt-3 flex flex-wrap gap-1">{SEVERITIES.map((s) => <Badge key={s} variant="outline">{humanize(s)}: {heatmap.data?.filter((c) => c.rating === s).reduce((a, c) => a + c.count, 0) ?? 0}</Badge>)}</div>
        </Section>
      </div>
      {selectedId ? <RiskPanel id={selectedId} onClose={() => select(null)} onEdit={(r) => setDialog({ open: true, risk: r })} /> : null}
      <RiskDialog open={dialog.open} onOpenChange={(o) => { setDialog((d) => ({ ...d, open: o })); if (!o && openNew) select(selectedId); }} risk={dialog.risk} />
    </>
  );
}
