'use client';

import { useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api, errorMessage } from '@/lib/api';
import { Can } from '@/lib/auth';

export function ReportExport({ path, params, register = false, label = 'Download report' }: { path: string; params?: Record<string, unknown>; register?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false);
  const formats = register ? [{ id: 'pdf', label: 'PDF document' }, { id: 'xlsx', label: 'Excel workbook' }, { id: 'csv', label: 'CSV spreadsheet' }] : [{ id: 'pdf', label: 'PDF document' }, { id: 'docx', label: 'Word document' }, { id: 'md', label: 'Markdown' }];
  const download = async (format: string) => {
    setBusy(true);
    try {
      await api.download(`${path}/export`, { ...params, format }, `bdo-report.${format}`);
      toast.success('Report downloaded');
    } catch (error) { toast.error(errorMessage(error, 'Report could not be downloaded')); }
    finally { setBusy(false); }
  };
  return (
    <Can permission="report:export">
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="sm" variant="outline" loading={busy} disabled={busy}><Download /> {label} <ChevronDown /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {formats.map((format) => <DropdownMenuItem key={format.id} disabled={busy} onSelect={() => void download(format.id)}>{['xlsx', 'csv'].includes(format.id) ? <FileSpreadsheet /> : <FileText />}{format.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </Can>
  );
}
