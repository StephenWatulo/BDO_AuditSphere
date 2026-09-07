'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, ClipboardList, Download, FileText, Paperclip, Pencil, Plus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { FINDING_STATUSES, FINDING_WORKFLOW, SEVERITIES, type FindingStatus } from '@auditsphere/shared';
import { PageHeader, Section, DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SimpleSelect } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/avatar';
import { StageStepper } from '@/components/domain/stage-stepper';
import { WorkflowActions } from '@/components/domain/guard-dialog';
import { AgeingBadge, FindingStatusBadge, GenericStatusBadge, SeverityBadge } from '@/components/domain/badges';
import { HistoryTimeline } from '@/components/domain/history-timeline';
import { CommentsThread } from '@/components/domain/comments-thread';
import { EditableField } from '@/components/domain/editable-field';
import { UserPicker } from '@/components/domain/user-picker';
import { FileUpload, DocumentList } from '@/components/domain/file-upload';
import { JsonDiff } from '@/components/domain/json-diff';
import { Can, useCan } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { useAddRecommendation, useExtendFinding, useFinding, useFindingTransition, useUpdateFinding, useUpdateRecommendation, type FindingInput } from '@/lib/queries/findings';
import { useDocuments, downloadDocument } from '@/lib/queries/documents';
import { useAuditTrail } from '@/lib/queries/collaboration';
import { EVIDENCE_TYPE_LABELS, FINDING_STATUS_LABELS, RECOMMENDATION_STATUS_LABELS, ROOT_CAUSE_LABELS, TASK_PRIORITY_LABELS, enumOptions } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtDueIn, isOverdue, toInputDate } from '@/lib/format';
import { cn, humanize } from '@/lib/utils';
import type { Finding, Recommendation, RecommendationStatus, TaskPriority } from '@/lib/types';

const TABS = ['overview', 'recommendations', 'evidence', 'history', 'comments', 'audit'] as const;
type Tab = (typeof TABS)[number];
const TERMINAL: FindingStatus[] = ['CLOSED', 'RISK_ACCEPTED'];

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function FiveCs({ finding, canManage }: { finding: Finding; canManage: boolean }) {
  const update = useUpdateFinding(finding.id);
  const save = (field: keyof FindingInput) => (v: string) => update.mutateAsync({ [field]: v === '' ? null : v, silent: true } as FindingInput & { silent?: boolean });
  return (
    <Section title="The five Cs" description={canManage ? 'Click a section to edit. Changes save immediately and are recorded in the audit trail.' : undefined}>
      <dl className="space-y-4">
        <EditableField label="Condition" value={finding.condition} onSave={save('condition')} multiline rows={5} canEdit={canManage} prominent placeholder="What was found" />
        <EditableField label="Criteria" value={finding.criteria} onSave={save('criteria')} multiline rows={4} canEdit={canManage} prominent placeholder="What should be" />
        <EditableField label="Cause" value={finding.cause} onSave={save('cause')} multiline rows={4} canEdit={canManage} prominent placeholder="Why it happened" />
        <EditableField label="Impact" value={finding.impact} onSave={save('impact')} multiline rows={4} canEdit={canManage} prominent placeholder="The effect or risk" />
        <EditableField label="Recommendation" value={finding.recommendation} onSave={save('recommendation')} multiline rows={4} canEdit={canManage} prominent placeholder="What management should do" />
      </dl>
    </Section>
  );
}

function ManagementResponse({ finding }: { finding: Finding }) {
  const can = useCan();
  const canRespond = (can('finding:respond') || can('finding:manage')) && !TERMINAL.includes(finding.status);
  const update = useUpdateFinding(finding.id);
  const extend = useExtendFinding(finding.id);
  const [extendOpen, setExtendOpen] = React.useState(false);
  const [ext, setExt] = React.useState({ dueDate: '', reason: '' });
  const save = (field: keyof FindingInput) => (v: string) => update.mutateAsync({ [field]: v === '' ? null : v, silent: true } as FindingInput & { silent?: boolean });
  const overdue = !TERMINAL.includes(finding.status) && isOverdue(finding.dueDate);

  return (
    <Section
      title="Management response"
      description="Provided by the business owner. Required together with an action owner and due date before the finding can be agreed."
      actions={canRespond && finding.dueDate ? <Button size="sm" variant="outline" onClick={() => { setExt({ dueDate: toInputDate(finding.dueDate), reason: '' }); setExtendOpen(true); }}><CalendarClock /> Extend due date</Button> : null}
    >
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EditableField className="sm:col-span-2" label="Response" value={finding.managementResponse} onSave={save('managementResponse')} multiline rows={5} canEdit={canRespond} prominent placeholder="Management agrees / disagrees and the planned action" />
        <div className="min-w-0">
          <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Action owner</dt>
          <dd className="mt-0.5">
            {canRespond ? (
              <UserPicker value={finding.actionOwnerId} initial={finding.actionOwner} onChange={(id, user) => void update.mutateAsync({ actionOwnerId: id, actionOwnerName: user?.displayName ?? finding.actionOwnerName ?? null, actionOwnerEmail: user?.email ?? finding.actionOwnerEmail ?? null, silent: true })} placeholder="Assign a platform user…" />
            ) : finding.actionOwner ? (
              <span className="flex items-center gap-1.5 text-sm"><UserAvatar name={finding.actionOwner.displayName} src={finding.actionOwner.avatarUrl} size="xs" />{finding.actionOwner.displayName}</span>
            ) : (
              <span className="text-sm text-muted-foreground">{finding.actionOwnerName ?? 'Unassigned'}</span>
            )}
          </dd>
        </div>
        <EditableField label="Due date" value={toInputDate(finding.dueDate)} type="date" onSave={save('dueDate')} canEdit={canRespond} render={(v) => <span className={cn(overdue && 'font-medium text-destructive')}>{fmtDate(String(v || ''))}{finding.dueDate && !TERMINAL.includes(finding.status) ? <span className="ml-1 text-2xs text-muted-foreground">({fmtDueIn(finding.dueDate)})</span> : null}</span>} />
        <EditableField label="Owner name (external)" value={finding.actionOwnerName} onSave={save('actionOwnerName')} canEdit={canRespond} placeholder="Name if not a platform user" />
        <EditableField label="Owner email (external)" value={finding.actionOwnerEmail} onSave={save('actionOwnerEmail')} canEdit={canRespond} type="email" placeholder="name@example.com" />
        {finding.originalDueDate && finding.originalDueDate !== finding.dueDate ? <DescriptionItem label="Original due date">{fmtDate(finding.originalDueDate)} · extended {finding.extensionCount} time{finding.extensionCount === 1 ? '' : 's'}</DescriptionItem> : finding.extensionCount ? <DescriptionItem label="Extensions">{finding.extensionCount}</DescriptionItem> : null}
      </dl>

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Extend due date</DialogTitle><DialogDescription>Extensions are counted and reported to the audit committee. The original due date is kept for ageing.</DialogDescription></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="ext-date" required>New due date</Label><Input id="ext-date" type="date" value={ext.dueDate} min={toInputDate(finding.dueDate) || undefined} onChange={(e) => setExt({ ...ext, dueDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="ext-reason" required>Reason</Label><Textarea id="ext-reason" rows={3} value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} placeholder="Why the original date cannot be met" /></div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>Cancel</Button>
            <Button loading={extend.isPending} disabled={!ext.dueDate || !ext.reason.trim()} onClick={async () => { await extend.mutateAsync({ dueDate: new Date(ext.dueDate).toISOString(), reason: ext.reason.trim() }); setExtendOpen(false); }}>Extend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function DetailsPanel({ finding }: { finding: Finding }) {
  const can = useCan();
  const canManage = can('finding:manage') && !TERMINAL.includes(finding.status);
  const update = useUpdateFinding(finding.id);
  const save = (field: keyof FindingInput) => (v: string) => update.mutateAsync({ [field]: v === '' ? null : v, silent: true } as FindingInput & { silent?: boolean });
  return (
    <Section title="Details">
      <dl className="grid grid-cols-2 gap-3">
        <EditableField label="Severity" value={finding.severity} onSave={save('severity')} canEdit={canManage} options={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))} render={(v) => <SeverityBadge severity={String(v)} />} />
        <DescriptionItem label="Ageing"><span className="flex items-center gap-1"><AgeingBadge bucket={finding.ageingBucket} />{finding.daysOverdue ? <span className="text-2xs text-destructive">{finding.daysOverdue}d</span> : null}</span></DescriptionItem>
        <EditableField label="Root cause" value={finding.rootCauseCategory} onSave={save('rootCauseCategory')} canEdit={canManage} options={enumOptions(ROOT_CAUSE_LABELS)} render={(v) => (v ? ROOT_CAUSE_LABELS[v as keyof typeof ROOT_CAUSE_LABELS] ?? String(v) : <span className="text-muted-foreground">Not classified</span>)} />
        <EditableField label="Category" value={finding.category} onSave={save('category')} canEdit={canManage} placeholder="e.g. Procurement" />
        <DescriptionItem label="Engagement" className="col-span-2">{finding.engagement ? <Link href={`/engagements/${finding.engagement.id}`} className="hover:underline"><span className="font-mono text-xs text-muted-foreground">{finding.engagement.auditNumber}</span> {finding.engagement.title}</Link> : '—'}</DescriptionItem>
        <DescriptionItem label="Entity">{finding.entity ? <Link href={`/universe?entity=${finding.entity.id}`} className="hover:underline">{finding.entity.name}</Link> : '—'}</DescriptionItem>
        <DescriptionItem label="Process">{finding.process?.name ?? '—'}</DescriptionItem>
        <DescriptionItem label="Risk">{finding.risk ? <Link href={`/risks?risk=${finding.risk.id}`} className="hover:underline"><span className="font-mono text-xs">{finding.risk.code}</span> {finding.risk.title}</Link> : '—'}</DescriptionItem>
        <DescriptionItem label="Control">{finding.control ? <Link href={`/controls?control=${finding.control.id}`} className="hover:underline"><span className="font-mono text-xs">{finding.control.code}</span> {finding.control.title}</Link> : '—'}</DescriptionItem>
        <DescriptionItem label="Workpaper" className="col-span-2">{finding.workpaper ? <Link href={`/workpapers/${finding.workpaper.id}`} className="hover:underline"><span className="font-mono text-xs">{finding.workpaper.reference}</span> {finding.workpaper.title}</Link> : '—'}</DescriptionItem>
        <DescriptionItem label="Raised by">{finding.raisedBy ? <span className="flex items-center gap-1.5"><UserAvatar name={finding.raisedBy.displayName} size="xs" />{finding.raisedBy.displayName}</span> : '—'}</DescriptionItem>
        <DescriptionItem label="Raised">{fmtDate(finding.createdAt)}</DescriptionItem>
        {finding.repeatOfId ? <DescriptionItem label="Repeat of" className="col-span-2"><Link href={`/findings/${finding.repeatOfId}`} className="inline-flex items-center gap-1 text-warning hover:underline"><Repeat className="size-3" /> Previous finding</Link></DescriptionItem> : null}
        {finding.agreedAt ? <DescriptionItem label="Agreed">{fmtDate(finding.agreedAt)}</DescriptionItem> : null}
        {finding.implementedAt ? <DescriptionItem label="Implemented">{fmtDate(finding.implementedAt)}</DescriptionItem> : null}
        {finding.validatedAt ? <DescriptionItem label="Validated">{finding.validatedBy?.displayName ? `${finding.validatedBy.displayName} · ` : ''}{fmtDate(finding.validatedAt)}</DescriptionItem> : null}
        {finding.closedAt ? <DescriptionItem label="Closed">{fmtDate(finding.closedAt)}</DescriptionItem> : null}
        {finding.escalationLevel ? <DescriptionItem label="Escalation">{['Owner', 'Line manager', 'CAE', 'Audit committee'][finding.escalationLevel] ?? `Level ${finding.escalationLevel}`}</DescriptionItem> : null}
      </dl>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

type RecDraft = { text: string; priority: TaskPriority; ownerId: string | null; ownerName: string; dueDate: string; status: RecommendationStatus; progressPct: number; actionPlan: string; progressNote: string };
const emptyRec = (): RecDraft => ({ text: '', priority: 'MEDIUM', ownerId: null, ownerName: '', dueDate: '', status: 'PROPOSED', progressPct: 0, actionPlan: '', progressNote: '' });

function RecommendationsTab({ finding }: { finding: Finding }) {
  const can = useCan();
  const canManage = can('finding:manage') && !TERMINAL.includes(finding.status);
  const canProgress = (can('finding:respond') || can('finding:manage')) && !TERMINAL.includes(finding.status);
  const add = useAddRecommendation(finding.id);
  const update = useUpdateRecommendation(finding.id);
  const [dialog, setDialog] = React.useState<{ open: boolean; rec?: Recommendation }>({ open: false });
  const [draft, setDraft] = React.useState<RecDraft>(emptyRec());
  const recs = React.useMemo(() => [...(finding.recommendations ?? [])].sort((a, b) => a.sequence - b.sequence), [finding.recommendations]);

  const openNew = () => { setDraft(emptyRec()); setDialog({ open: true }); };
  const openEdit = (rec: Recommendation) => {
    setDraft({ text: rec.text, priority: rec.priority, ownerId: rec.ownerId ?? null, ownerName: rec.ownerName ?? '', dueDate: toInputDate(rec.dueDate), status: rec.status, progressPct: rec.progressPct ?? 0, actionPlan: rec.actionPlan ?? '', progressNote: rec.progressNote ?? '' });
    setDialog({ open: true, rec });
  };
  const submit = async () => {
    const payload: Partial<Recommendation> = {
      text: draft.text.trim(),
      priority: draft.priority,
      ownerId: draft.ownerId,
      ownerName: draft.ownerName || null,
      dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
      status: draft.status,
      progressPct: Math.max(0, Math.min(100, Number(draft.progressPct) || 0)),
      actionPlan: draft.actionPlan || null,
      progressNote: draft.progressNote || null,
    };
    if (dialog.rec) await update.mutateAsync({ id: dialog.rec.id, ...payload });
    else await add.mutateAsync(payload);
    setDialog({ open: false });
  };
  const isEdit = !!dialog.rec;
  const overall = recs.length ? Math.round(recs.reduce((s, r) => s + (r.progressPct ?? 0), 0) / recs.length) : 0;

  return (
    <Section
      title={<span className="flex items-center gap-2">Recommendations {recs.length ? <Badge variant="muted">{recs.length}</Badge> : null}</span>}
      description={recs.length ? <span className="flex items-center gap-2">Overall progress <Progress value={overall} size="sm" className="w-32" tone={overall >= 100 ? 'success' : 'primary'} /> {overall}%</span> : 'Break the corrective action into trackable recommendations with owners and due dates.'}
      actions={canManage ? <Button size="sm" onClick={openNew}><Plus /> Add recommendation</Button> : null}
      bodyClassName="p-0"
    >
      {recs.length === 0 ? <EmptyState compact icon={<ClipboardList />} title="No recommendations yet" description={finding.recommendation ? 'The headline recommendation is captured in the five Cs. Add itemised actions here to track implementation.' : undefined} action={canManage ? <Button size="sm" variant="outline" onClick={openNew}><Plus /> Add recommendation</Button> : undefined} /> : (
        <ol className="divide-y divide-border">
          {recs.map((r) => {
            const late = r.dueDate && isOverdue(r.dueDate) && !['IMPLEMENTED', 'VALIDATED', 'SUPERSEDED'].includes(r.status);
            return (
              <li key={r.id} className="group flex gap-3 px-4 py-3">
                <span className="mt-0.5 font-mono text-xs text-muted-foreground">R{r.sequence}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm">{r.text}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                    <GenericStatusBadge value={r.status} labels={RECOMMENDATION_STATUS_LABELS} tone={r.status === 'VALIDATED' || r.status === 'IMPLEMENTED' ? 'success' : r.status === 'IN_PROGRESS' ? 'warning' : r.status === 'NOT_IMPLEMENTED' ? 'danger' : 'muted'} />
                    <GenericStatusBadge value={r.priority} labels={TASK_PRIORITY_LABELS} tone={r.priority === 'URGENT' ? 'danger' : r.priority === 'HIGH' ? 'warning' : 'muted'} />
                    <span>{r.owner?.displayName ?? r.ownerName ?? 'No owner'}</span>
                    {r.dueDate ? <span className={cn(late && 'text-destructive')}>· due {fmtDate(r.dueDate)}</span> : null}
                    {r.completedAt ? <span>· completed {fmtDate(r.completedAt)}</span> : null}
                  </div>
                  {r.actionPlan ? <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Plan:</span> {r.actionPlan}</p> : null}
                  {r.progressNote ? <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Progress:</span> {r.progressNote}</p> : null}
                  <div className="flex items-center gap-2"><Progress value={r.progressPct ?? 0} size="sm" className="w-40" tone={(r.progressPct ?? 0) >= 100 ? 'success' : 'primary'} /><span className="text-2xs tabular-nums text-muted-foreground">{r.progressPct ?? 0}%</span></div>
                </div>
                {canProgress ? <Button size="icon-sm" variant="ghost" className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Edit recommendation" onClick={() => openEdit(r)}><Pencil /></Button> : null}
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => !o && setDialog({ open: false })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isEdit ? `Edit recommendation R${dialog.rec?.sequence}` : 'Add recommendation'}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="rec-text" required>Recommendation</Label><Textarea id="rec-text" autoFocus rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} disabled={isEdit && !canManage} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Priority</Label><SimpleSelect value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as TaskPriority })} options={enumOptions(TASK_PRIORITY_LABELS)} /></div>
              <div className="space-y-1.5"><Label htmlFor="rec-due">Due date</Label><Input id="rec-due" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Owner</Label><UserPicker value={draft.ownerId} initial={dialog.rec?.owner} onChange={(id, u) => setDraft({ ...draft, ownerId: id, ownerName: u?.displayName ?? draft.ownerName })} /></div>
              <div className="space-y-1.5"><Label htmlFor="rec-owner">Owner name (external)</Label><Input id="rec-owner" value={draft.ownerName} onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })} /></div>
            </div>
            {isEdit ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Status</Label><SimpleSelect value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as RecommendationStatus })} options={enumOptions(RECOMMENDATION_STATUS_LABELS)} /></div>
                  <div className="space-y-1.5"><Label htmlFor="rec-pct">Progress %</Label><Input id="rec-pct" type="number" min={0} max={100} value={draft.progressPct} onChange={(e) => setDraft({ ...draft, progressPct: Number(e.target.value) })} /></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="rec-plan">Action plan</Label><Textarea id="rec-plan" rows={2} value={draft.actionPlan} onChange={(e) => setDraft({ ...draft, actionPlan: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="rec-note">Progress note</Label><Textarea id="rec-note" rows={2} value={draft.progressNote} onChange={(e) => setDraft({ ...draft, progressNote: e.target.value })} /></div>
              </>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })}>Cancel</Button>
            <Button loading={add.isPending || update.isPending} disabled={!draft.text.trim()} onClick={submit}>{isEdit ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Evidence, history, audit trail
// ---------------------------------------------------------------------------

function EvidenceTab({ finding }: { finding: Finding }) {
  const docs = useDocuments('Finding', finding.id);
  const evidence = finding.evidence ?? [];
  const canUpload = !TERMINAL.includes(finding.status);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Section title="Implementation evidence" description="Documents attached directly to this finding. Required before validation can be requested.">
        <div className="space-y-3">
          {canUpload ? <Can permission="document:upload"><FileUpload ownerType="Finding" ownerId={finding.id} compact /></Can> : null}
          {docs.isLoading ? <SkeletonRows rows={2} /> : docs.error ? <ErrorState error={docs.error} compact onRetry={() => docs.refetch()} /> : <DocumentList documents={docs.data} ownerType="Finding" ownerId={finding.id} emptyText="No documents attached yet." />}
        </div>
      </Section>
      <Section title="Linked audit evidence" description="Evidence from the engagement evidence log that supports this finding." bodyClassName="p-0">
        {evidence.length === 0 ? <EmptyState compact icon={<Paperclip />} title="No linked evidence" /> : (
          <ul className="divide-y divide-border">
            {evidence.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm"><span className="font-mono text-2xs text-muted-foreground">{e.reference}</span> {e.description}</p>
                  <p className="truncate text-2xs text-muted-foreground">{EVIDENCE_TYPE_LABELS[e.type] ?? e.type}{e.obtainedFrom ? ` · from ${e.obtainedFrom}` : ''}{e.document ? ` · ${e.document.fileName}` : ''}</p>
                </div>
                {e.document ? <Button size="icon-sm" variant="ghost" aria-label={`Download ${e.document.fileName}`} onClick={() => downloadDocument(e.document!.id).catch((err) => toast.error(errorMessage(err)))}><Download /></Button> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function AuditTab({ finding }: { finding: Finding }) {
  const trail = useAuditTrail({ targetType: 'Finding', targetId: finding.id, pageSize: 100 });
  return (
    <Section title="Audit trail" description="Every change recorded against this finding." bodyClassName="p-0">
      {trail.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div> : trail.error ? <ErrorState error={trail.error} compact onRetry={() => trail.refetch()} /> : !trail.data?.items.length ? <EmptyState compact title="No entries" /> : (
        <ul className="divide-y divide-border">
          {trail.data.items.map((e) => (
            <li key={String(e.id)} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium">{humanize(e.action.replace(/\./g, '_'))}</span><span className="text-muted-foreground">{fmtDateTime(e.occurredAt)}</span></div>
              <p className="text-2xs text-muted-foreground">{e.actor?.displayName ?? e.actorEmail ?? 'System'}{e.requestId ? ` · ${e.requestId}` : ''}</p>
              {e.before || e.after ? <div className="mt-2"><JsonDiff before={e.before} after={e.after} /></div> : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function FindingDetail({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const can = useCan();
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'overview') as Tab;
  const { data: finding, isLoading, error, refetch } = useFinding(id);
  const transition = useFindingTransition(id);
  const setTab = (t: string) => { const sp = new URLSearchParams(params.toString()); sp.set('tab', t); router.replace(`/findings/${id}?${sp}`, { scroll: false }); };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-16 w-full" /><SkeletonRows rows={6} /></div>;
  if (error || !finding) return <ErrorState error={error} onRetry={() => refetch()} />;

  const canManage = can('finding:manage') && !TERMINAL.includes(finding.status);
  const path = finding.status === 'RISK_ACCEPTED' ? (['DRAFT', 'MANAGEMENT_REVIEW', 'RISK_ACCEPTED'] as FindingStatus[]) : FINDING_STATUSES.filter((s) => s !== 'RISK_ACCEPTED');
  const steps = path.map((s) => ({ key: s, label: FINDING_STATUS_LABELS[s] ?? humanize(s) }));
  const overdue = !TERMINAL.includes(finding.status) && !!finding.daysOverdue;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Findings', href: '/findings' }, ...(finding.engagement ? [{ label: finding.engagement.auditNumber, href: `/engagements/${finding.engagement.id}?tab=findings` }] : []), { label: finding.reference }]}
        title={finding.title}
        meta={<><Badge variant="outline" className="font-mono normal-case tracking-normal">{finding.reference}</Badge><SeverityBadge severity={finding.severity} /><FindingStatusBadge status={finding.status} />{finding.isRepeat || finding.repeatOfId ? <Badge variant="warning"><Repeat className="size-3" /> Repeat</Badge> : null}{overdue ? <Badge variant="danger">{finding.daysOverdue}d overdue</Badge> : null}</>}
        description={<>{finding.engagement ? <Link href={`/engagements/${finding.engagement.id}`} className="hover:underline">{finding.engagement.auditNumber} · {finding.engagement.title}</Link> : 'No engagement'}{finding.entity ? ` · ${finding.entity.name}` : ''}{finding.dueDate ? ` · Due ${fmtDate(finding.dueDate)}` : ''}</>}
        actions={<WorkflowActions machine={FINDING_WORKFLOW} state={finding.status} serverActions={finding.availableActions} onTransition={(action, comment) => transition.mutateAsync({ action, comment })} isPending={transition.isPending} requireComment={['accept_risk', 'reject_validation', 'return_to_draft']} />}
      >
        <div className="surface px-4 py-3">
          <StageStepper steps={steps} current={finding.status} terminalKeys={TERMINAL} />
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations {finding.recommendations?.length ? <Badge variant="muted">{finding.recommendations.length}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="evidence">Evidence {finding.evidence?.length ? <Badge variant="muted">{finding.evidence.length}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          {can('audit_trail:read') ? <TabsTrigger value="audit">Audit trail</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <FiveCs finding={finding} canManage={canManage} />
              <ManagementResponse finding={finding} />
            </div>
            <DetailsPanel finding={finding} />
          </div>
        </TabsContent>
        <TabsContent value="recommendations"><RecommendationsTab finding={finding} /></TabsContent>
        <TabsContent value="evidence"><EvidenceTab finding={finding} /></TabsContent>
        <TabsContent value="history">
          <Section title="Status history">
            <HistoryTimeline entries={(finding.statusHistory ?? []).map((h) => ({ id: h.id, from: h.fromStatus, to: h.toStatus, actor: h.changedBy, comment: h.comment, at: h.changedAt }))} labelFor={(k) => FINDING_STATUS_LABELS[k] ?? humanize(k)} />
          </Section>
        </TabsContent>
        <TabsContent value="comments"><Section title="Discussion" description="Internal comments are hidden from business owners."><CommentsThread targetType="Finding" targetId={finding.id} /></Section></TabsContent>
        {can('audit_trail:read') ? <TabsContent value="audit"><AuditTab finding={finding} /></TabsContent> : null}
      </Tabs>
    </>
  );
}

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <React.Suspense fallback={<div className="space-y-4"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-2/3" /><SkeletonRows rows={6} /></div>}>
      <FindingDetail id={id} />
    </React.Suspense>
  );
}
