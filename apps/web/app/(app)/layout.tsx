'use client';

import * as React from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <React.Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        }
      >
        {children}
      </React.Suspense>
    </AppShell>
  );
}
