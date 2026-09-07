'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { BookOpen, ChevronDown, ChevronRight, Layers, Pencil, Plus, Send, ShieldCheck, Archive, Star } from 'lucide-react';
import { PageHeader, DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SimpleSelect } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { ChipSelect } from '@/components/ui/filter-chips';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LibraryStatusBadge } from '@/components/domain/badges';
import { JsonView } from '@/components/domain/json-diff';
import { Can, useCan } from '@/lib/auth';
import { useListParams } from '@/lib/hooks/use-list-params';
import { useCreateLibraryItem, useLibraryAction, useLibraryItem, useLibraryItems, useUpdateLibraryItem, type LibraryItemInput } from '@/lib/queries/library';
import { LIBRARY_STATUS_LABELS, LIBRARY_TYPE_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtNumber } from '@/lib/format';
import type { LibraryItem, LibraryItemType, LibraryProgramContent } from '@/lib/types';

const DEFAULTS = { page: 1, pageSize: 25, q: '', sort: '', type: undefined as string | undefined, status: undefined as string | string[] | undefined, item: undefined as string | undefined, new: false };

const PROGRAM_TEMPLATE: LibraryProgramContent = {
  sections: [
    { name: 'Planning', steps: [{ reference: 'P.1', objective: 'Understand the process and key controls', procedure: 'Walk through the process with the owner and document the flow.', estimatedHours: 4 }] },
    { name: 'Fieldwork', steps: [{ reference: 'F.1', objective: 'Test operating effectiveness of key controls', procedure: 'Select a sample and test against the control attributes.', estimatedHours: 8 }] },
  ],
};

/** Validates the AUDIT_PROGRAM content shape and returns human readable problems. */
function validateProgramContent(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Content must be a JSON object with a "sections" array.'];
  const sections = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0) return ['"sections" must be a non-empty array.'];
  sections.forEach((s, i) => {
    if (!s || typeof s !== 'object') { errors.push(`Section ${i + 1} must be an object.`); return; }
    const sec = s as { name?: unknown; steps?: unknown };
    if (typeof sec.name !== 'string' || !sec.name.trim()) errors.push(`Section ${i + 1} needs a "name".`);
    if (!Array.isArray(sec.steps) || sec.steps.length === 0) { errors.push(`Section ${i + 1} needs a non-empty "steps" array.`); return; }
    sec.steps.forEach((st, j) => {
      const step = st as { reference?: unknown; objective?: unknown; procedure?: unknown; estimatedHours?: unknown };
      const where = `Section ${i + 1}, step ${j + 1}`;
      if (typeof step.reference !== 'string' || !step.reference.trim()) errors.push(`${where}: "reference" is required.`);
      if (typeof step.objective !== 'string') errors.push(`${where}: "objective" must be a string.`);
      if (typeof step.procedure !== 'string') errors.push(`${where}: "procedure" must be a string.`);
      if (step.estimatedHours !== undefined && (typeof step.estimatedHours !== 'number' || step.estimatedHours < 0)) errors.push(`${where}: "estimatedHours" must be a non-negative number.`);
    });
  });
  return errors;
}

function isProgramContent(item: LibraryItem): item is LibraryItem & { content: LibraryProgramContent } {
  return item.type === 'AUDIT_PROGRAM' && Array.isArray((item.content as LibraryProgramContent | undefined)?.sections);
}

// ---------------------------------------------------------------------------
// Create / edit dialog
// ---------------------------------------------------------------------------

function ItemDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item?: LibraryItem | null }) {
  const create = useCreateLibraryItem();
  const update = useUpdateLibraryItem(item?.id ?? '');
  const [v, setV] = React.useState<{ type: LibraryItemType; code: string; title: string; summary: string; industry: string; tags: string; content: string }>({ type: 'AUDIT_PROGRAM', code: '', title: '', summary: '', industry: '', tags: '', content: JSON.stringify(PROGRAM_TEMPLATE, null, 2) });
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setErrors([]);
    if (item) setV({ type: item.type, code: item.code, title: item.title, summary: item.summary ?? '', industry: item.industry ?? '', tags: (item.tags ?? []).join(', '), content: JSON.stringify(item.content ?? {}, null, 2) });
    else setV({ type: 'AUDIT_PROGRAM', code: '', title: '', summary: '', industry: '', tags: '', content: JSON.stringify(PROGRAM_TEMPLATE, null, 2) });
  }, [open, item]);

  const parse = (): { content?: Record<string, unknown>; errors: string[] } => {
    let parsed: unknown;
    try {
      parsed = v.content.trim() ? JSON.parse(v.content) : {};
    } catch (e) {
      return { errors: [`Invalid JSON: ${e instanceof Error ? e.message : 'could not parse'}`] };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { errors: ['Content must be a JSON object.'] };
    const errs = v.type === 'AUDIT_PROGRAM' ? validateProgramContent(parsed) : [];
    return { content: parsed as Record<string, unknown>, errors: errs };
  };

  const liveErrors = React.useMemo(() => parse().errors, [v.content, v.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const { content, errors: errs } = parse();
    if (errs.length || !content) { setErrors(errs); return; }
    const payload: LibraryItemInput = { type: v.type, code: v.code.trim(), title: v.title.trim(), summary: v.summary.trim() || null, industry: v.industry.trim() || null, tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean), content };
    if (item) await update.mutateAsync(payload);
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };

  const format = () => {
    try { setV({ ...v, content: JSON.stringify(JSON.parse(v.content), null, 2) }); } catch { /* leave as is; error already shown */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${item.code}` : 'New library item'}</DialogTitle>
          <DialogDescription>{item?.status === 'PUBLISHED' ? 'Editing a published item creates a new version.' : 'Items start as drafts and go through submit and approve before they can be used in engagements.'}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2">
            <div className="space-y-1.5"><Label>Type</Label><SimpleSelect value={v.type} onValueChange={(t) => setV({ ...v, type: t as LibraryItemType, content: t === 'AUDIT_PROGRAM' && !item ? JSON.stringify(PROGRAM_TEMPLATE, null, 2) : v.content })} options={enumOptions(LIBRARY_TYPE_LABELS)} disabled={!!item} /></div>
            <div className="space-y-1.5"><Label htmlFor="li-code" required>Code</Label><Input id="li-code" className="font-mono" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="e.g. AP-P2P-001" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="li-title" required>Title</Label><Input id="li-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="li-summary">Summary</Label><Textarea id="li-summary" rows={4} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="li-industry">Industry</Label><Input id="li-industry" value={v.industry} onChange={(e) => setV({ ...v, industry: e.target.value })} placeholder="e.g. Banking" /></div>
            <div className="space-y-1.5"><Label htmlFor="li-tags">Tags</Label><Input id="li-tags" value={v.tags} onChange={(e) => setV({ ...v, tags: e.target.value })} placeholder="comma, separated" /></div>
          </div>
          <div className="space-y-1.5 lg:col-span-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="li-content">Content (JSON)</Label>
              <div className="flex items-center gap-1">
                {v.type === 'AUDIT_PROGRAM' ? <Button size="sm" variant="ghost" onClick={() => setV({ ...v, content: JSON.stringify(PROGRAM_TEMPLATE, null, 2) })}>Insert template</Button> : null}
                <Button size="sm" variant="ghost" onClick={format}>Format</Button>
              </div>
            </div>
            <Textarea id="li-content" className="min-h-[360px] font-mono text-xs" spellCheck={false} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} />
            {v.type === 'AUDIT_PROGRAM' ? <p className="text-2xs text-muted-foreground">Shape: {'{ "sections": [ { "name", "steps": [ { "reference", "objective", "procedure", "estimatedHours"? } ] } ] }'}</p> : null}
            {(errors.length ? errors : liveErrors).length ? (
              <ul className="space-y-0.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {(errors.length ? errors : liveErrors).slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            ) : (
              <p className="text-2xs text-success">Content is valid.</p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={create.isPending || update.isPending} disabled={!v.code.trim() || !v.title.trim() || liveErrors.length > 0} onClick={submit}>{item ? 'Save' : 'Create draft'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------------

function ProgramSections({ content }: { content: LibraryProgramContent }) {
  const [openSections, setOpenSections] = React.useState<Set<number>>(() => new Set(content.sections.map((_, i) => i)));
  const totalSteps = content.sections.reduce((n, s) => n + s.steps.length, 0);
  const totalHours = content.sections.reduce((n, s) => n + s.steps.reduce((m, st) => m + (st.estimatedHours ?? 0), 0), 0);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{content.sections.length} section{content.sections.length === 1 ? '' : 's'} · {totalSteps} step{totalSteps === 1 ? '' : 's'} · {fmtNumber(totalHours, totalHours % 1 ? 1 : 0)} h estimated</p>
      {content.sections.map((s, i) => {
        const open = openSections.has(i);
        return (
          <Collapsible key={i} open={open} onOpenChange={(o) => setOpenSections((prev) => { const n = new Set(prev); if (o) n.add(i); else n.delete(i); return n; })}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-sm font-medium hover:bg-muted">
              {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              <span className="flex-1">{s.name}</span>
              <Badge variant="muted">{s.steps.length} steps</Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="ml-3 mt-1 divide-y divide-border border-l border-border">
                {s.steps.map((st, j) => (
                  <li key={j} className="py-2 pl-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-mono text-2xs text-muted-foreground">{st.reference}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{st.objective}</p>
                        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{st.procedure}</p>
                      </div>
                      {st.estimatedHours !== undefined ? <span className="text-2xs tabular-nums text-muted-foreground">{st.estimatedHours} h</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function ItemSheet({ id, onClose, onEdit }: { id?: string; onClose: () => void; onEdit: (item: LibraryItem) => void }) {
  const can = useCan();
  const { data: item, isLoading, error, refetch } = useLibraryItem(id);
  const action = useLibraryAction();
  const canContribute = can('library:contribute');
  const canApprove = can('library:approve');
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent size="lg">
        {isLoading ? (
          <><SheetHeader><SheetTitle>Loading…</SheetTitle></SheetHeader><SheetBody><SkeletonRows rows={6} /></SheetBody></>
        ) : error || !item ? (
          <><SheetHeader><SheetTitle>Library item</SheetTitle></SheetHeader><SheetBody><ErrorState error={error} compact onRetry={() => refetch()} /></SheetBody></>
        ) : (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="font-mono normal-case tracking-normal">{item.code}</Badge><Badge variant="secondary">{LIBRARY_TYPE_LABELS[item.type] ?? item.type}</Badge><LibraryStatusBadge status={item.status} /><Badge variant="muted">v{item.version}</Badge></div>
              <SheetTitle>{item.title}</SheetTitle>
              <SheetDescription>{item.createdBy ? `Created by ${item.createdBy.displayName} · ` : ''}{fmtDate(item.createdAt)}{item.approvedBy ? ` · Approved by ${item.approvedBy.displayName} ${fmtDate(item.approvedAt)}` : ''}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <dl className="grid grid-cols-2 gap-3">
                <DescriptionItem label="Summary" className="col-span-2"><span className="whitespace-pre-wrap">{item.summary || '—'}</span></DescriptionItem>
                <DescriptionItem label="Industry">{item.industry ?? '—'}</DescriptionItem>
                <DescriptionItem label="Usage"><span className="inline-flex items-center gap-2">{item.usageCount} engagement{item.usageCount === 1 ? '' : 's'}{item.rating ? <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Star className="size-3 fill-current text-warning" />{fmtNumber(item.rating, 1)}</span> : null}</span></DescriptionItem>
                <DescriptionItem label="Tags" className="col-span-2">{item.tags?.length ? <span className="flex flex-wrap gap-1">{item.tags.map((t) => <Badge key={t} variant="outline" className="normal-case tracking-normal">{t}</Badge>)}</span> : '—'}</DescriptionItem>
                <DescriptionItem label="Framework references" className="col-span-2">
                  {item.frameworkRefs?.length ? (
                    <ul className="space-y-1">
                      {item.frameworkRefs.map((r, i) => <li key={i} className="text-sm"><span className="font-mono text-xs text-muted-foreground">{r.framework} {r.refCode}</span>{r.title ? ` · ${r.title}` : ''}</li>)}
                    </ul>
                  ) : '—'}
                </DescriptionItem>
              </dl>
              {isProgramContent(item) ? (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground"><Layers className="size-3" /> Programme sections</p>
                  <ProgramSections content={item.content} />
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Content</p>
                  <JsonView value={item.content} />
                </div>
              )}
              <p className="text-2xs text-muted-foreground">Last updated {fmtDateTime(item.updatedAt ?? item.createdAt)}</p>
            </SheetBody>
            <SheetFooter className="sm:justify-between">
              <div>{canContribute && item.status !== 'RETIRED' ? <Button variant="outline" onClick={() => onEdit(item)}><Pencil /> Edit</Button> : null}</div>
              <div className="flex gap-2">
                {canContribute && item.status === 'DRAFT' ? <Button loading={action.isPending} onClick={() => action.mutate({ id: item.id, action: 'submit' })}><Send /> Submit for approval</Button> : null}
                {canApprove && item.status === 'PENDING_APPROVAL' ? <Button loading={action.isPending} onClick={() => action.mutate({ id: item.id, action: 'approve' })}><ShieldCheck /> Approve and publish</Button> : null}
                {canApprove && (item.status === 'PUBLISHED' || item.status === 'PENDING_APPROVAL') ? <Button variant="destructive" loading={action.isPending} onClick={() => action.mutate({ id: item.id, action: 'retire' })}><Archive /> Retire</Button> : null}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function LibraryTable() {
  const { state, set, sorting, setSorting, reset } = useListParams(DEFAULTS);
  const query = useLibraryItems({ page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, type: state.type, status: state.status });
  const [dialog, setDialog] = React.useState<{ open: boolean; item?: LibraryItem | null }>({ open: false });
  React.useEffect(() => { if (state.new) { setDialog({ open: true }); set({ new: false }); } }, [state.new, set]);

  const columns = React.useMemo<ColumnDef<LibraryItem, unknown>[]>(
    () => [
      { accessorKey: 'code', header: 'Code', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>, meta: { width: '120px', nowrap: true } },
      { accessorKey: 'title', header: 'Title', cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.title}</p>{row.original.summary ? <p className="truncate text-2xs text-muted-foreground">{row.original.summary}</p> : null}</div> },
      { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => LIBRARY_TYPE_LABELS[getValue<LibraryItemType>()] ?? getValue<string>() },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <LibraryStatusBadge status={getValue<string>()} /> },
      { accessorKey: 'version', header: 'Ver', meta: { align: 'center' }, cell: ({ getValue }) => `v${getValue<number>()}` },
      { id: 'tags', header: 'Tags', cell: ({ row }) => (row.original.tags?.length ? <span className="flex flex-wrap gap-1">{row.original.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="normal-case tracking-normal">{t}</Badge>)}{row.original.tags.length > 3 ? <span className="text-2xs text-muted-foreground">+{row.original.tags.length - 3}</span> : null}</span> : '—') },
      { accessorKey: 'usageCount', header: 'Used', meta: { align: 'right' }, cell: ({ getValue }) => getValue<number>() ?? 0 },
      { accessorKey: 'updatedAt', header: 'Updated', cell: ({ row }) => fmtDate(row.original.updatedAt ?? row.original.createdAt) },
    ],
    [],
  );

  const chips = [];
  if (state.type) chips.push({ key: 'type', label: `Type: ${LIBRARY_TYPE_LABELS[state.type as LibraryItemType] ?? state.type}`, onRemove: () => set({ type: undefined }) });
  if (state.status) chips.push({ key: 'status', label: `Status: ${(Array.isArray(state.status) ? state.status : [state.status]).map((s) => LIBRARY_STATUS_LABELS[s as keyof typeof LIBRARY_STATUS_LABELS] ?? s).join(', ')}`, onRemove: () => set({ status: undefined }) });

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
        searchPlaceholder="Search by code, title or tag…"
        chips={chips}
        onClearFilters={reset}
        toolbar={
          <>
            <ChipSelect label="Type" options={enumOptions(LIBRARY_TYPE_LABELS)} value={state.type} onChange={(v) => set({ type: v as string | undefined })} />
            <ChipSelect label="Status" multiple options={enumOptions(LIBRARY_STATUS_LABELS)} value={state.status} onChange={(v) => set({ status: v })} />
          </>
        }
        actions={<Can permission="library:contribute"><Button size="sm" onClick={() => setDialog({ open: true })}><Plus /> New item</Button></Can>}
        onRowClick={(item) => set({ item: item.id })}
        rowClassName={(item) => (item.id === state.item ? 'bg-accent/40' : undefined)}
        emptyIcon={<BookOpen />}
        emptyTitle="No library items"
        emptyDescription="Reusable audit programmes, risks, controls, test procedures and templates live here."
        emptyAction={<Can permission="library:contribute"><Button size="sm" variant="outline" onClick={() => setDialog({ open: true })}><Plus /> New item</Button></Can>}
        storageKey="library"
        initialHidden={['usageCount']}
      />
      <ItemSheet id={state.item} onClose={() => set({ item: undefined })} onEdit={(item) => setDialog({ open: true, item })} />
      <ItemDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} item={dialog.item} />
    </>
  );
}

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        title="Library"
        description="Reusable audit content. Published programmes can be copied into engagements."
        actions={<Button variant="outline" asChild><Link href="/library/frameworks"><ShieldCheck /> Frameworks</Link></Button>}
      />
      <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LibraryTable />
      </React.Suspense>
    </>
  );
}
