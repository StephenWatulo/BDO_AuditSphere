'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { CardList, FindingCard } from '@/components/portal/portal-cards';
import {
  FINDING_CLOSED_STATUSES,
  FINDING_PROGRESS_STATUSES,
  FINDING_RESPONSE_STATUSES,
  FINDING_VALIDATION_STATUSES,
} from '@/components/portal/portal-links';
import { useFindings } from '@/lib/queries/findings';
import type { FindingSummary } from '@/lib/types';

type Tab = 'response' | 'progress' | 'validation' | 'closed' | 'all';

const TABS: { key: Tab; label: string; match: (f: FindingSummary) => boolean }[] = [
  { key: 'response', label: 'Awaiting response', match: (f) => FINDING_RESPONSE_STATUSES.includes(f.status) },
  { key: 'progress', label: 'In progress', match: (f) => FINDING_PROGRESS_STATUSES.includes(f.status) },
  { key: 'validation', label: 'Under validation', match: (f) => FINDING_VALIDATION_STATUSES.includes(f.status) },
  { key: 'closed', label: 'Closed', match: (f) => FINDING_CLOSED_STATUSES.includes(f.status) },
  { key: 'all', label: 'All', match: () => true },
];

export default function PortalActionsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = TABS.some((t) => t.key === requested) && requested ? requested : 'response';
  const { data, isLoading, error, refetch } = useFindings({ mine: true, pageSize: 200 });
  const items = data?.items ?? [];
  const visible = items.filter(TABS.find((t) => t.key === tab)!.match);

  return (
    <>
      <PageHeader title="My actions" description="Findings where you provide the management response or own the agreed action." />

      <Tabs value={tab} onValueChange={(v) => router.replace(v === 'response' ? '/portal/actions' : `/portal/actions?tab=${v}`)}>
        <TabsList aria-label="Filter findings">
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
            icon={<ClipboardCheck />}
            title={tab === 'response' ? 'No findings are waiting for your response' : 'No findings here'}
            description={tab === 'response' ? 'Findings submitted to you for a management response will appear in this list.' : 'Try another filter.'}
          />
        ) : (
          <CardList>
            {visible.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </CardList>
        )}
      </div>
    </>
  );
}
