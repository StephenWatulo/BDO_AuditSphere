'use client';

import * as React from 'react';
import Link from 'next/link';
import { Briefcase, ClipboardCheck, Inbox, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Can, hasPermission, primaryDashboard, useCurrentUser } from '@/lib/auth';
import { AuditorDashboard } from '@/components/dashboards/auditor-dashboard';
import { PartnerDashboard } from '@/components/dashboards/partner-dashboard';
import { CommitteeDashboard } from '@/components/dashboards/committee-dashboard';

type View = 'auditor' | 'partner' | 'committee';

export default function HomePage() {
  const { user: currentUser, isLoading: userLoading } = useCurrentUser();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const user = mounted ? currentUser : null;
  const isLoading = !mounted || userLoading;
  const [view, setView] = React.useState<View | null>(null);

  const available = React.useMemo(() => {
    const v: { key: View; label: string }[] = [];
    if (hasPermission(user, 'dashboard:auditor')) v.push({ key: 'auditor', label: 'My work' });
    if (hasPermission(user, 'dashboard:partner')) v.push({ key: 'partner', label: 'Portfolio' });
    if (hasPermission(user, 'dashboard:committee')) v.push({ key: 'committee', label: 'Audit committee' });
    return v;
  }, [user]);

  const active: View | null = view ?? primaryDashboard(user);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.firstName || user?.displayName?.split(' ')[0] || '';

  return (
    <>
      <PageHeader
        title={user ? `${greeting}, ${firstName}` : 'Home'}
        description={
          active === 'committee'
            ? 'Oversight view of risk profile, plan delivery and open actions.'
            : active === 'partner'
              ? 'Portfolio health across engagements, budgets and staff.'
              : 'Your assignments, reviews and deadlines at a glance.'
        }
        actions={mounted ? (
          <>
            <Can permission="engagement:create">
              <Button variant="outline" asChild>
                <Link href="/engagements/new">
                  <Briefcase /> New engagement
                </Link>
              </Button>
            </Can>
            <Can permission="finding:manage">
              <Button asChild>
                <Link href="/findings/new">
                  <Plus /> New finding
                </Link>
              </Button>
            </Can>
          </>
        ) : undefined}
      >
        {available.length > 1 && active ? (
          <Tabs value={active} onValueChange={(v) => setView(v as View)}>
            <TabsList variant="pills">
              {available.map((v) => (
                <TabsTrigger key={v.key} value={v.key}>
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </PageHeader>

      {isLoading && !user ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : active === 'auditor' ? (
        <AuditorDashboard />
      ) : active === 'partner' ? (
        <PartnerDashboard />
      ) : active === 'committee' ? (
        <CommitteeDashboard />
      ) : (
        <div className="surface">
          <EmptyState
            icon={<Inbox />}
            title="Welcome to AuditSphere"
            description="Your role does not include a dashboard. Use the navigation to open your requests and findings."
            action={
              <div className="flex gap-2">
                <Can permission="request:read">
                  <Button variant="outline" asChild>
                    <Link href="/requests?view=mine">
                      <Inbox /> My requests
                    </Link>
                  </Button>
                </Can>
                <Can permission="finding:read">
                  <Button asChild>
                    <Link href="/findings?mine=true">
                      <ClipboardCheck /> My actions
                    </Link>
                  </Button>
                </Can>
              </div>
            }
          />
        </div>
      )}
    </>
  );
}
