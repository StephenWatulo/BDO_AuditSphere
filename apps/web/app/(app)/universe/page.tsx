'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Cog,
  Flag,
  Globe2,
  Layers,
  Network,
  Package,
  Pencil,
  Plus,
  Server,
  Trash2,
  Users2,
} from 'lucide-react';
import { ENTITY_TYPES, SEVERITIES } from '@auditsphere/shared';
import { PageHeader, DescriptionItem, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatTile } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/select';
import { ChipSelect } from '@/components/ui/filter-chips';
import { Skeleton, SkeletonCard, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RatingBadge, SeverityBadge, StageBadge } from '@/components/domain/badges';
import { UserPicker } from '@/components/domain/user-picker';
import { Can, useCan } from '@/lib/auth';
import {
  useCoverage,
  useCreateEntity,
  useCreateProcess,
  useDeleteEntity,
  useEntity,
  useEntityTree,
  useUpdateEntity,
  useUpdateProcess,
  type EntityInput,
} from '@/lib/queries/universe';
import { ENTITY_TYPE_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, toInputDate } from '@/lib/format';
import { cn, pct } from '@/lib/utils';
import type { EntityNode, EntityType, Process } from '@/lib/types';

const TYPE_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  LEGAL_ENTITY: Building2,
  BUSINESS_UNIT: Layers,
  COUNTRY: Globe2,
  DEPARTMENT: Users2,
  PROCESS: Cog,
  SYSTEM: Server,
  PRODUCT: Package,
  THIRD_PARTY: Flag,
};

const entitySchema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  type: z.enum(ENTITY_TYPES),
  parentId: z.string().optional().nullable(),
  country: z.string().optional(),
  description: z.string().optional(),
  ownerId: z.string().optional().nullable(),
  riskRating: z.enum(SEVERITIES),
  lastAuditDate: z.string().optional(),
  auditFrequencyMonths: z.coerce.number().int().min(0).optional(),
});
type EntityValues = z.infer<typeof entitySchema>;

function flattenTree(nodes: EntityNode[], depth = 0, out: { node: EntityNode; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children?.length) flattenTree(n.children, depth + 1, out);
  }
  return out;
}

function TreeNode({
  node,
  depth,
  expanded,
  toggle,
  selectedId,
  onSelect,
}: {
  node: EntityNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[node.type] ?? Network;
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(node.id);
  const selected = selectedId === node.id;
  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={selected}>
      <div
        className={cn(
          'group flex h-9 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-sm hover:bg-muted',
          selected && 'bg-accent text-accent-foreground hover:bg-accent',
        )}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelect(node.id);
          if (e.key === 'ArrowRight' && hasChildren && !isOpen) toggle(node.id);
          if (e.key === 'ArrowLeft' && hasChildren && isOpen) toggle(node.id);
        }}
        tabIndex={0}
      >
        <button
          type="button"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          className={cn('flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-background', !hasChildren && 'invisible')}
          onClick={(e) => {
            e.stopPropagation();
            toggle(node.id);
          }}
          tabIndex={-1}
        >
          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <Icon className={cn('size-4 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-mono text-2xs text-muted-foreground">{node.code}</span> {node.name}
        </span>
        <RatingBadge severity={node.riskRating} className="hidden sm:inline-flex" />
        <span className="hidden w-20 text-right text-2xs text-muted-foreground md:block">{node.lastAuditDate ? fmtDate(node.lastAuditDate) : 'Never'}</span>
        <span className="hidden w-28 truncate text-right text-2xs text-muted-foreground lg:block">{node.owner?.displayName ?? ''}</span>
      </div>
      {hasChildren && isOpen ? (
        <ul role="group">
          {node.children!.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function EntityDialog({
  open,
  onOpenChange,
  entity,
  parentId,
  tree,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entity?: EntityNode | null;
  parentId?: string | null;
  tree: EntityNode[];
}) {
  const create = useCreateEntity();
  const update = useUpdateEntity(entity?.id ?? '');
  const form = useForm<EntityValues>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      name: entity?.name ?? '',
      code: entity?.code ?? '',
      type: entity?.type ?? 'BUSINESS_UNIT',
      parentId: entity?.parentId ?? parentId ?? null,
      country: entity?.country ?? '',
      description: entity?.description ?? '',
      ownerId: entity?.ownerId ?? null,
      riskRating: entity?.riskRating ?? 'MEDIUM',
      lastAuditDate: toInputDate(entity?.lastAuditDate),
      auditFrequencyMonths: entity?.auditFrequencyMonths ?? undefined,
    },
  });
  React.useEffect(() => {
    if (open)
      form.reset({
        name: entity?.name ?? '',
        code: entity?.code ?? '',
        type: entity?.type ?? 'BUSINESS_UNIT',
        parentId: entity?.parentId ?? parentId ?? null,
        country: entity?.country ?? '',
        description: entity?.description ?? '',
        ownerId: entity?.ownerId ?? null,
        riskRating: entity?.riskRating ?? 'MEDIUM',
        lastAuditDate: toInputDate(entity?.lastAuditDate),
        auditFrequencyMonths: entity?.auditFrequencyMonths ?? undefined,
      });
  }, [open, entity, parentId, form]);

  const parentOptions = flattenTree(tree)
    .filter((x) => x.node.id !== entity?.id)
    .map((x) => ({ value: x.node.id, label: `${' '.repeat(x.depth * 2)}${x.node.code} · ${x.node.name}` }));

  const submit = async (v: EntityValues) => {
    const payload: EntityInput = {
      ...v,
      parentId: v.parentId || null,
      ownerId: v.ownerId || null,
      country: v.country || null,
      description: v.description || null,
      lastAuditDate: v.lastAuditDate ? new Date(v.lastAuditDate).toISOString() : null,
      auditFrequencyMonths: v.auditFrequencyMonths || null,
    };
    if (entity) await update.mutateAsync(payload);
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{entity ? 'Edit entity' : 'New entity'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="contents">
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel required>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel required>Code</FormLabel><FormControl><Input {...field} className="font-mono" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel required>Type</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={enumOptions(ENTITY_TYPE_LABELS)} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="parentId" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Parent</FormLabel><FormControl><SimpleSelect value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)} options={parentOptions} allowClear clearLabel="No parent (top level)" placeholder="Top level" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="KE" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="riskRating" render={({ field }) => (
                <FormItem><FormLabel>Risk rating</FormLabel><FormControl><SimpleSelect value={field.value} onValueChange={field.onChange} options={SEVERITIES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ownerId" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Owner</FormLabel><FormControl><UserPicker value={field.value} onChange={(id) => field.onChange(id)} initial={entity?.owner} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastAuditDate" render={({ field }) => (
                <FormItem><FormLabel>Last audit date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="auditFrequencyMonths" render={({ field }) => (
                <FormItem><FormLabel>Audit frequency (months)</FormLabel><FormControl><Input type="number" min={0} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending || update.isPending}>{entity ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ProcessDialog({ open, onOpenChange, entityId, process }: { open: boolean; onOpenChange: (o: boolean) => void; entityId: string; process?: Process | null }) {
  const create = useCreateProcess();
  const update = useUpdateProcess();
  const [v, setV] = React.useState({ code: '', name: '', description: '', category: '', isKey: false, ownerId: null as string | null });
  React.useEffect(() => {
    if (open) setV({ code: process?.code ?? '', name: process?.name ?? '', description: process?.description ?? '', category: process?.category ?? '', isKey: process?.isKey ?? false, ownerId: process?.ownerId ?? null });
  }, [open, process]);
  const submit = async () => {
    const payload = { entityId, code: v.code, name: v.name, description: v.description || null, category: v.category || null, isKey: v.isKey, ownerId: v.ownerId };
    if (process) await update.mutateAsync({ id: process.id, ...payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{process ? 'Edit process' : 'Add process'}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label htmlFor="p-code" required>Code</Label><Input id="p-code" className="font-mono" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label htmlFor="p-name" required>Name</Label><Input id="p-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="p-cat">Category</Label><Input id="p-cat" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="e.g. Procure to pay" /></div>
          <div className="space-y-1.5"><Label htmlFor="p-owner">Owner</Label><UserPicker id="p-owner" value={v.ownerId} onChange={(id) => setV({ ...v, ownerId: id })} initial={process?.owner} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Checkbox id="p-key" checked={v.isKey} onCheckedChange={(c) => setV({ ...v, isKey: !!c })} /><Label htmlFor="p-key">Key process</Label></div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={create.isPending || update.isPending} disabled={!v.code || !v.name}>{process ? 'Save' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntityPanel({ id, onClose, onEdit, onAddChild, tree }: { id: string; onClose: () => void; onEdit: (e: EntityNode) => void; onAddChild: (parentId: string) => void; tree: EntityNode[] }) {
  const { data, isLoading, error, refetch } = useEntity(id);
  const del = useDeleteEntity();
  const can = useCan();
  const [confirm, setConfirm] = React.useState(false);
  const [procOpen, setProcOpen] = React.useState(false);
  const [editProc, setEditProc] = React.useState<Process | null>(null);
  const Icon = data ? TYPE_ICONS[data.type] ?? Network : Network;
  const parent = React.useMemo(() => flattenTree(tree).find((x) => x.node.id === data?.parentId)?.node, [tree, data?.parentId]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent size="lg" className="flex flex-col">
        {isLoading ? (
          <div className="p-5"><Skeleton className="mb-3 h-6 w-2/3" /><SkeletonRows rows={6} /></div>
        ) : error || !data ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <Icon className="size-5 text-primary" />
                <SheetTitle className="truncate">{data.name}</SheetTitle>
                <RatingBadge severity={data.riskRating} />
              </div>
              <SheetDescription>
                <span className="font-mono">{data.code}</span> · {ENTITY_TYPE_LABELS[data.type]}
                {parent ? ` · under ${parent.name}` : ''}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Can permission="universe:manage">
                  <Button size="sm" variant="outline" onClick={() => onEdit(data)}><Pencil /> Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => onAddChild(data.id)}><Plus /> Add child</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}><Trash2 /> Remove</Button>
                </Can>
              </div>
            </SheetHeader>
            <SheetBody>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="processes">Processes <Badge variant="muted">{data.processes?.length ?? 0}</Badge></TabsTrigger>
                  <TabsTrigger value="risks">Risks <Badge variant="muted">{data.risks?.length ?? 0}</Badge></TabsTrigger>
                  <TabsTrigger value="engagements">Engagements</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <dl className="grid grid-cols-2 gap-4">
                    <DescriptionItem label="Owner">{data.owner?.displayName ?? '—'}</DescriptionItem>
                    <DescriptionItem label="Country">{data.country ?? '—'}</DescriptionItem>
                    <DescriptionItem label="Last audited">{data.lastAuditDate ? fmtDate(data.lastAuditDate) : 'Never'}</DescriptionItem>
                    <DescriptionItem label="Next audit due">{fmtDate(data.nextAuditDue)}</DescriptionItem>
                    <DescriptionItem label="Audit frequency">{data.auditFrequencyMonths ? `Every ${data.auditFrequencyMonths} months` : '—'}</DescriptionItem>
                    <DescriptionItem label="Open findings">{data.openFindingsCount ?? 0}</DescriptionItem>
                    <DescriptionItem label="Description" className="col-span-2"><span className="whitespace-pre-wrap">{data.description || '—'}</span></DescriptionItem>
                    {data.strategicObjectives?.length ? (
                      <DescriptionItem label="Strategic objectives" className="col-span-2">
                        <ul className="list-disc pl-4">{data.strategicObjectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
                      </DescriptionItem>
                    ) : null}
                  </dl>
                </TabsContent>
                <TabsContent value="processes">
                  <div className="mb-2 flex justify-end">
                    <Can permission="universe:manage">
                      <Button size="sm" variant="outline" onClick={() => { setEditProc(null); setProcOpen(true); }}><Plus /> Add process</Button>
                    </Can>
                  </div>
                  {data.processes?.length ? (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {data.processes.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                          <Cog className="size-4 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium"><span className="font-mono text-2xs text-muted-foreground">{p.code}</span> {p.name} {p.isKey ? <Badge variant="accent" className="ml-1">Key</Badge> : null}</p>
                            <p className="truncate text-2xs text-muted-foreground">{p.category ?? ''}{p.owner ? ` · ${p.owner.displayName}` : ''}</p>
                          </div>
                          {can('universe:manage') ? <Button size="icon-sm" variant="ghost" aria-label="Edit process" onClick={() => { setEditProc(p); setProcOpen(true); }}><Pencil /></Button> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact icon={<Cog />} title="No processes" />
                  )}
                </TabsContent>
                <TabsContent value="risks">
                  {data.risks?.length ? (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {data.risks.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <Link href={`/risks?risk=${r.id}`} className="min-w-0 truncate text-sm hover:underline"><span className="font-mono text-2xs text-muted-foreground">{r.code}</span> {r.title}</Link>
                          <SeverityBadge severity={r.rating} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact title="No risks linked" action={<Button size="sm" variant="outline" asChild><Link href={`/risks?entityId=${data.id}`}>View risks</Link></Button>} />
                  )}
                </TabsContent>
                <TabsContent value="engagements">
                  {data.engagements?.length ? (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {data.engagements.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <Link href={`/engagements/${e.id}`} className="min-w-0 truncate text-sm hover:underline"><span className="font-mono text-2xs text-muted-foreground">{e.auditNumber}</span> {e.title}</Link>
                          <StageBadge stage={e.stage} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact title="No engagements yet" />
                  )}
                </TabsContent>
              </Tabs>
            </SheetBody>
            <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Remove ${data.name}?`} description="The entity will be archived. Historical engagements and findings keep their references." confirmLabel="Remove" destructive loading={del.isPending} onConfirm={async () => { await del.mutateAsync(data.id); setConfirm(false); onClose(); }} />
            <ProcessDialog open={procOpen} onOpenChange={setProcOpen} entityId={data.id} process={editProc} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function UniversePage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('entity');
  const [filters, setFilters] = React.useState<{ type?: string; riskRating?: string; country?: string }>({});
  const tree = useEntityTree(filters);
  const coverage = useCoverage();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState('');
  const [dialog, setDialog] = React.useState<{ open: boolean; entity?: EntityNode | null; parentId?: string | null }>({ open: false });

  const items = React.useMemo(() => tree.data ?? [], [tree.data]);
  React.useEffect(() => {
    if (items.length && expanded.size === 0) setExpanded(new Set(items.map((n) => n.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    const prune = (nodes: EntityNode[]): EntityNode[] =>
      nodes
        .map((n): EntityNode | null => {
          const kids = n.children ? prune(n.children) : [];
          const match = n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q);
          return match || kids.length ? { ...n, children: kids } : null;
        })
        .filter((n): n is EntityNode => n !== null);
    return prune(items);
  }, [items, search]);

  React.useEffect(() => {
    if (search.trim()) setExpanded(new Set(flattenTree(filtered).map((x) => x.node.id)));
  }, [search, filtered]);

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const select = (id: string | null) => router.replace(id ? `/universe?entity=${id}` : '/universe', { scroll: false });
  const all = flattenTree(items);
  const cov = coverage.data;

  return (
    <>
      <PageHeader
        title="Audit universe"
        description="Auditable entities, processes and coverage."
        actions={
          <Can permission="universe:manage">
            <Button onClick={() => setDialog({ open: true, entity: null, parentId: null })}><Plus /> New entity</Button>
          </Can>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {coverage.isLoading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) : cov ? (
          <>
            <StatTile label="Auditable entities" value={cov.total} icon={<Network />} />
            <StatTile label="Audited last 12 months" value={fmtCoverage(cov.auditedLast12Months, cov.total)} hint={`${cov.auditedLast12Months} entities`} tone="success" />
            <StatTile label="Audited last 36 months" value={fmtCoverage(cov.auditedLast36Months, cov.total)} hint={`${cov.auditedLast36Months} entities`} tone="info" />
            <StatTile label="Never audited" value={cov.neverAudited} tone={cov.neverAudited ? 'warning' : 'default'} onClick={() => router.push('/universe?never=1')} />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Section className="xl:col-span-3" bodyClassName="p-2" title="Entity tree" actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter tree…" className="h-7 w-44 text-xs" aria-label="Filter tree" />
            <ChipSelect label="Type" options={enumOptions(ENTITY_TYPE_LABELS)} value={filters.type} onChange={(v) => setFilters({ ...filters, type: v as string | undefined })} />
            <ChipSelect label="Rating" options={SEVERITIES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} value={filters.riskRating} onChange={(v) => setFilters({ ...filters, riskRating: v as string | undefined })} />
            <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set(all.map((x) => x.node.id)))}>Expand all</Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>Collapse</Button>
          </div>
        }>
          {tree.isLoading ? (
            <div className="p-2"><SkeletonRows rows={8} /></div>
          ) : tree.error ? (
            <ErrorState error={tree.error} onRetry={() => tree.refetch()} compact />
          ) : filtered.length === 0 ? (
            <EmptyState compact icon={<Network />} title="No entities" description="Build the universe by adding legal entities, business units and processes." action={<Can permission="universe:manage"><Button size="sm" onClick={() => setDialog({ open: true })}><Plus /> Add first entity</Button></Can>} />
          ) : (
            <>
              <div className="hidden items-center gap-1.5 px-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground md:flex">
                <span className="flex-1 pl-10">Entity</span>
                <span className="w-16 text-right sm:block">Rating</span>
                <span className="w-20 text-right">Last audit</span>
                <span className="hidden w-28 text-right lg:block">Owner</span>
              </div>
              <ul role="tree" aria-label="Audit universe">
                {filtered.map((n) => (
                  <TreeNode key={n.id} node={n} depth={0} expanded={expanded} toggle={toggle} selectedId={selectedId} onSelect={select} />
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section title="Coverage by type" bodyClassName="p-0">
          {coverage.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div> : cov?.byType?.length ? (
            <ul className="divide-y divide-border">
              {cov.byType.map((t) => (
                <li key={t.type} className="px-4 py-2.5">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{ENTITY_TYPE_LABELS[t.type] ?? t.type}</span>
                    <span className="tabular-nums text-muted-foreground">{t.covered}/{t.total}</span>
                  </div>
                  <Progress value={pct(t.covered, t.total)} size="sm" tone={pct(t.covered, t.total) >= 70 ? 'success' : pct(t.covered, t.total) >= 40 ? 'warning' : 'danger'} />
                </li>
              ))}
            </ul>
          ) : <EmptyState compact title="No coverage data" />}
        </Section>
      </div>

      {selectedId ? (
        <EntityPanel id={selectedId} tree={items} onClose={() => select(null)} onEdit={(e) => setDialog({ open: true, entity: e })} onAddChild={(pid) => setDialog({ open: true, entity: null, parentId: pid })} />
      ) : null}
      <EntityDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} entity={dialog.entity} parentId={dialog.parentId} tree={items} />
    </>
  );
}

function fmtCoverage(part: number, total: number) {
  return `${pct(part, total)}%`;
}
