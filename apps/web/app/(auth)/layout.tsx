import * as React from 'react';
import { BdoLogo } from '@/components/brand/bdo-logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#333F48] p-10 text-white lg:flex">
        <div className="relative flex items-center gap-2">
          <BdoLogo white className="w-20" />
          <span className="text-base font-semibold tracking-tight">AuditSphere</span>
        </div>
        <div className="relative max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">Internal audit, run as one connected operating platform.</h2>
          <p className="text-sm text-white/70">
            Risk-based planning, engagement lifecycle, workpapers with review trails, findings follow-up and committee
            reporting - all with a complete audit trail.
          </p>
        </div>
        <p className="relative text-xs text-white/50">BDO East Africa · Internal Audit</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <BdoLogo className="w-16 dark:hidden" />
            <BdoLogo white className="hidden w-16 dark:inline-block" />
            <span className="text-sm font-semibold">AuditSphere</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
