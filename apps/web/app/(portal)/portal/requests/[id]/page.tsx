'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, CalendarClock, Check, Clock, RotateCcw } from 'lucide-react';
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
import { FileUpload, DocumentList } from '@/components/domain/file-upload';
import { requestNeedsAction, requestNextStep } from '@/components/portal/portal-links';
import { Can, useCan, useCurrentUser } from '@/lib/auth';
import { useLinkRequestDocument, useRequest, useRequestTransition, useUpdateRequest } from '@/lib/queries/requests';
import { fmtDate, fmtDateTime, fmtDueIn, isOverdue } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Document } from '@/lib/types';

export default function PortalRequestPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const { user } = useCurrentUser();
  const { data: req, isLoading, error, refetch } = useRequest(id);
  const update = useUpdateRequest(id);
  const transition = useRequestTransition(id);
  const link = useLinkRequestDocument(id);
  const [note, setNote] = React.useState('');
  const [noteDirty, setNoteDirty] = React.useState(false);
  React.useEffect(() => {
    if (!noteDirty) setNote(req?.responseNote ?? '');
  }, [req?.responseNote, noteDirty]);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-2/3" />
        <SkeletonRows rows={6} />
      </div>
    );
  }
  if (error || !req) return <ErrorState error={error} onRetry={() => refetch()} />;

  const active = requestNeedsAction(req.status);
  const isAssignee = !!user && (user.id === req.assigneeId || (!!req.assigneeEmail && req.assigneeEmail.toLowerCase() === user.email.toLowerCase()));
  const canRespond = active && (can('request:respond') || can('request:manage')) && (isAssignee || can('request:manage') || !req.assigneeId);
  const late = active && isOverdue(req.dueDate);
  const documents = req.documents ?? [];

  const saveNote = async () => {
    await update.mutateAsync({ responseNote: note.trim() || null });
    setNoteDirty(false);
  };

  const actions = (
    <WorkflowActions
      machine={REQUEST_WORKFLOW}
      state={req.status}
      serverActions={req.availableActions}
      onTransition={(action, comment) => transition.mutateAsync({ action, comment })}
      isPending={transition.isPending}
      disabled={!canRespond}
    />
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'My requests', href: '/portal/requests' }, { label: req.reference }]}
        title={req.title}
        meta={
          <>
            <Badge variant="outline" className="font-mono normal-case tracking-normal">
              {req.reference}
            </Badge>
            <RequestStatusBadge status={req.status} />
            {late ? (
              <Badge variant="danger">
                <AlertTriangle className="size-3" aria-hidden /> Overdue
              </Badge>
            ) : null}
          </>
        }
        description={
          <>
            {req.engagement ? `${req.engagement.auditNumber} · ${req.engagement.title}` : 'Audit request'} · Due {fmtDate(req.dueDate)}
            {active ? ` (${fmtDueIn(req.dueDate)})` : ''}
          </>
        }
        actions={actions}
      />

      {req.status === 'RETURNED' ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm" role="status">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">Returned by the audit team</p>
            <p className="text-xs text-muted-foreground">{req.returnReason || 'Please review the discussion, update your response and resubmit.'}</p>
          </div>
        </div>
      ) : req.status === 'SUBMITTED' ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" role="status">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p>
            Submitted {fmtDateTime(req.submittedAt)}. The audit team will accept it or return it with comments. You will be notified either way.
          </p>
        </div>
      ) : req.status === 'ACCEPTED' ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm" role="status">
          <Check className="size-4 shrink-0 text-success" aria-hidden />
          <p>Accepted {fmtDateTime(req.acceptedAt)}. Thank you, no further action is required.</p>
        </div>
      ) : active && !isAssignee && !can('request:manage') && req.assigneeId ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>This request is assigned to {req.assignee?.displayName ?? 'someone else'}. You can read it, but only the assignee can respond.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Section title="What the audit team needs">
            <p className="whitespace-pre-wrap text-sm">{req.description || 'No further description was provided. Use the discussion below if anything is unclear.'}</p>
          </Section>

          <Section
            title="Your documents"
            description={canRespond ? 'Upload the requested files. They are attached to this request and visible to the audit team only.' : undefined}
          >
            <div className="space-y-3">
              {canRespond ? (
                <Can permission="document:upload">
                  <FileUpload
                    ownerType="DocumentRequest"
                    ownerId={req.id}
                    showClassification={false}
                    onUploaded={async (doc: Document) => {
                      await link.mutateAsync({ documentId: doc.id });
                    }}
                  />
                </Can>
              ) : null}
              <DocumentList documents={documents} ownerType="DocumentRequest" ownerId={req.id} emptyText="No documents have been provided yet." />
            </div>
          </Section>

          <Section title="Your response" description="Explain what is attached, or why something cannot be supplied. A note or at least one document is needed before you submit.">
            <div className="space-y-2">
              <Label htmlFor="portal-rq-note" className="sr-only">
                Response note
              </Label>
              <Textarea
                id="portal-rq-note"
                rows={5}
                value={note}
                disabled={!canRespond}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteDirty(true);
                }}
                placeholder={canRespond ? 'Write your response…' : 'No response provided.'}
              />
              {canRespond ? (
                <div className="flex items-center justify-end gap-2">
                  {noteDirty ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNote(req.responseNote ?? '');
                        setNoteDirty(false);
                      }}
                    >
                      Discard
                    </Button>
                  ) : null}
                  <Button size="sm" loading={update.isPending} disabled={!noteDirty} onClick={saveNote}>
                    Save note
                  </Button>
                </div>
              ) : null}
            </div>
          </Section>

          <Section title="Discussion" description="Questions for the audit team about this request.">
            <CommentsThread targetType="DocumentRequest" targetId={req.id} allowInternalToggle={false} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Next step">
            <div className="space-y-3">
              <p className={cn('text-sm', active ? 'font-medium' : 'text-muted-foreground')}>{requestNextStep(req.status)}</p>
              {canRespond ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              {canRespond && noteDirty ? <p className="text-xs text-warning">Save your note before submitting.</p> : null}
            </div>
          </Section>
          <Section title="Details">
            <dl className="space-y-3">
              <DescriptionItem label="Status">
                <RequestStatusBadge status={req.status} />
              </DescriptionItem>
              <DescriptionItem label="Due date">
                <span className={cn('inline-flex items-center gap-1', late && 'font-medium text-destructive')}>
                  <CalendarClock className="size-3.5" aria-hidden />
                  {fmtDate(req.dueDate)}
                </span>
              </DescriptionItem>
              <DescriptionItem label="Requested by">
                {req.requestedBy ? (
                  <span className="flex items-center gap-1.5">
                    <UserAvatar name={req.requestedBy.displayName} src={req.requestedBy.avatarUrl} size="xs" />
                    {req.requestedBy.displayName}
                  </span>
                ) : (
                  '—'
                )}
              </DescriptionItem>
              <DescriptionItem label="Assigned to">{req.assignee?.displayName ?? req.assigneeEmail ?? 'Unassigned'}</DescriptionItem>
              <DescriptionItem label="Raised">{fmtDateTime(req.createdAt)}</DescriptionItem>
              {req.submittedAt ? <DescriptionItem label="Submitted">{fmtDateTime(req.submittedAt)}</DescriptionItem> : null}
              {req.acceptedAt ? <DescriptionItem label="Accepted">{fmtDateTime(req.acceptedAt)}</DescriptionItem> : null}
            </dl>
          </Section>
        </div>
      </div>
    </>
  );
}
