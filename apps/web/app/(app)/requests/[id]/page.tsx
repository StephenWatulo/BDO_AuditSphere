'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, CalendarClock, Check, RotateCcw } from 'lucide-react';
import { REQUEST_WORKFLOW } from '@auditsphere/shared';
import { PageHeader, Section, DescriptionItem } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/avatar';
import { WorkflowActions } from '@/components/domain/guard-dialog';
import { RequestStatusBadge } from '@/components/domain/badges';
import { CommentsThread } from '@/components/domain/comments-thread';
import { EditableField } from '@/components/domain/editable-field';
import { FileUpload, DocumentList } from '@/components/domain/file-upload';
import { UserPicker } from '@/components/domain/user-picker';
import { Can, useCan, useCurrentUser } from '@/lib/auth';
import { useLinkRequestDocument, useRequest, useRequestTransition, useUpdateRequest, type RequestInput } from '@/lib/queries/requests';
import { fmtDate, fmtDateTime, fmtDueIn, isOverdue, toInputDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Document } from '@/lib/types';

const ACTIVE = ['OPEN', 'RETURNED'];

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const { user } = useCurrentUser();
  const { data: req, isLoading, error, refetch } = useRequest(id);
  const update = useUpdateRequest(id);
  const transition = useRequestTransition(id);
  const link = useLinkRequestDocument(id);
  const [note, setNote] = React.useState('');
  const [noteDirty, setNoteDirty] = React.useState(false);
  React.useEffect(() => { if (!noteDirty) setNote(req?.responseNote ?? ''); }, [req?.responseNote, noteDirty]);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-2/3" /><SkeletonRows rows={6} /></div>;
  if (error || !req) return <ErrorState error={error} onRetry={() => refetch()} />;

  const isAssignee = !!user && user.id === req.assigneeId;
  const active = ACTIVE.includes(req.status);
  const canManage = can('request:manage') && req.status !== 'ACCEPTED' && req.status !== 'CANCELLED';
  const canRespond = active && (can('request:respond') || can('request:manage')) && (isAssignee || can('request:manage') || !req.assigneeId);
  const late = active && isOverdue(req.dueDate);
  const save = (field: keyof RequestInput) => (v: string) => update.mutateAsync({ [field]: v === '' ? null : field === 'dueDate' ? new Date(v).toISOString() : v, silent: true } as RequestInput & { silent?: boolean });

  const saveNote = async () => {
    await update.mutateAsync({ responseNote: note.trim() || null });
    setNoteDirty(false);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Requests', href: '/requests' }, ...(req.engagement ? [{ label: req.engagement.auditNumber, href: `/engagements/${req.engagement.id}?tab=requests` }] : []), { label: req.reference }]}
        title={req.title}
        meta={<><Badge variant="outline" className="font-mono normal-case tracking-normal">{req.reference}</Badge><RequestStatusBadge status={req.status} />{late ? <Badge variant="danger"><AlertTriangle className="size-3" /> Overdue</Badge> : null}</>}
        description={<>{req.engagement ? <Link href={`/engagements/${req.engagement.id}`} className="hover:underline">{req.engagement.auditNumber} · {req.engagement.title}</Link> : 'No engagement'} · Due {fmtDate(req.dueDate)}{active ? ` (${fmtDueIn(req.dueDate)})` : ''}</>}
        actions={<WorkflowActions machine={REQUEST_WORKFLOW} state={req.status} serverActions={req.availableActions} onTransition={(action, comment) => transition.mutateAsync({ action, comment })} isPending={transition.isPending} requireComment={['return', 'cancel']} />}
      />

      {req.status === 'RETURNED' ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Returned by the audit team</p>
            <p className="text-xs text-muted-foreground">{req.returnReason || 'Please review the comments, update the response and resubmit.'}</p>
          </div>
        </div>
      ) : req.status === 'ACCEPTED' ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
          <Check className="size-4 shrink-0 text-success" />
          <p>Accepted {fmtDateTime(req.acceptedAt)}. No further action is required.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Section title="Request">
            <dl className="space-y-4">
              <EditableField label="Title" value={req.title} onSave={save('title')} canEdit={canManage} />
              <EditableField label="Description" value={req.description} onSave={save('description')} multiline rows={4} canEdit={canManage} prominent placeholder="What is needed, for which period and in what format" />
            </dl>
          </Section>

          <Section title="Documents" description={canRespond ? 'Upload the requested files. They are attached to this request and visible to the audit team.' : undefined}>
            <div className="space-y-3">
              {canRespond ? (
                <Can permission="document:upload">
                  <FileUpload
                    ownerType="DocumentRequest"
                    ownerId={req.id}
                    onUploaded={async (doc: Document) => {
                      await link.mutateAsync({ documentId: doc.id });
                    }}
                  />
                </Can>
              ) : null}
              <DocumentList documents={req.documents} ownerType="DocumentRequest" ownerId={req.id} emptyText="No documents have been provided yet." />
            </div>
          </Section>

          <Section title="Response note" description="Explain what is provided, or why something cannot be supplied. A note or at least one document is needed before submitting.">
            <div className="space-y-2">
              <Label htmlFor="rq-note" className="sr-only">Response note</Label>
              <Textarea id="rq-note" rows={5} value={note} disabled={!canRespond} onChange={(e) => { setNote(e.target.value); setNoteDirty(true); }} placeholder={canRespond ? 'Write your response…' : 'No response provided.'} />
              {canRespond ? (
                <div className="flex items-center justify-end gap-2">
                  {noteDirty ? <Button variant="ghost" size="sm" onClick={() => { setNote(req.responseNote ?? ''); setNoteDirty(false); }}>Discard</Button> : null}
                  <Button size="sm" loading={update.isPending} disabled={!noteDirty} onClick={saveNote}>Save note</Button>
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="Discussion"><CommentsThread targetType="DocumentRequest" targetId={req.id} allowInternalToggle={can('request:manage')} /></Section>
        </div>

        <div className="space-y-4">
          <Section title="Status">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Current</span><RequestStatusBadge status={req.status} /></div>
              <WorkflowActions machine={REQUEST_WORKFLOW} state={req.status} serverActions={req.availableActions} onTransition={(action, comment) => transition.mutateAsync({ action, comment })} isPending={transition.isPending} size="sm" className="flex-wrap" requireComment={['return', 'cancel']} />
              <dl className="space-y-3 border-t border-border pt-3">
                <DescriptionItem label="Requested by">{req.requestedBy ? <span className="flex items-center gap-1.5"><UserAvatar name={req.requestedBy.displayName} src={req.requestedBy.avatarUrl} size="xs" />{req.requestedBy.displayName}</span> : '—'}</DescriptionItem>
                <div className="min-w-0">
                  <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Assignee</dt>
                  <dd className="mt-0.5">
                    {canManage ? (
                      <UserPicker value={req.assigneeId} initial={req.assignee} onChange={(uid) => void update.mutateAsync({ assigneeId: uid, silent: true })} placeholder="Assign…" />
                    ) : req.assignee ? (
                      <span className="flex items-center gap-1.5 text-sm"><UserAvatar name={req.assignee.displayName} src={req.assignee.avatarUrl} size="xs" />{req.assignee.displayName}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{req.assigneeEmail ?? 'Unassigned'}</span>
                    )}
                  </dd>
                </div>
                <EditableField label="Assignee email" value={req.assigneeEmail} onSave={save('assigneeEmail')} canEdit={canManage} type="email" placeholder="External contact" />
                <EditableField label="Due date" value={toInputDate(req.dueDate)} type="date" onSave={save('dueDate')} canEdit={canManage} render={(v) => <span className={cn('inline-flex items-center gap-1', late && 'font-medium text-destructive')}><CalendarClock className="size-3.5" />{fmtDate(String(v || ''))}</span>} />
                <DescriptionItem label="Raised">{fmtDateTime(req.createdAt)}</DescriptionItem>
                {req.submittedAt ? <DescriptionItem label="Submitted">{fmtDateTime(req.submittedAt)}</DescriptionItem> : null}
                {req.acceptedAt ? <DescriptionItem label="Accepted">{fmtDateTime(req.acceptedAt)}</DescriptionItem> : null}
              </dl>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
