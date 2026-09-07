'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { FINDING_WORKFLOW } from '@auditsphere/shared';
import { PageHeader, Section, DescriptionItem } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/avatar';
import { WorkflowActions } from '@/components/domain/guard-dialog';
import { FindingStatusBadge, SeverityBadge } from '@/components/domain/badges';
import { CommentsThread } from '@/components/domain/comments-thread';
import { EditableField } from '@/components/domain/editable-field';
import { FileUpload, DocumentList } from '@/components/domain/file-upload';
import { FINDING_CLOSED_STATUSES, FINDING_PROGRESS_STATUSES, findingNextStep } from '@/components/portal/portal-links';
import { Can, useCan } from '@/lib/auth';
import { useFinding, useFindingTransition, useUpdateFinding, type FindingInput } from '@/lib/queries/findings';
import { useDocuments } from '@/lib/queries/documents';
import { FINDING_STATUS_LABELS, TASK_PRIORITY_LABELS, labelFor } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtDueIn, isOverdue, toInputDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Finding } from '@/lib/types';

/** Statuses in which the API lets a business owner edit the response fields. */
const RESPONSE_EDITABLE = ['MANAGEMENT_REVIEW', 'AGREED', 'IMPLEMENTATION'];

export default function PortalFindingPage() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const { data: finding, isLoading, error, refetch } = useFinding(id);
  const update = useUpdateFinding(id);
  const transition = useFindingTransition(id);
  const docs = useDocuments('Finding', id);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-2/3" />
        <SkeletonRows rows={6} />
      </div>
    );
  }
  if (error || !finding) return <ErrorState error={error} onRetry={() => refetch()} />;

  const closed = FINDING_CLOSED_STATUSES.includes(finding.status);
  const canRespond = (can('finding:respond') || can('finding:manage')) && RESPONSE_EDITABLE.includes(finding.status);
  const canUpload = !closed && (can('finding:respond') || can('finding:manage'));
  const overdue = !closed && isOverdue(finding.dueDate);
  const showEvidence = FINDING_PROGRESS_STATUSES.includes(finding.status) || finding.status === 'VALIDATION' || closed;
  const save = (field: keyof FindingInput) => (v: string) =>
    update.mutateAsync({ [field]: v === '' ? null : v, silent: true } as FindingInput & { silent?: boolean });

  const actions = (
    <WorkflowActions
      machine={FINDING_WORKFLOW}
      state={finding.status}
      serverActions={finding.availableActions}
      onTransition={(action, comment) => transition.mutateAsync({ action, comment })}
      isPending={transition.isPending}
    />
  );

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'My actions', href: '/portal/actions' }, { label: finding.reference }]}
        title={finding.title}
        meta={
          <>
            <Badge variant="outline" className="font-mono normal-case tracking-normal">
              {finding.reference}
            </Badge>
            <SeverityBadge severity={finding.severity} />
            <FindingStatusBadge status={finding.status} />
            {overdue ? (
              <Badge variant="danger">
                <AlertTriangle className="size-3" aria-hidden /> Overdue
              </Badge>
            ) : null}
          </>
        }
        description={
          <>
            {finding.engagement ? `${finding.engagement.auditNumber} · ${finding.engagement.title}` : 'Audit finding'}
            {finding.entity ? ` · ${finding.entity.name}` : ''}
            {finding.dueDate ? ` · Target ${fmtDate(finding.dueDate)}${!closed ? ` (${fmtDueIn(finding.dueDate)})` : ''}` : ''}
          </>
        }
        actions={actions}
      />

      <div
        className={cn(
          'mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
          closed ? 'border-success/40 bg-success/5' : finding.status === 'VALIDATION' ? 'border-border bg-muted/40' : 'border-primary/30 bg-primary/5',
        )}
        role="status"
      >
        {closed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />}
        <div>
          <p className="font-medium">{findingNextStep(finding.status)}</p>
          {finding.status === 'MANAGEMENT_REVIEW' ? (
            <p className="text-xs text-muted-foreground">Write the management response, confirm who owns the action and the target date, then choose Agree finding.</p>
          ) : finding.status === 'IMPLEMENTATION' ? (
            <p className="text-xs text-muted-foreground">Upload evidence of what was done below, then choose Request validation so the audit team can verify it.</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Section title="Your management response" description="Your position on the finding and the action you will take. Required, together with an action owner and target date, before the finding can be agreed.">
            <dl className="space-y-4">
              <EditableField
                label="Response"
                value={finding.managementResponse}
                onSave={save('managementResponse')}
                multiline
                rows={5}
                canEdit={canRespond}
                prominent
                placeholder="Management agrees / disagrees, and the planned action"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <EditableField label="Action owner" value={finding.actionOwner?.displayName ?? finding.actionOwnerName} onSave={save('actionOwnerName')} canEdit={canRespond && !finding.actionOwnerId} placeholder="Who will carry out the action" hint={finding.actionOwnerId ? 'Assigned to your account' : undefined} />
                <EditableField label="Owner email" value={finding.actionOwnerEmail ?? finding.actionOwner?.email} onSave={save('actionOwnerEmail')} canEdit={canRespond} type="email" placeholder="name@example.com" />
                <EditableField
                  label="Target date"
                  value={toInputDate(finding.dueDate)}
                  type="date"
                  onSave={save('dueDate')}
                  canEdit={canRespond}
                  render={(v) => (
                    <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-destructive')}>
                      <CalendarClock className="size-3.5" aria-hidden />
                      {v ? fmtDate(String(v)) : 'Not set'}
                    </span>
                  )}
                />
              </div>
            </dl>
          </Section>

          {showEvidence ? (
            <Section title="Implementation evidence" description="Documents that show the agreed action was carried out. Required before validation can be requested.">
              <div className="space-y-3">
                {canUpload && FINDING_PROGRESS_STATUSES.includes(finding.status) ? (
                  <Can permission="document:upload">
                    <FileUpload ownerType="Finding" ownerId={finding.id} showClassification={false} />
                  </Can>
                ) : null}
                {docs.isLoading ? (
                  <SkeletonRows rows={2} />
                ) : docs.error ? (
                  <ErrorState error={docs.error} compact onRetry={() => docs.refetch()} />
                ) : (
                  <DocumentList documents={docs.data} ownerType="Finding" ownerId={finding.id} emptyText="No evidence attached yet." />
                )}
              </div>
            </Section>
          ) : null}

          <FindingDetail finding={finding} />

          <Section title="Discussion" description="Questions for the audit team about this finding.">
            <CommentsThread targetType="Finding" targetId={finding.id} allowInternalToggle={false} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Next step">
            <div className="space-y-3">
              <p className={cn('text-sm', closed ? 'text-muted-foreground' : 'font-medium')}>{findingNextStep(finding.status)}</p>
              <div className="flex flex-wrap gap-2">{actions}</div>
            </div>
          </Section>
          <Section title="Details">
            <dl className="space-y-3">
              <DescriptionItem label="Status">{labelFor(FINDING_STATUS_LABELS, finding.status)}</DescriptionItem>
              <DescriptionItem label="Raised by">
                {finding.raisedBy ? (
                  <span className="flex items-center gap-1.5">
                    <UserAvatar name={finding.raisedBy.displayName} src={finding.raisedBy.avatarUrl} size="xs" />
                    {finding.raisedBy.displayName}
                  </span>
                ) : (
                  '—'
                )}
              </DescriptionItem>
              {finding.agreedAt ? <DescriptionItem label="Agreed">{fmtDate(finding.agreedAt)}</DescriptionItem> : null}
              {finding.originalDueDate && finding.extensionCount > 0 ? (
                <DescriptionItem label="Original target">
                  {fmtDate(finding.originalDueDate)} <span className="text-xs text-muted-foreground">(extended {finding.extensionCount}×)</span>
                </DescriptionItem>
              ) : null}
              {finding.validatedAt ? <DescriptionItem label="Validated">{fmtDate(finding.validatedAt)}</DescriptionItem> : null}
              {finding.closedAt ? <DescriptionItem label="Closed">{fmtDate(finding.closedAt)}</DescriptionItem> : null}
            </dl>
          </Section>
          {finding.statusHistory?.length ? (
            <Section title="History" bodyClassName="p-0">
              <ol className="divide-y divide-border text-sm">
                {finding.statusHistory.slice(0, 8).map((h) => (
                  <li key={h.id} className="px-4 py-2">
                    <p className="font-medium">{labelFor(FINDING_STATUS_LABELS, h.toStatus)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(h.changedAt)}
                      {h.changedBy ? ` · ${h.changedBy.displayName}` : ''}
                    </p>
                    {h.comment ? <p className="mt-0.5 text-xs">{h.comment}</p> : null}
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}

function FindingDetail({ finding }: { finding: Finding }) {
  const fields: { label: string; value?: string | null }[] = [
    { label: 'What was found', value: finding.condition },
    { label: 'What should be in place', value: finding.criteria },
    { label: 'Why it happened', value: finding.cause },
    { label: 'Impact', value: finding.impact },
    { label: 'Recommendation', value: finding.recommendation },
  ];
  return (
    <Section title="The finding" description="Prepared by the audit team. Read only.">
      <dl className="space-y-4">
        {fields
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label}>
              <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm">{f.value}</dd>
            </div>
          ))}
        {finding.recommendations?.length ? (
          <div>
            <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Agreed actions</dt>
            <dd className="mt-1">
              <ol className="space-y-2">
                {finding.recommendations.map((r) => (
                  <li key={r.id} className="rounded-md border border-border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {r.sequence}. {r.text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {labelFor(TASK_PRIORITY_LABELS, r.priority)} priority
                        {r.dueDate ? ` · due ${fmtDate(r.dueDate)}` : ''}
                      </span>
                    </div>
                    {r.actionPlan ? <p className="mt-1 text-xs text-muted-foreground">{r.actionPlan}</p> : null}
                  </li>
                ))}
              </ol>
            </dd>
          </div>
        ) : null}
      </dl>
    </Section>
  );
}
