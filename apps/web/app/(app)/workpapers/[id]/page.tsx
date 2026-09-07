'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, Check, CheckCircle2, Download, Eye, FileText, History, Loader2, Lock, MessageSquareWarning, Paperclip, Plus, Send } from 'lucide-react';
import { WORKPAPER_WORKFLOW } from '@auditsphere/shared';
import { PageHeader, Section, DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SimpleSelect } from '@/components/ui/select';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/avatar';
import { WorkflowActions } from '@/components/domain/guard-dialog';
import { WorkpaperStatusBadge, GenericStatusBadge } from '@/components/domain/badges';
import { CommentsThread } from '@/components/domain/comments-thread';
import { UserPicker } from '@/components/domain/user-picker';
import { FileUpload } from '@/components/domain/file-upload';
import { JsonDiff } from '@/components/domain/json-diff';
import { useCan, useCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/lib/api';
import { useRaiseReviewNote, useUpdateReviewNote, useUpdateWorkpaper, useWorkpaper, useWorkpaperTransition, useWorkpaperVersion, type WorkpaperPatch } from '@/lib/queries/workpapers';
import { useRisks } from '@/lib/queries/risks';
import { useControls } from '@/lib/queries/controls';
import { downloadDocument, useCreateEvidence } from '@/lib/queries/documents';
import { EVIDENCE_TYPE_LABELS, enumOptions } from '@/lib/labels';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { cn, fileSize } from '@/lib/utils';
import type { Document, EvidenceType, ReviewNote, ReviewNotePriority, Workpaper } from '@/lib/types';

// ---------------------------------------------------------------------------
// Autosave plumbing
// ---------------------------------------------------------------------------

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; version: number; at: Date } | { kind: 'error'; message: string };

function SaveIndicator({ status, version }: { status: SaveStatus; version: number }) {
  if (status.kind === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status.kind === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive" title={status.message}>
        <AlertCircle className="size-3" /> Not saved
      </span>
    );
  }
  if (status.kind === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success" title={`Saved ${fmtDateTime(status.at)}`}>
        <Check className="size-3" /> Saved v{status.version}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">v{version}</span>;
}

/** Text field that keeps a local draft and persists on blur when changed. */
function AutosaveField({
  id,
  label,
  value,
  onSave,
  disabled,
  multiline,
  rows = 4,
  hint,
  mono,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value?: string | null;
  onSave: (v: string) => Promise<unknown>;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  mono?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(value ?? '');
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) setDraft(value ?? '');
  }, [value, dirty]);

  const commit = async () => {
    if (!dirty) return;
    if (draft === (value ?? '')) {
      setDirty(false);
      return;
    }
    try {
      await onSave(draft);
    } finally {
      setDirty(false);
    }
  };

  const common = {
    id,
    value: draft,
    disabled,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      setDirty(true);
    },
    onBlur: () => void commit(),
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {dirty ? <span className="text-2xs text-muted-foreground">Unsaved · saves on blur</span> : null}
      </div>
      {multiline ? (
        <Textarea {...common} rows={rows} className={cn(mono && 'font-mono')} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') (e.target as HTMLTextAreaElement).blur(); }} />
      ) : (
        <Input {...common} className={cn(mono && 'font-mono')} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      )}
      {hint ? <p className="text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-hand panels
// ---------------------------------------------------------------------------

function Stamp({ label, user, at, done }: { label: string; user?: { displayName: string; avatarUrl?: string | null } | null; at?: string | null; done: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-md border px-2.5 py-2', done ? 'border-success/40 bg-success/5' : 'border-dashed border-border')}>
      {done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <span className="size-4 shrink-0 rounded-full border-2 border-border" />}
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {done ? (
          <p className="flex items-center gap-1.5 truncate text-xs">
            <UserAvatar name={user?.displayName} src={user?.avatarUrl} size="xs" />
            <span className="truncate">{user?.displayName ?? 'Unknown'}</span>
            <span className="text-muted-foreground">· {fmtDateTime(at)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Pending</p>
        )}
      </div>
    </div>
  );
}

const PRIORITY_TONES: Record<ReviewNotePriority, 'muted' | 'warning' | 'danger'> = { LOW: 'muted', NORMAL: 'warning', HIGH: 'danger' };
const NOTE_STATUS_TONES: Record<ReviewNote['status'], 'danger' | 'info' | 'success'> = { OPEN: 'danger', ADDRESSED: 'info', CLEARED: 'success' };

function ReviewNoteItem({ note, workpaperId }: { note: ReviewNote; workpaperId: string }) {
  const { user } = useCurrentUser();
  const can = useCan();
  const update = useUpdateReviewNote(workpaperId);
  const [responding, setResponding] = React.useState(false);
  const [response, setResponse] = React.useState(note.response ?? '');

  const isRaiser = user?.id === note.raisedById;
  const isAssignee = !!user && user.id === note.assignedToId;
  const canRespond = note.status === 'OPEN' && (isAssignee || can('workpaper:prepare'));
  const canClear = note.status !== 'CLEARED' && (isRaiser || can('workpaper:review'));

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <GenericStatusBadge value={note.priority} tone={PRIORITY_TONES[note.priority] ?? 'muted'} />
        <GenericStatusBadge value={note.status} tone={NOTE_STATUS_TONES[note.status] ?? 'secondary'} />
        <span className="ml-auto text-2xs text-muted-foreground">{fmtRelative(note.createdAt)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{note.text}</p>
      <p className="flex flex-wrap items-center gap-x-2 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><UserAvatar name={note.raisedBy?.displayName} size="xs" /> {note.raisedBy?.displayName ?? 'Unknown'}</span>
        {note.assignedTo ? <span>→ {note.assignedTo.displayName}</span> : null}
      </p>
      {note.response ? (
        <div className="rounded-md bg-muted/60 px-2.5 py-2 text-xs">
          <p className="mb-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Response{note.respondedAt ? ` · ${fmtDateTime(note.respondedAt)}` : ''}</p>
          <p className="whitespace-pre-wrap">{note.response}</p>
        </div>
      ) : null}
      {note.status === 'CLEARED' && note.clearedBy ? <p className="text-2xs text-success">Cleared by {note.clearedBy.displayName} · {fmtDateTime(note.clearedAt)}</p> : null}
      {responding ? (
        <div className="space-y-1.5">
          <Textarea autoFocus rows={3} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Describe how the note was addressed…" />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setResponding(false)}>Cancel</Button>
            <Button size="sm" loading={update.isPending} disabled={!response.trim()} onClick={async () => { await update.mutateAsync({ noteId: note.id, response: response.trim() }); setResponding(false); }}><Send /> Respond</Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-1.5">
          {canRespond ? <Button size="sm" variant="outline" onClick={() => setResponding(true)}>Respond</Button> : null}
          {canClear ? <Button size="sm" variant="outline" loading={update.isPending} onClick={() => update.mutate({ noteId: note.id, clear: true })}><Check /> Clear</Button> : null}
        </div>
      )}
    </li>
  );
}

function ReviewNotesPanel({ wp }: { wp: Workpaper }) {
  const can = useCan();
  const raise = useRaiseReviewNote(wp.id);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<{ text: string; priority: ReviewNotePriority; assignedToId: string | null }>({ text: '', priority: 'NORMAL', assignedToId: wp.preparedBy?.id ?? null });
  const notes = React.useMemo(() => [...(wp.reviewNotes ?? [])].sort((a, b) => (a.status === 'CLEARED' ? 1 : 0) - (b.status === 'CLEARED' ? 1 : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [wp.reviewNotes]);
  const openCount = notes.filter((n) => n.status === 'OPEN').length;

  return (
    <Section
      title={<span className="flex items-center gap-2">Review notes {openCount ? <Badge variant="danger">{openCount} open</Badge> : null}</span>}
      actions={can('workpaper:review') ? <Button size="sm" variant="ghost" onClick={() => { setDraft({ text: '', priority: 'NORMAL', assignedToId: wp.preparedBy?.id ?? null }); setOpen(true); }}><Plus /> Raise</Button> : null}
      bodyClassName="p-0"
    >
      {notes.length === 0 ? <EmptyState compact icon={<MessageSquareWarning />} title="No review notes" description="Reviewers raise notes here; the preparer responds and the reviewer clears them." /> : (
        <ul className="divide-y divide-border">{notes.map((n) => <ReviewNoteItem key={n.id} note={n} workpaperId={wp.id} />)}</ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Raise review note</DialogTitle><DialogDescription>The assignee is notified and must respond before the note can be cleared.</DialogDescription></DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="rn-text" required>Note</Label><Textarea id="rn-text" autoFocus rows={4} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="What needs to be addressed?" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Priority</Label><SimpleSelect value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v as ReviewNotePriority })} options={[{ value: 'LOW', label: 'Low' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'High' }]} /></div>
              <div className="space-y-1.5"><Label>Assign to</Label><UserPicker value={draft.assignedToId} onChange={(id) => setDraft({ ...draft, assignedToId: id })} initial={wp.preparedBy} /></div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={raise.isPending} disabled={!draft.text.trim()} onClick={async () => { await raise.mutateAsync({ text: draft.text.trim(), priority: draft.priority, assignedToId: draft.assignedToId ?? undefined }); setOpen(false); }}>Raise note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function EvidencePanel({ wp }: { wp: Workpaper }) {
  const createEvidence = useCreateEvidence();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<{ description: string; type: EvidenceType; obtainedFrom: string; documentId?: string; fileName?: string }>({ description: '', type: 'DOCUMENT', obtainedFrom: '' });
  const evidence = wp.evidence ?? [];

  return (
    <Section
      title={<span className="flex items-center gap-2">Evidence {evidence.length ? <Badge variant="muted">{evidence.length}</Badge> : null}</span>}
      actions={!wp.isLocked ? <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Plus /> Add</Button> : null}
      bodyClassName="p-0"
    >
      {evidence.length === 0 ? <EmptyState compact icon={<Paperclip />} title="No evidence attached" description="Upload supporting documents and register them as evidence." /> : (
        <ul className="divide-y divide-border">
          {evidence.map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-mono text-2xs text-muted-foreground">{e.reference}</span> {e.description}</p>
                <p className="truncate text-2xs text-muted-foreground">{EVIDENCE_TYPE_LABELS[e.type] ?? e.type}{e.obtainedFrom ? ` · from ${e.obtainedFrom}` : ''}{e.document ? ` · ${e.document.fileName} (${fileSize(e.document.sizeBytes)})` : ''}</p>
              </div>
              {e.document ? <Button size="icon-sm" variant="ghost" aria-label={`Download ${e.document.fileName}`} onClick={() => downloadDocument(e.document!.id).catch((err) => toast.error(errorMessage(err)))}><Download /></Button> : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add evidence</DialogTitle><DialogDescription>Files are uploaded against this workpaper and registered in the engagement evidence log.</DialogDescription></DialogHeader>
          <DialogBody className="space-y-3">
            <FileUpload ownerType="Workpaper" ownerId={wp.id} multiple={false} compact onUploaded={(doc: Document) => setV((s) => ({ ...s, documentId: doc.id, fileName: doc.fileName, description: s.description || doc.fileName }))} />
            {v.fileName ? <p className="text-xs text-success">Attached: {v.fileName}</p> : null}
            <div className="space-y-1.5"><Label htmlFor="ev-desc" required>Description</Label><Input id="ev-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Type</Label><SimpleSelect value={v.type} onValueChange={(t) => setV({ ...v, type: t as EvidenceType })} options={enumOptions(EVIDENCE_TYPE_LABELS)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ev-from">Obtained from</Label><Input id="ev-from" value={v.obtainedFrom} onChange={(e) => setV({ ...v, obtainedFrom: e.target.value })} /></div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={createEvidence.isPending} disabled={!v.description.trim()} onClick={async () => { await createEvidence.mutateAsync({ engagementId: wp.engagementId, workpaperId: wp.id, documentId: v.documentId, description: v.description.trim(), type: v.type, obtainedFrom: v.obtainedFrom || undefined }); setOpen(false); setV({ description: '', type: 'DOCUMENT', obtainedFrom: '' }); }}>Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

const SNAPSHOT_FIELDS: { key: keyof Workpaper; label: string }[] = [
  { key: 'reference', label: 'Reference' },
  { key: 'title', label: 'Title' },
  { key: 'objective', label: 'Objective' },
  { key: 'procedure', label: 'Procedure' },
  { key: 'testPerformed', label: 'Test performed' },
  { key: 'results', label: 'Results' },
  { key: 'exceptions', label: 'Exceptions' },
  { key: 'conclusion', label: 'Conclusion' },
];

function pickSnapshot(source: Partial<Workpaper> | Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of SNAPSHOT_FIELDS) out[f.key] = (source as Record<string, unknown>)[f.key] ?? null;
  return out;
}

function VersionsPanel({ wp }: { wp: Workpaper }) {
  const [viewing, setViewing] = React.useState<number | null>(null);
  const snapshot = useWorkpaperVersion(wp.id, viewing ?? undefined);
  const versions = React.useMemo(() => [...(wp.versions ?? [])].sort((a, b) => b.versionNumber - a.versionNumber), [wp.versions]);
  const [compare, setCompare] = React.useState(false);

  return (
    <Section title={<span className="flex items-center gap-2">Version history <Badge variant="outline">v{wp.currentVersion}</Badge></span>} bodyClassName="p-0">
      {versions.length === 0 ? <EmptyState compact icon={<History />} title="No previous versions" description="A snapshot is stored every time the workpaper is saved." /> : (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-2 px-4 py-2 text-sm">
              <Badge variant="outline" className="font-mono normal-case tracking-normal">v{v.versionNumber}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{v.changedBy?.displayName ?? 'Unknown'} · {fmtDateTime(v.createdAt)}</p>
                {v.changeSummary ? <p className="truncate text-2xs text-muted-foreground">{v.changeSummary}</p> : null}
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setViewing(v.versionNumber); setCompare(false); }}><Eye /> View</Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Snapshot v{viewing}</DialogTitle>
            <DialogDescription>{snapshot.data ? `Captured ${fmtDateTime(snapshot.data.createdAt)}${snapshot.data.changedBy ? ` by ${snapshot.data.changedBy.displayName}` : ''}` : 'Loading snapshot…'}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {snapshot.isLoading ? <SkeletonRows rows={6} /> : snapshot.error ? <ErrorState error={snapshot.error} compact onRetry={() => snapshot.refetch()} /> : snapshot.data ? (
              <>
                <div className="flex justify-end">
                  <Button size="sm" variant={compare ? 'subtle' : 'outline'} onClick={() => setCompare((c) => !c)}>{compare ? 'Show snapshot' : `Compare with v${wp.currentVersion}`}</Button>
                </div>
                {compare ? (
                  <JsonDiff before={pickSnapshot(snapshot.data.snapshot)} after={pickSnapshot(wp)} />
                ) : (
                  <dl className="space-y-3">
                    {SNAPSHOT_FIELDS.map((f) => {
                      const val = (snapshot.data!.snapshot as Record<string, unknown>)[f.key];
                      return <DescriptionItem key={f.key} label={f.label}><span className={cn('whitespace-pre-wrap', !val && 'text-muted-foreground')}>{val ? String(val) : '—'}</span></DescriptionItem>;
                    })}
                  </dl>
                )}
              </>
            ) : null}
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setViewing(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkpaperEditorPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const { data: wp, isLoading, error, refetch } = useWorkpaper(id);
  const update = useUpdateWorkpaper(id, wp?.engagementId);
  const transition = useWorkpaperTransition(id, wp?.engagementId);
  const risks = useRisks({ pageSize: 200, sort: 'code:asc' }, !!wp);
  const controls = useControls({ pageSize: 200, sort: 'code:asc' }, !!wp);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>({ kind: 'idle' });

  const canEdit = !!wp && can('workpaper:prepare') && !wp.isLocked;

  const save = React.useCallback(
    async (patch: WorkpaperPatch) => {
      setSaveStatus({ kind: 'saving' });
      try {
        const updated = await update.mutateAsync(patch);
        setSaveStatus({ kind: 'saved', version: updated?.currentVersion ?? (wp?.currentVersion ?? 0) + 1, at: new Date() });
      } catch (e) {
        setSaveStatus({ kind: 'error', message: isApiError(e) && e.status === 409 ? 'The workpaper is locked or was changed elsewhere. Reload to continue.' : errorMessage(e) });
        throw e;
      }
    },
    [update, wp?.currentVersion],
  );
  const saveField = (key: keyof WorkpaperPatch) => (v: string) => save({ [key]: v === '' ? null : v } as WorkpaperPatch);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-4 w-56" /><Skeleton className="h-8 w-2/3" /><div className="grid grid-cols-1 gap-4 xl:grid-cols-3"><div className="xl:col-span-2"><SkeletonRows rows={8} /></div><SkeletonRows rows={6} /></div></div>;
  if (error || !wp) return <ErrorState error={error} onRetry={() => refetch()} />;

  const riskOptions = (risks.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.code} · ${r.title}` }));
  const controlOptions = (controls.data?.items ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` }));
  if (wp.risk && !riskOptions.some((o) => o.value === wp.risk!.id)) riskOptions.unshift({ value: wp.risk.id, label: `${wp.risk.code} · ${wp.risk.title}` });
  if (wp.control && !controlOptions.some((o) => o.value === wp.control!.id)) controlOptions.unshift({ value: wp.control.id, label: `${wp.control.code} · ${wp.control.title}` });

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Engagements', href: '/engagements' }, { label: wp.engagement?.auditNumber ?? 'Engagement', href: `/engagements/${wp.engagementId}?tab=workpapers` }, { label: wp.reference }]}
        title={wp.title}
        meta={<><Badge variant="outline" className="font-mono normal-case tracking-normal">{wp.reference}</Badge><WorkpaperStatusBadge status={wp.status} />{wp.isLocked ? <Badge variant="warning"><Lock className="size-3" /> Locked</Badge> : null}</>}
        description={wp.engagement ? <Link href={`/engagements/${wp.engagementId}`} className="hover:underline">{wp.engagement.auditNumber} · {wp.engagement.title}</Link> : undefined}
        actions={<SaveIndicator status={saveStatus} version={wp.currentVersion} />}
      />

      {wp.isLocked ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">This workpaper is signed off and locked.</p>
            <p className="text-xs text-muted-foreground">Content is read-only. {can('workpaper:unlock') ? 'Use Unlock in the workflow actions to make changes; a new version will be recorded.' : 'Ask the Chief Audit Executive to unlock it if changes are needed.'}</p>
          </div>
        </div>
      ) : !can('workpaper:prepare') ? (
        <div className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">You have read-only access to this workpaper.</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left: editor */}
        <div className="space-y-4 xl:col-span-2">
          <Section title="Identification" bodyClassName="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AutosaveField id="wp-reference" label="Reference" value={wp.reference} onSave={saveField('reference')} disabled={!canEdit} mono />
            <AutosaveField id="wp-title" label="Title" value={wp.title} onSave={saveField('title')} disabled={!canEdit} className="sm:col-span-2" />
            <AutosaveField id="wp-objective" label="Objective" value={wp.objective} onSave={saveField('objective')} disabled={!canEdit} multiline rows={3} className="sm:col-span-3" />
            <div className="space-y-1.5">
              <Label>Linked risk</Label>
              <SimpleSelect value={wp.riskId ?? ''} onValueChange={(v) => void save({ riskId: v || null })} options={riskOptions} allowClear clearLabel="None" placeholder={risks.isLoading ? 'Loading…' : 'Select risk'} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Linked control</Label>
              <SimpleSelect value={wp.controlId ?? ''} onValueChange={(v) => void save({ controlId: v || null })} options={controlOptions} allowClear clearLabel="None" placeholder={controls.isLoading ? 'Loading…' : 'Select control'} disabled={!canEdit} />
            </div>
          </Section>

          <Section title="Work performed" description="Changes save automatically when you leave a field. Ctrl+Enter also saves.">
            <div className="space-y-4">
              <AutosaveField id="wp-procedure" label="Procedure" value={wp.procedure} onSave={saveField('procedure')} disabled={!canEdit} multiline rows={6} hint="Required before the workpaper can be marked as prepared." />
              <AutosaveField id="wp-test" label="Test performed" value={wp.testPerformed} onSave={saveField('testPerformed')} disabled={!canEdit} multiline rows={6} placeholder="Population, sample selection, attributes tested…" />
              <AutosaveField id="wp-results" label="Results" value={wp.results} onSave={saveField('results')} disabled={!canEdit} multiline rows={6} />
              <AutosaveField id="wp-exceptions" label="Exceptions" value={wp.exceptions} onSave={saveField('exceptions')} disabled={!canEdit} multiline rows={4} placeholder="Deviations noted, with references to findings raised" />
              <AutosaveField id="wp-conclusion" label="Conclusion" value={wp.conclusion} onSave={saveField('conclusion')} disabled={!canEdit} multiline rows={4} hint="Required before the workpaper can be marked as prepared." />
            </div>
          </Section>

          <Section title="Discussion"><CommentsThread targetType="Workpaper" targetId={wp.id} /></Section>
        </div>

        {/* Right: status and collaboration */}
        <div className="space-y-4">
          <Section title="Status">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Current</span><WorkpaperStatusBadge status={wp.status} /></div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Version</span><span className="tabular-nums">v{wp.currentVersion}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Updated</span><span>{fmtDateTime(wp.updatedAt)}</span></div>
              <div className="pt-2">
                <WorkflowActions machine={WORKPAPER_WORKFLOW} state={wp.status} serverActions={wp.availableActions} onTransition={(action, comment) => transition.mutateAsync({ action, comment })} isPending={transition.isPending} size="sm" className="flex-wrap" />
              </div>
              <div className="space-y-2 pt-2">
                <Stamp label="Prepared" user={wp.preparedBy} at={wp.preparedAt} done={!!wp.preparedBy && !!wp.preparedAt} />
                <Stamp label="Reviewed" user={wp.reviewedBy} at={wp.reviewedAt} done={!!wp.reviewedBy && !!wp.reviewedAt} />
                <Stamp label="Signed off" user={wp.signedOffBy} at={wp.signedOffAt} done={!!wp.signedOffBy && !!wp.signedOffAt} />
              </div>
            </div>
          </Section>
          <ReviewNotesPanel wp={wp} />
          <EvidencePanel wp={wp} />
          <VersionsPanel wp={wp} />
        </div>
      </div>
    </>
  );
}
