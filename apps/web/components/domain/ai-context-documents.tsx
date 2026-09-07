'use client';

import * as React from 'react';
import { Download, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCan } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { useAiContextDocuments, useDeleteAiContext, useUploadAiContext } from '@/lib/queries/ai';
import { downloadDocument } from '@/lib/queries/documents';
import { fileSize } from '@/lib/utils';
import { fmtNumber } from '@/lib/format';

export function AiContextDocuments({ selected, onSelectionChange, onBusyChange, disabled }: {
  selected: string[];
  onSelectionChange: React.Dispatch<React.SetStateAction<string[]>>;
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
}) {
  const can = useCan();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const query = useAiContextDocuments(mounted && can('document:read'));
  const upload = useUploadAiContext();
  const remove = useDeleteAiContext();
  const input = React.useRef<HTMLInputElement>(null);
  const busy = React.useRef(false);
  const [progress, setProgress] = React.useState<string | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    if (disabled || busy.current || !can('document:upload')) return;
    const list = Array.from(files);
    if (!list.length) return;
    if (selected.length + list.length > 5) { toast.error('Select up to five context documents.'); return; }
    busy.current = true;
    onBusyChange(true);
    try {
      for (const [index, file] of list.entries()) {
        setProgress(`Processing ${index + 1} of ${list.length}`);
        try {
          if (!/\.(pdf|docx|xlsx|txt|csv|md)$/i.test(file.name)) throw new Error('Supported formats: PDF, DOCX, XLSX, TXT, CSV and MD.');
          if (!file.size) throw new Error('File is empty.');
          if (file.size > 10 * 1024 * 1024) throw new Error('Context documents must be 10 MB or smaller.');
          const doc = await upload.mutateAsync(file);
          onSelectionChange((ids) => [...ids, doc.id]);
          toast.success(`${doc.fileName} is ready for context`);
        } catch (error) { toast.error(`${file.name}: ${errorMessage(error)}`); }
      }
    } finally {
      busy.current = false;
      setProgress(null);
      onBusyChange(false);
      if (input.current) input.current.value = '';
    }
  };

  if (!mounted || !can('document:read')) return null;
  const locked = disabled || !!progress || remove.isPending;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">Context documents</span>
        <span className="shrink-0 text-xs text-muted-foreground">{selected.length}/5 selected</span>
      </div>
      {can('document:upload') ? <div className="rounded-md border border-dashed border-input p-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}>
        <Button type="button" variant="outline" size="sm" className="w-full" loading={!!progress} disabled={locked || selected.length >= 5} onClick={() => input.current?.click()}><Paperclip />{progress ?? 'Upload documents'}</Button>
        <input ref={input} type="file" multiple accept=".pdf,.docx,.xlsx,.txt,.csv,.md" aria-label="Upload context documents" className="sr-only" disabled={locked} onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} />
        <p className="mt-2 text-xs text-muted-foreground">PDF, DOCX, XLSX, TXT, CSV, MD | 10 MB per file</p>
      </div> : null}
      {query.isLoading ? <p className="text-xs text-muted-foreground">Loading documents...</p> : query.error ? <div role="alert" className="text-xs text-destructive">{errorMessage(query.error)} <Button type="button" variant="ghost" size="sm" onClick={() => void query.refetch()}>Retry</Button></div> : null}
      {query.data?.items.length === 0 ? <p className="text-xs text-muted-foreground">No context documents uploaded.</p> : null}
      <ul className="max-h-80 divide-y divide-border overflow-y-auto">
        {query.data?.items.map((doc) => <li key={doc.id} className="flex items-start gap-2 py-2">
          <input type="checkbox" aria-label={`Use ${doc.fileName} as context`} className="mt-1 size-4 shrink-0 accent-primary" checked={selected.includes(doc.id)} disabled={locked || (!selected.includes(doc.id) && selected.length >= 5)} onChange={(event) => { const checked = event.target.checked; onSelectionChange((ids) => checked ? [...ids, doc.id] : ids.filter((id) => id !== doc.id)); }} />
          <details className="min-w-0 flex-1">
            <summary className="cursor-pointer break-words text-sm font-medium">{doc.fileName}</summary>
            <p className="mt-1 text-xs text-muted-foreground">{fileSize(doc.sizeBytes)} | {fmtNumber(doc.characters)} characters{doc.truncated ? ' | Excerpt only' : ''}</p>
            <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-xs">{doc.preview}</p>
          </details>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Download ${doc.fileName}`} title={`Download ${doc.fileName}`} onClick={() => void downloadDocument(doc.id).catch((error) => toast.error(errorMessage(error)))}><Download /></Button>
          {can('document:delete') ? <Button type="button" variant="ghost" size="icon-sm" disabled={locked} aria-label={`Delete ${doc.fileName}`} title={`Delete ${doc.fileName}`} onClick={() => { void remove.mutateAsync(doc.id).then(() => onSelectionChange((ids) => ids.filter((id) => id !== doc.id))).catch(() => {}); }}><Trash2 /></Button> : null}
        </li>)}
      </ul>
    </div>
  );
}
