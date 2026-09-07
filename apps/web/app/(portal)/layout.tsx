'use client';

import * as React from 'react';
import { PortalShell } from '@/components/portal/portal-shell';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell>
      <React.Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-7 w-64" />
            <SkeletonRows rows={4} />
          </div>
        }
      >
        {children}
      </React.Suspense>
    </PortalShell>
  );
}
