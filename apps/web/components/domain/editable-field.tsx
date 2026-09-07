'use client';

import * as React from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface EditableFieldProps {
  label: React.ReactNode;
  value?: string | number | null;
  onSave: (value: string) => Promise<unknown>;
  canEdit: boolean;
  multiline?: boolean;
  rows?: number;
  type?: string;
  options?: { value: string; label: string }[];
  /** Custom read-only rendering of the current value. */
  render?: (value: string | number | null | undefined) => React.ReactNode;
  placeholder?: string;
  hint?: React.ReactNode;
  className?: string;
  /** Larger typography for headline fields (e.g. the 5-C sections). */
  prominent?: boolean;
}

/**
 * Click-to-edit field used on detail pages. Saves on Enter / tick for inputs
 * and on tick for textareas; Escape cancels. The label is rendered as a
 * definition-list term so it can be dropped into a `<dl>`.
 */
export function EditableField({
  label,
  value,
  onSave,
  canEdit,
  multiline,
  rows = 4,
  type = 'text',
  options,
  render,
  placeholder,
  hint,
  className,
  prominent,
}: EditableFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(value ?? ''));
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setDraft(String(value ?? '')), [value]);

  const cancel = () => {
    setDraft(String(value ?? ''));
    setEditing(false);
  };
  const commit = async () => {
    if (draft === String(value ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('group min-w-0', className)}>
      <dt className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {canEdit && !editing ? (
          <button
            type="button"
            className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
            aria-label={`Edit ${typeof label === 'string' ? label : 'field'}`}
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3" />
          </button>
        ) : null}
      </dt>
      <dd className={cn('mt-0.5', prominent ? 'text-sm leading-relaxed' : 'text-sm')}>
        {editing ? (
          <div className="flex items-start gap-1">
            {options ? (
              <SimpleSelect value={draft} onValueChange={(v) => setDraft(v)} options={options} className="h-8" allowClear clearLabel="None" />
            ) : multiline ? (
              <Textarea
                autoFocus
                rows={rows}
                value={draft}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancel();
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void commit();
                }}
              />
            ) : (
              <Input
                autoFocus
                type={type}
                value={draft}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commit();
                  if (e.key === 'Escape') cancel();
                }}
              />
            )}
            <Button size="icon-sm" variant="ghost" aria-label="Save" onClick={commit} loading={saving}>
              <Check />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={cancel} disabled={saving}>
              <X />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              'w-full whitespace-pre-wrap text-left',
              canEdit && 'rounded px-1 -mx-1 hover:bg-muted/60',
              !value && value !== 0 && 'text-muted-foreground',
            )}
            disabled={!canEdit}
            onClick={() => canEdit && setEditing(true)}
          >
            {render ? render(value) : value || value === 0 ? String(value) : canEdit ? placeholder ?? 'Click to add' : '—'}
          </button>
        )}
        {hint && editing ? <p className="mt-1 text-2xs text-muted-foreground">{hint}</p> : null}
      </dd>
    </div>
  );
}
