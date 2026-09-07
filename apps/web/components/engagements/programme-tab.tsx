'use client';

import * as React from 'react';
import Link from 'next/link';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BookOpen, CheckCircle2, FilePlus2, GripVertical, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SimpleSelect } from '@/components/ui/select';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { UserPicker } from '@/components/domain/user-picker';
import { UserAvatar } from '@/components/ui/avatar';
import { GenericStatusBadge, WorkpaperStatusBadge } from '@/components/domain/badges';
import { Can, useCan } from '@/lib/auth';
import { useAddStep, useApproveProgram, useCreateProgram, useCreateWorkpaperFromStep, useDeleteStep, usePrograms, useReorderSteps, useUpdateStep, type StepInput } from '@/lib/queries/engagements';
import { useLibraryItems } from '@/lib/queries/library';
import { fmtHours } from '@/lib/format';
import { cn, humanize, toNumber } from '@/lib/utils';
import type { AuditProgram, ProgramStep, StepStatus } from '@/lib/types';

const STEP_STATUSES: StepStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE'];

function SortableStep({ step, canEdit, onEdit, onDelete, onCreateWorkpaper, onAssign, onStatus }: { step: ProgramStep; canEdit: boolean; onEdit: () => void; onDelete: () => void; onCreateWorkpaper: () => void; onAssign: (id: string | null) => void; onStatus: (s: StepStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id, disabled: !canEdit });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const wp = step.workpapers?.[0];
  return (
    <li ref={setNodeRef} style={style} className={cn('flex gap-2 border-b border-border px-3 py-2.5 last:border-0', isDragging && 'bg-accent/40 shadow-md')}>
      {canEdit ? (
        <button type="button" className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground" aria-label="Reorder step" {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
      ) : <span className="w-4" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{step.reference}</span>
          <p className="text-sm font-medium">{step.objective}</p>
          {step.estimatedHours ? <span className="text-2xs text-muted-foreground">{fmtHours(step.estimatedHours)}</span> : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{step.procedure}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canEdit ? (
            <SimpleSelect value={step.status} onValueChange={(v) => onStatus(v as StepStatus)} options={STEP_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} className="h-7 w-36 text-xs" aria-label="Step status" />
          ) : (
            <GenericStatusBadge value={step.status} tone={step.status === 'COMPLETED' ? 'success' : step.status === 'IN_PROGRESS' ? 'info' : 'muted'} />
          )}
          <div className="w-52">
            {canEdit ? <UserPicker value={step.assigneeId} onChange={onAssign} initial={step.assignee} placeholder="Assign…" className="h-7 text-xs" /> : step.assignee ? <span className="flex items-center gap-1.5 text-xs"><UserAvatar name={step.assignee.displayName} size="xs" />{step.assignee.displayName}</span> : <span className="text-xs text-muted-foreground">Unassigned</span>}
          </div>
          {wp ? (
            <Link href={`/workpapers/${wp.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Workpaper {wp.reference} <WorkpaperStatusBadge status={wp.status} /></Link>
          ) : (
            <Can permission="workpaper:prepare"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCreateWorkpaper}><FilePlus2 /> Create workpaper</Button></Can>
          )}
        </div>
      </div>
      {canEdit ? (
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button size="icon-sm" variant="ghost" aria-label="Edit step" onClick={onEdit}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Delete step" onClick={onDelete}><Trash2 /></Button>
        </div>
      ) : null}
    </li>
  );
}

function StepDialog({ open, onOpenChange, step, sections, onSave, pending }: { open: boolean; onOpenChange: (o: boolean) => void; step?: ProgramStep | null; sections: string[]; onSave: (v: StepInput) => Promise<void>; pending: boolean }) {
  const [v, setV] = React.useState<StepInput>({});
  React.useEffect(() => { if (open) setV({ section: step?.section ?? sections[0] ?? 'General', reference: step?.reference ?? '', objective: step?.objective ?? '', procedure: step?.procedure ?? '', estimatedHours: step?.estimatedHours ? toNumber(step.estimatedHours) : undefined }); }, [open, step, sections]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{step ? `Edit step ${step.reference}` : 'Add step'}</DialogTitle></DialogHeader>
        <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="st-ref" required>Reference</Label><Input id="st-ref" className="font-mono" value={v.reference ?? ''} onChange={(e) => setV({ ...v, reference: e.target.value })} placeholder="P.1" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="st-sec" required>Section</Label><Input id="st-sec" list="st-sections" value={v.section ?? ''} onChange={(e) => setV({ ...v, section: e.target.value })} /><datalist id="st-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="st-obj" required>Objective</Label><Input id="st-obj" value={v.objective ?? ''} onChange={(e) => setV({ ...v, objective: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="st-proc" required>Procedure</Label><Textarea id="st-proc" rows={5} value={v.procedure ?? ''} onChange={(e) => setV({ ...v, procedure: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="st-hours">Estimated hours</Label><Input id="st-hours" type="number" min={0} step={0.5} value={v.estimatedHours ?? ''} onChange={(e) => setV({ ...v, estimatedHours: e.target.value ? Number(e.target.value) : undefined })} /></div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={pending} disabled={!v.reference || !v.objective || !v.procedure} onClick={async () => { await onSave(v); onOpenChange(false); }}>{step ? 'Save' : 'Add step'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProgramDialog({ engagementId, open, onOpenChange }: { engagementId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateProgram(engagementId);
  const library = useLibraryItems({ type: 'AUDIT_PROGRAM', status: 'PUBLISHED', pageSize: 100 });
  const [title, setTitle] = React.useState('');
  const [libraryItemId, setLibraryItemId] = React.useState('');
  React.useEffect(() => { if (open) { setTitle(''); setLibraryItemId(''); } }, [open]);
  const chosen = library.data?.items.find((i) => i.id === libraryItemId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New audit programme</DialogTitle><DialogDescription>Start from a published library programme or build from scratch.</DialogDescription></DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-1.5"><Label>Library template</Label><SimpleSelect value={libraryItemId} onValueChange={(v) => { setLibraryItemId(v); const it = library.data?.items.find((i) => i.id === v); if (it && !title) setTitle(it.title); }} options={(library.data?.items ?? []).map((i) => ({ value: i.id, label: `${i.code} · ${i.title}` }))} allowClear clearLabel="Blank programme" placeholder="Blank programme" /></div>
          {chosen?.summary ? <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{chosen.summary}</p> : null}
          <div className="space-y-1.5"><Label htmlFor="np-title" required>Title</Label><Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={create.isPending} disabled={!title.trim()} onClick={async () => { await create.mutateAsync({ title: title.trim(), libraryItemId: libraryItemId || undefined }); onOpenChange(false); }}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgramCard({ program, engagementId }: { program: AuditProgram; engagementId: string }) {
  const can = useCan();
  const canEdit = can('program:manage') && program.status !== 'COMPLETED';
  const addStep = useAddStep(engagementId);
  const updateStep = useUpdateStep(engagementId);
  const deleteStep = useDeleteStep(engagementId);
  const reorder = useReorderSteps(engagementId);
  const approve = useApproveProgram(engagementId);
  const createWp = useCreateWorkpaperFromStep(engagementId);
  const [dialog, setDialog] = React.useState<{ open: boolean; step?: ProgramStep | null }>({ open: false });
  const [toDelete, setToDelete] = React.useState<ProgramStep | null>(null);
  const [order, setOrder] = React.useState<string[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const steps = React.useMemo(() => [...program.steps].sort((a, b) => a.sortOrder - b.sortOrder), [program.steps]);
  React.useEffect(() => setOrder(steps.map((s) => s.id)), [steps]);
  const ordered = React.useMemo(() => order.map((id) => steps.find((s) => s.id === id)).filter((s): s is ProgramStep => !!s), [order, steps]);
  const sections = React.useMemo(() => Array.from(new Set(ordered.map((s) => s.section))), [ordered]);
  const completed = steps.filter((s) => s.status === 'COMPLETED' || s.status === 'NOT_APPLICABLE').length;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    reorder.mutate({ programId: program.id, stepIds: next });
  };

  return (
    <section className="surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{program.title}</h3>
          <GenericStatusBadge value={program.status} tone={program.status === 'APPROVED' || program.status === 'COMPLETED' ? 'success' : program.status === 'PENDING_APPROVAL' ? 'warning' : 'muted'} />
          <Badge variant="muted">{completed}/{steps.length} steps</Badge>
          {program.approvedBy ? <span className="text-2xs text-muted-foreground">Approved by {program.approvedBy.displayName}</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          {canEdit ? <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, step: null })}><Plus /> Add step</Button> : null}
          {program.status !== 'APPROVED' && program.status !== 'COMPLETED' ? <Can permission="program:approve"><Button size="sm" onClick={() => approve.mutate(program.id)} loading={approve.isPending} disabled={steps.length === 0}><CheckCircle2 /> Approve programme</Button></Can> : null}
        </div>
      </div>
      {steps.length === 0 ? (
        <EmptyState compact title="No steps yet" description="Add steps manually or recreate from a library programme." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <div key={section}>
                <p className="bg-muted/50 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{section}</p>
                <ul>
                  {ordered.filter((s) => s.section === section).map((step) => (
                    <SortableStep key={step.id} step={step} canEdit={canEdit} onEdit={() => setDialog({ open: true, step })} onDelete={() => setToDelete(step)} onCreateWorkpaper={() => createWp.mutate(step.id)} onAssign={(id) => updateStep.mutate({ stepId: step.id, assigneeId: id, silent: true })} onStatus={(s) => updateStep.mutate({ stepId: step.id, status: s, silent: true })} />
                  ))}
                </ul>
              </div>
            ))}
          </SortableContext>
        </DndContext>
      )}
      <StepDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} step={dialog.step} sections={sections} pending={addStep.isPending || updateStep.isPending} onSave={async (v) => { if (dialog.step) await updateStep.mutateAsync({ stepId: dialog.step.id, ...v }); else await addStep.mutateAsync({ programId: program.id, ...v }); }} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={`Delete step ${toDelete?.reference}?`} description="Linked workpapers are kept but lose the step reference." confirmLabel="Delete" destructive loading={deleteStep.isPending} onConfirm={async () => { if (toDelete) await deleteStep.mutateAsync(toDelete.id); setToDelete(null); }} />
    </section>
  );
}

export function ProgrammeTab({ engagementId }: { engagementId: string }) {
  const { data, isLoading, error, refetch } = usePrograms(engagementId);
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission="program:manage"><Button onClick={() => setOpen(true)}><BookOpen /> New programme</Button></Can>
      </div>
      {isLoading ? <div className="surface p-4"><SkeletonRows rows={6} /></div> : error ? <ErrorState error={error} onRetry={() => refetch()} /> : !data?.length ? (
        <div className="surface"><EmptyState icon={<ListChecks />} title="No audit programme" description="Instantiate a programme from the library (for example Procurement under COSO) or build one from scratch." action={<Can permission="program:manage"><Button size="sm" onClick={() => setOpen(true)}><Plus /> Create programme</Button></Can>} /></div>
      ) : data.map((p) => <ProgramCard key={p.id} program={p} engagementId={engagementId} />)}
      <NewProgramDialog engagementId={engagementId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
