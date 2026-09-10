'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WithTooltip } from '@/components/ui/tooltip';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export function UserManualDownload({ collapsed }: { collapsed: boolean }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const download = async (format = 'pdf') => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await api.download('/help/user-manual', { format }, `BDO-AuditSphere-User-Manual.${format}`);
      toast.success('User manual downloaded');
    } catch (error) {
      toast.error(errorMessage(error, 'User manual could not be downloaded'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const control = (
    <button type="button" onClick={() => void download()} disabled={busy} aria-label="Download user manual (PDF)" aria-busy={busy}
      className={cn('group flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50', collapsed && 'justify-center px-0')}>
      {busy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <Download className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />}
      <span className={collapsed ? 'sr-only' : 'truncate'}>User manual</span>
    </button>
  );
  return (
    <div className="flex h-8 items-center" data-testid="user-manual-download">
      {collapsed ? <WithTooltip label="Download user manual (PDF)" side="right">{control}</WithTooltip> : control}
      {!collapsed ? <DropdownMenu>
        <WithTooltip label="User manual formats">
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={busy} aria-label="User manual formats" className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50"><ChevronDown className="size-3.5" aria-hidden /></button>
          </DropdownMenuTrigger>
        </WithTooltip>
        <DropdownMenuContent align="start" side="top">
          {[['pdf', 'PDF document'], ['docx', 'Word document'], ['md', 'Markdown']].map(([format, label]) => <DropdownMenuItem key={format} disabled={busy} onSelect={() => void download(format)}><FileText />{label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu> : null}
    </div>
  );
}
