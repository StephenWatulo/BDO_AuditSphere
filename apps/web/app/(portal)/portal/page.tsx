'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ClipboardCheck, Inbox, MessageSquareText } from 'lucide-react';
import { PageHeader, Section } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { CardList, FindingCard, RequestCard } from '@/components/portal/portal-cards';
import {
  FINDING_CLOSED_STATUSES,
  FINDING_PROGRESS_STATUSES,
  FINDING_RESPONSE_STATUSES,
  findingNeedsAction,
  requestNeedsAction,
} from '@/components/portal/portal-links';
import { useCurrentUser } from '@/lib/auth';
import { useRequests } from '@/lib/queries/requests';
import { useFindings } from '@/lib/queries/findings';
import { isOverdue } from '@/lib/format';

const PAGE = { mine: true, pageSize: 200 } as const;

export default function PortalOverviewPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const requests = useRequests(PAGE);
  const findings = useFindings(PAGE);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.firstName || user?.displayName?.split(' ')[0] || '';

  const reqItems = requests.data?.items ?? [];
  const finItems = findings.data?.items ?? [];

  const openRequests = reqItems.filter((r) => requestNeedsAction(r.status));
  const overdueRequests = openRequests.filter((r) => isOverdue(r.dueDate));
  const awaitingResponse = finItems.filter((f) => FINDING_RESPONSE_STATUSES.includes(f.status));
  const inProgress = finItems.filter((f) => FINDING_PROGRESS_STATUSES.includes(f.status));
  const overdueActions = inProgress.filter((f) => isOverdue(f.dueDate));
  const completed = reqItems.filter((r) => r.status === 'ACCEPTED').length + finItems.filter((f) => FINDING_CLOSED_STATUSES.includes(f.status)).length;

  const attention = [
    ...openRequests.map((r) => ({ kind: 'request' as const, due: r.dueDate, item: r })),
    ...finItems.filter((f) => findingNeedsAction(f.status)).map((f) => ({ kind: 'finding' as const, due: f.dueDate ?? '9999-12-31', item: f })),
  ].sort((a, b) => String(a.due).localeCompare(String(b.due)));

  const loading = requests.isLoading || findings.isLoading;
  const error = requests.error ?? findings.error;

  return (
    <>
      <PageHeader
        title={user ? `${greeting}, ${firstName}` : 'Overview'}
        description="Documents the audit team has asked you for, and findings that need your response or action."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Requests needing action"
          value={loading ? '…' : openRequests.length}
          hint={overdueRequests.length ? `${overdueRequests.length} overdue` : 'Documents to provide'}
          icon={<Inbox />}
          tone={overdueRequests.length ? 'danger' : openRequests.length ? 'warning' : 'default'}
          onClick={() => router.push('/portal/requests')}
        />
        <StatTile
          label="Awaiting your response"
          value={loading ? '…' : awaitingResponse.length}
          hint="Findings under management review"
          icon={<MessageSquareText />}
          tone={awaitingResponse.length ? 'warning' : 'default'}
          onClick={() => router.push('/portal/actions?tab=response')}
        />
        <StatTile
          label="Actions in progress"
          value={loading ? '…' : inProgress.length}
          hint={overdueActions.length ? `${overdueActions.length} past the agreed date` : 'Agreed actions being implemented'}
          icon={<ClipboardCheck />}
          tone={overdueActions.length ? 'danger' : 'default'}
          onClick={() => router.push('/portal/actions?tab=progress')}
        />
        <StatTile label="Completed" value={loading ? '…' : completed} hint="Accepted requests and closed findings" icon={<CheckCircle2 />} tone="success" />
      </div>

      <div className="mt-6 space-y-6">
        <Section title="Needs your attention" description="Sorted by due date. Overdue items appear first.">
          {loading ? (
            <SkeletonRows rows={3} />
          ) : error ? (
            <ErrorState error={error} compact onRetry={() => { void requests.refetch(); void findings.refetch(); }} />
          ) : attention.length === 0 ? (
            <EmptyState compact icon={<CheckCircle2 className="text-success" />} title="You are all caught up" description="Nothing is waiting on you right now. New requests and findings will appear here and in your notifications." />
          ) : (
            <CardList>
              {attention.map((a) =>
                a.kind === 'request' ? <RequestCard key={`r-${a.item.id}`} request={a.item} /> : <FindingCard key={`f-${a.item.id}`} finding={a.item} />,
              )}
            </CardList>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Section
            title="My requests"
            description="Documents and information requested from you."
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/portal/requests">
                  View all <ArrowRight />
                </Link>
              </Button>
            }
          >
            {requests.isLoading ? (
              <SkeletonRows rows={3} />
            ) : requests.error ? (
              <ErrorState error={requests.error} compact onRetry={() => requests.refetch()} />
            ) : reqItems.length === 0 ? (
              <EmptyState compact title="No requests yet" description="When the audit team asks you for documents they will be listed here." />
            ) : (
              <CardList>
                {reqItems.slice(0, 5).map((r) => (
                  <RequestCard key={r.id} request={r} />
                ))}
              </CardList>
            )}
          </Section>

          <Section
            title="My actions"
            description="Findings where you own the management response or the agreed action."
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/portal/actions">
                  View all <ArrowRight />
                </Link>
              </Button>
            }
          >
            {findings.isLoading ? (
              <SkeletonRows rows={3} />
            ) : findings.error ? (
              <ErrorState error={findings.error} compact onRetry={() => findings.refetch()} />
            ) : finItems.length === 0 ? (
              <EmptyState compact title="No findings assigned to you" description="Findings that name you as the action owner will appear here." />
            ) : (
              <CardList>
                {finItems.slice(0, 5).map((f) => (
                  <FindingCard key={f.id} finding={f} />
                ))}
              </CardList>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
