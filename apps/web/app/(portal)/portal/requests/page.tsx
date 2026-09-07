'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { CardList, RequestCard } from '@/components/portal/portal-cards';
import { REQUEST_DONE_STATUSES, requestNeedsAction } from '@/components/portal/portal-links';
import { useRequests } from '@/lib/queries/requests';
import type { DocumentRequest } from '@/lib/types';

type Tab = 'action' | 'submitted' | 'done' | 'all';

const TABS: { key: Tab; label: string; match: (r: DocumentRequest) => boolean }[] = [
  { key: 'action', label: 'Needs action', match: (r) => requestNeedsAction(r.status) },
  { key: 'submitted', label: 'Submitted', match: (r) => r.status === 'SUBMITTED' },
  { key: 'done', label: 'Completed', match: (r) => REQUEST_DONE_STATUSES.includes(r.status) },
  { key: 'all', label: 'All', match: () => true },
];

export default function PortalRequestsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = TABS.some((t) => t.key === requested) && requested ? requested : 'action';
  const { data, isLoading, error, refetch } = useRequests({ mine: true, pageSize: 200 });
  const items = data?.items ?? [];
  const visible = items.filter(TABS.find((t) => t.key === tab)!.match);

  return (
    <>
      <PageHeader title="My requests" description="Documents and information the audit team has asked you to provide." />

      <Tabs value={tab} onValueChange={(v) => router.replace(v === 'action' ? '/portal/requests' : `/portal/requests?tab=${v}`)}>
        <TabsList aria-label="Filter requests">
          {TABS.map((t) => {
            const count = items.filter(t.match).length;
            return (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
                {!isLoading ? <span className="kbd ml-1.5">{count}</span> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={tab === 'action' ? 'Nothing needs your action' : 'No requests here'}
            description={tab === 'action' ? 'Requests that need documents from you will appear in this list.' : 'Try another filter.'}
          />
        ) : (
          <CardList>
            {visible.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </CardList>
        )}
      </div>
    </>
  );
}
