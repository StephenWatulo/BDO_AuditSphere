'use client';

import * as React from 'react';
import { Download, FileText, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SimpleSelect } from '@/components/ui/select';
import { downloadDocument, useDeleteDocument, useUploadDocument } from '@/lib/queries/documents';
import { Can, useCan } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { cn, fileSize } from '@/lib/utils';
import type { Document } from '@/lib/types';

const CLASSIFICATIONS = [
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'CONFIDENTIAL', label: 'Confidential' },
  { value: 'RESTRICTED', label: 'Restricted' },
  { value: 'PUBLIC', label: 'Public' },
];

/** Drag-and-drop uploader that POSTs multipart to /documents/upload. */
export function FileUpload({
  ownerType,
  ownerId,
  onUploaded,
  className,
  compact,
  multiple = true,
  showClassification = true,
}: {
  ownerType: string;
  ownerId: string;
  onUploaded?: (doc: Document) => void | Promise<void>;
  className?: string;
  compact?: boolean;
  multiple?: boolean;
  showClassification?: boolean;
}) {
  const upload = useUploadDocument();
  const can = useCan();
  const busy = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [classification, setClassification] = React.useState('CONFIDENTIAL');
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    if (busy.current) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    if (!multiple && list.length > 1) { toast.error('Choose one file at a time.'); return; }
    busy.current = true;
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    for (const file of list) {
      try {
        if (file.size === 0) throw new Error('File is empty');
        if (file.size > 50 * 1024 * 1024) throw new Error('File exceeds the 50 MB limit');
        const doc = await upload.mutateAsync({ file, ownerType, ownerId, classification });
        await onUploaded?.(doc);
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e, 'upload failed')}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    busy.current = false;
    if (ok > 0) toast.success(`${ok} file${ok === 1 ? '' : 's'} uploaded`);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        aria-disabled={!!progress}
        onClick={() => !busy.current && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!busy.current) inputRef.current?.click(); }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center transition-colors focus-visible:ring-2',
          compact ? 'px-3 py-3' : 'px-4 py-6',
          dragging ? 'border-primary bg-accent' : 'border-input bg-muted/30 hover:bg-muted/60',
        )}
      >
        <UploadCloud className={cn('text-muted-foreground', compact ? 'size-4' : 'size-6')} />
        <p className="text-xs">
          <span className="font-medium text-primary">Choose files</span> or drag and drop
        </p>
        {progress ? (
          <p className="text-2xs text-muted-foreground">
            Uploading {progress.done}/{progress.total}…
          </p>
        ) : !compact ? (
          <p className="text-2xs text-muted-foreground">PDF, Office documents, images, extracts up to 50 MB</p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          disabled={!!progress}
          className="sr-only"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
          tabIndex={-1}
        />
      </div>
      {showClassification ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Classification</span>
          <SimpleSelect
            value={classification}
            onValueChange={setClassification}
            options={CLASSIFICATIONS.filter((c) => c.value !== 'RESTRICTED' || can('document:restricted'))}
            disabled={!!progress}
            className="h-7 w-36 text-xs"
            aria-label="Document classification"
          />
        </div>
      ) : null}
    </div>
  );
}

export function DocumentList({
  documents,
  ownerType,
  ownerId,
  className,
  emptyText = 'No documents attached.',
}: {
  documents?: Document[] | null;
  ownerType?: string;
  ownerId?: string;
  className?: string;
  emptyText?: string;
}) {
  const del = useDeleteDocument();
  if (!documents || documents.length === 0) {
    return <p className={cn('text-xs text-muted-foreground', className)}>{emptyText}</p>;
  }
  return (
    <ul className={cn('divide-y divide-border rounded-md border border-border', className)}>
      {documents.map((d) => (
        <li key={d.id} className="flex items-center gap-2.5 px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{d.fileName}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {fileSize(d.sizeBytes)} · {d.classification?.toLowerCase()} · {fmtDateTime(d.uploadedAt ?? d.createdAt)}
              {d.uploadedBy ? ` · ${d.uploadedBy.displayName}` : ''}
            </p>
          </div>
          <Can permission="document:read">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${d.fileName}`}
              title={`Download ${d.fileName}`}
              onClick={() => downloadDocument(d.id).catch((e) => toast.error(errorMessage(e)))}
            >
              <Download />
            </Button>
          </Can>
          <Can permission="document:delete">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${d.fileName}`}
              title={`Delete ${d.fileName}`}
              disabled={del.isPending}
              onClick={() => del.mutate({ id: d.id, ownerType, ownerId })}
            >
              <Trash2 />
            </Button>
          </Can>
        </li>
      ))}
    </ul>
  );
}

export function AttachmentIcon({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground">
      <Paperclip className="size-3" /> {count}
    </span>
  );
}
