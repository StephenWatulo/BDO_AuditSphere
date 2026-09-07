'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { Briefcase, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { PLAN_WORKFLOW, SEVERITIES } from '@auditsphere/shared';
import { PageHeader, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StatTile } from '@/components/ui/card';
import { SimpleSelect } from '@/components/ui/select';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { PlanStatusBadge, SeverityBadge, GenericStatusBadge, StageBadge } from '@/components/domain/badges';
import { WorkflowActions } from '@/components/domain/guard-dialog';
import { EntityPicker } from '@/components/domain/entity-picker';
import { UserPicker } from '@/components/domain/user-picker';
import { Can, useCan } from '@/lib/auth';
import { useCreateEngagementFromItem, useCreatePlanItem, useDeletePlanItem, usePlan, usePlanTransition, useUpdatePlanItem, type PlanItemInput } from '@/lib/queries/plans';
import { ENGAGEMENT_TYPE_LABELS, PLAN_ITEM_SOURCE_LABELS, PLAN_ITEM_STATUS_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, fmtHours, fmtNumber } from '@/lib/format';
import { cn, humanize, toNumber } from '@/lib/utils';
import type { PlanItem } from '@/lib/types';

const QUARTERS = [1, 2, 3, 4] as const;
type Bucket = 1 | 2 | 3 | 4 | 0;

function ItemCard({ item, dragging, onEdit, onCreateEngagement, onDelete, canManage, canCreate }: { item: PlanItem; dragging?: boolean; onEdit?: () => void; onCreateEngagement?: () => void; onDelete?: () => void; canManage: boolean; canCreate: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled: !canManage });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={cn('surface group relative p-2.5 text-sm', (isDragging || dragging) && 'opacity-60 shadow-lg ring-2 ring-primary/30')}>
      <div className="flex items-start gap-1.5">
        {canManage ? (
          <button type="button" className="mt-0.5 cursor-grab touch-none rounded text-muted-foreground hover:text-foreground focus-visible:ring-2" aria-label={`Drag ${item.title}`} {...attributes} {...listeners}>
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{item.title}</p>
          <p className="mt-0.5 truncate text-2xs text-muted-foreground">{item.entity?.name ?? 'No entity'} · {ENGAGEMENT_TYPE_LABELS[item.engagementType] ?? humanize(item.engagementType)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <SeverityBadge severity={item.riskRating} />
            <GenericStatusBadge value={item.status} labels={PLAN_ITEM_STATUS_LABELS} tone={item.status === 'COMPLETED' ? 'success' : item.status === 'IN_PROGRESS' ? 'info' : 'muted'} />
            {item.budgetHours ? <span className="text-2xs text-muted-foreground">{fmtHours(item.budgetHours)}</span> : null}
            {item.lead ? <span className="text-2xs text-muted-foreground">· {item.lead.displayName}</span> : null}
          </div>
          {item.engagement ? (
            <Link href={`/engagements/${item.engagement.id}`} className="mt-1.5 inline-flex items-center gap-1 text-2xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              <Briefcase className="size-3" /> {item.engagement.auditNumber} <StageBadge stage={item.engagement.stage} />
            </Link>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {canManage ? <Button size="icon-sm" variant="ghost" aria-label="Edit item" onClick={onEdit}><Pencil /></Button> : null}
          {canCreate && !item.engagementId ? <Button size="icon-sm" variant="ghost" aria-label="Create engagement" onClick={onCreateEngagement}><Briefcase /></Button> : null}
          {canManage ? <Button size="icon-sm" variant="ghost" aria-label="Delete item" onClick={onDelete}><Trash2 /></Button> : null}
        </div>
      </div>
    </div>
  );
}

function QuarterColumn({ bucket, items, children, hours }: { bucket: Bucket; items: PlanItem[]; children: React.ReactNode; hours: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `q-${bucket}` });
  return (
    <div ref={setNodeRef} className={cn('flex min-h-48 flex-col rounded-md border border-dashed border-border bg-muted/30 p-2 transition-colors', isOver && 'border-primary bg-accent/40')}>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold">{bucket === 0 ? 'Unscheduled' : `Q${bucket}`}</p>
        <span className="text-2xs text-muted-foreground">{items.length} · {fmtHours(hours)}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function ItemDialog({ planId, open, onOpenChange, item, fiscalYear }: { planId: string; open: boolean; onOpenChange: (o: boolean) => void; item?: PlanItem | null; fiscalYear: number }) {
  const create = useCreatePlanItem(planId);
  const update = useUpdatePlanItem(planId);
  const blank = React.useCallback((): PlanItemInput => ({ title: item?.title ?? '', description: item?.description ?? '', entityId: item?.entityId ?? null, source: item?.source ?? 'RISK_BASED', engagementType: item?.engagementType ?? 'OPERATIONAL', riskRating: item?.riskRating ?? 'MEDIUM', priority: item?.priority ?? 3, plannedYear: item?.plannedYear ?? fiscalYear, plannedQuarter: item?.plannedQuarter ?? null, budgetHours: item?.budgetHours ? toNumber(item.budgetHours) : undefined, leadId: item?.leadId ?? null, status: item?.status ?? 'PLANNED', rationale: item?.rationale ?? '' }), [item, fiscalYear]);
  const [v, setV] = React.useState<PlanItemInput>(blank());
  React.useEffect(() => { if (open) setV(blank()); }, [open, blank]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{item ? 'Edit plan item' : 'Add plan item'}</DialogTitle></DialogHeader>
        <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pi-title" required>Title</Label><Input id="pi-title" value={v.title ?? ''} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Entity</Label><EntityPicker value={v.entityId} onChange={(id) => setV({ ...v, entityId: id })} initialName={item?.entity?.name} /></div>
          <div className="space-y-1.5"><Label>Source</Label><SimpleSelect value={v.source} onValueChange={(x) => setV({ ...v, source: x as PlanItem['source'] })} options={enumOptions(PLAN_ITEM_SOURCE_LABELS)} /></div>
          <div className="space-y-1.5"><Label>Engagement type</Label><SimpleSelect value={v.engagementType} onValueChange={(x) => setV({ ...v, engagementType: x as PlanItem['engagementType'] })} options={enumOptions(ENGAGEMENT_TYPE_LABELS)} /></div>
          <div className="space-y-1.5"><Label>Risk rating</Label><SimpleSelect value={v.riskRating} onValueChange={(x) => setV({ ...v, riskRating: x as PlanItem['riskRating'] })} options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} /></div>
          <div className="space-y-1.5"><Label>Priority (1 high - 5 low)</Label><SimpleSelect value={String(v.priority ?? 3)} onValueChange={(x) => setV({ ...v, priority: Number(x) })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="pi-year">Planned year</Label><Input id="pi-year" type="number" value={v.plannedYear ?? fiscalYear} onChange={(e) => setV({ ...v, plannedYear: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Quarter</Label><SimpleSelect value={v.plannedQuarter ? String(v.plannedQuarter) : ''} onValueChange={(x) => setV({ ...v, plannedQuarter: x ? Number(x) : null })} options={QUARTERS.map((q) => ({ value: String(q), label: `Q${q}` }))} allowClear clearLabel="Unscheduled" placeholder="Unscheduled" /></div>
          <div className="space-y-1.5"><Label htmlFor="pi-hours">Budget hours</Label><Input id="pi-hours" type="number" min={0} value={v.budgetHours ?? ''} onChange={(e) => setV({ ...v, budgetHours: e.target.value ? Number(e.target.value) : undefined })} /></div>
          <div className="space-y-1.5"><Label>Status</Label><SimpleSelect value={v.status} onValueChange={(x) => setV({ ...v, status: x as PlanItem['status'] })} options={enumOptions(PLAN_ITEM_STATUS_LABELS)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Lead</Label><UserPicker value={v.leadId} onChange={(id) => setV({ ...v, leadId: id })} initial={item?.lead} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pi-rat">Rationale</Label><Textarea id="pi-rat" value={v.rationale ?? ''} onChange={(e) => setV({ ...v, rationale: e.target.value })} placeholder="Why this audit, linked risks, regulatory driver…" /></div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={create.isPending || update.isPending} disabled={!v.title?.trim()} onClick={async () => { const payload = { ...v, description: v.description || null, rationale: v.rationale || null }; if (item) await update.mutateAsync({ itemId: item.id, ...payload }); else await create.mutateAsync(payload); onOpenChange(false); }}>{item ? 'Save' : 'Add item'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useCan();
  const { data: plan, isLoading, error, refetch } = usePlan(id);
  const updateItem = useUpdatePlanItem(id);
  const deleteItem = useDeletePlanItem(id);
  const transition = usePlanTransition(id);
  const createEng = useCreateEngagementFromItem(id);
  const [dialog, setDialog] = React.useState<{ open: boolean; item?: PlanItem | null }>({ open: false });
  const [toDelete, setToDelete] = React.useState<PlanItem | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const canManage = can('plan:manage') && (plan?.status === 'DRAFT' || plan?.status === 'APPROVED' || plan?.status === 'ACTIVE');

  const items = React.useMemo(() => plan?.items ?? [], [plan?.items]);
  const byBucket = React.useMemo(() => {
    const map: Record<Bucket, PlanItem[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (const it of items) {
      const bucket = (it.plannedQuarter ?? 0) as Bucket;
      (map[bucket] ?? map[0]).push(it);
    }
    for (const k of Object.keys(map)) map[Number(k) as Bucket].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
    return map;
  }, [items]);
  const hoursFor = (b: Bucket) => byBucket[b].reduce((a, i) => a + toNumber(i.budgetHours), 0);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const over = e.over?.id;
    if (!over || typeof over !== 'string') return;
    const bucket = Number(over.replace('q-', '')) as Bucket;
    const item = items.find((i) => i.id === e.active.id);
    if (!item || (item.plannedQuarter ?? 0) === bucket) return;
    updateItem.mutate({ itemId: item.id, plannedQuarter: bucket === 0 ? null : bucket, silent: true });
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-1/3" /><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div></div>;
  if (error || !plan) return <ErrorState error={error} onRetry={() => refetch()} />;

  const rollups = plan.rollups;
  const totalHours = rollups?.totalBudgetHours ?? items.reduce((a, i) => a + toNumber(i.budgetHours), 0);
  const active = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <>
      <PageHeader
        title={plan.title}
        meta={<><PlanStatusBadge status={plan.status} /><Badge variant="outline">v{plan.version}</Badge></>}
        description={`FY${plan.fiscalYear} · ${fmtDate(plan.startDate)} – ${fmtDate(plan.endDate)}${plan.approvedBy ? ` · approved by ${plan.approvedBy.displayName}` : ''}`}
        crumbs={[{ label: 'Plans', href: '/plans' }, { label: plan.title }]}
        actions={<>
          <Can permission="plan:manage"><Button variant="outline" onClick={() => setDialog({ open: true, item: null })} disabled={plan.status === 'ARCHIVED'}><Plus /> Add item</Button></Can>
          <WorkflowActions machine={PLAN_WORKFLOW} state={plan.status} serverActions={plan.availableActions} onTransition={(action, comment) => transition.mutateAsync({ action, comment })} isPending={transition.isPending} />
        </>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Plan items" value={items.length} hint={`${items.filter((i) => i.engagementId).length} with engagements`} />
        <StatTile label="Budgeted hours" value={fmtNumber(totalHours)} hint={plan.totalBudgetHours ? `of ${fmtNumber(plan.totalBudgetHours)} available` : undefined} tone={plan.totalBudgetHours && totalHours > toNumber(plan.totalBudgetHours) ? 'danger' : 'default'} />
        <StatTile label="High / critical" value={items.filter((i) => i.riskRating === 'HIGH' || i.riskRating === 'CRITICAL').length} tone="danger" />
        <StatTile label="Completed" value={items.filter((i) => i.status === 'COMPLETED').length} tone="success" />
      </div>

      <Section title="Schedule" description={canManage ? 'Drag items between quarters to reschedule.' : undefined} bodyClassName="p-3">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {([1, 2, 3, 4, 0] as Bucket[]).map((b) => (
              <QuarterColumn key={b} bucket={b} items={byBucket[b]} hours={hoursFor(b)}>
                {byBucket[b].map((item) => (
                  <ItemCard key={item.id} item={item} canManage={!!canManage} canCreate={can('engagement:create') && (plan.status === 'APPROVED' || plan.status === 'ACTIVE')} onEdit={() => setDialog({ open: true, item })} onDelete={() => setToDelete(item)} onCreateEngagement={async () => { const eng = await createEng.mutateAsync(item.id); router.push(`/engagements/${eng.id}`); }} />
                ))}
                {byBucket[b].length === 0 ? <p className="py-6 text-center text-2xs text-muted-foreground">Drop items here</p> : null}
              </QuarterColumn>
            ))}
          </div>
          <DragOverlay>{active ? <ItemCard item={active} dragging canManage={false} canCreate={false} /> : null}</DragOverlay>
        </DndContext>
      </Section>

      {rollups?.byRating?.length ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Hours by rating" bodyClassName="p-0">
            <ul className="divide-y divide-border">{rollups.byRating.map((r) => <li key={r.rating} className="flex items-center justify-between px-4 py-2 text-sm"><SeverityBadge severity={r.rating} /><span>{r.count} items{r.budgetHours !== undefined ? ` · ${fmtHours(r.budgetHours)}` : ''}</span></li>)}</ul>
          </Section>
          {plan.narrative ? <Section title="Narrative"><p className="whitespace-pre-wrap text-sm">{plan.narrative}</p></Section> : null}
        </div>
      ) : plan.narrative ? <Section className="mt-4" title="Narrative"><p className="whitespace-pre-wrap text-sm">{plan.narrative}</p></Section> : null}

      <ItemDialog planId={id} open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} item={dialog.item} fiscalYear={plan.fiscalYear} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Remove "${toDelete?.title}"?`} description="The item is removed from the plan. Any created engagement is kept." confirmLabel="Remove" destructive loading={deleteItem.isPending} onConfirm={async () => { if (toDelete) await deleteItem.mutateAsync(toDelete.id); setToDelete(null); }} />
    </>
  );
}
