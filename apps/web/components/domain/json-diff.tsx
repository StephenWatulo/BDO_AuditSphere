import * as React from 'react';
import { cn } from '@/lib/utils';

type Json = Record<string, unknown> | null | undefined;

function flatten(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix || '(value)'] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function show(v: unknown): string {
  if (v === undefined) return '';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Side-by-side before/after diff of two JSON objects; only changed keys are shown by default. */
export function JsonDiff({
  before,
  after,
  showUnchanged = false,
  className,
}: {
  before?: Json;
  after?: Json;
  showUnchanged?: boolean;
  className?: string;
}) {
  const rows = React.useMemo(() => {
    const b = flatten(before);
    const a = flatten(after);
    const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
    return keys
      .map((key) => {
        const bv = show(b[key]);
        const av = show(a[key]);
        const changed = bv !== av;
        const kind: 'added' | 'removed' | 'changed' | 'same' =
          !(key in b) && key in a ? 'added' : key in b && !(key in a) ? 'removed' : changed ? 'changed' : 'same';
        return { key, bv, av, kind };
      })
      .filter((r) => showUnchanged || r.kind !== 'same');
  }, [before, after, showUnchanged]);

  if (rows.length === 0) {
    return <p className={cn('text-xs text-muted-foreground', className)}>No field-level changes recorded.</p>;
  }

  return (
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <table className="w-full text-xs">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">Field</th>
            <th className="px-2 py-1.5 text-left font-semibold">Before</th>
            <th className="px-2 py-1.5 text-left font-semibold">After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border align-top">
              <td className="px-2 py-1.5 font-mono text-2xs text-muted-foreground">{r.key}</td>
              <td
                className={cn(
                  'max-w-xs whitespace-pre-wrap break-words px-2 py-1.5 font-mono text-2xs',
                  r.kind !== 'same' && r.kind !== 'added' && 'bg-destructive/10 text-destructive line-through decoration-destructive/50',
                )}
              >
                {r.bv || <span className="italic opacity-50">empty</span>}
              </td>
              <td
                className={cn(
                  'max-w-xs whitespace-pre-wrap break-words px-2 py-1.5 font-mono text-2xs',
                  r.kind !== 'same' && r.kind !== 'removed' && 'bg-success/10 text-success',
                )}
              >
                {r.av || <span className="italic opacity-50">empty</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={cn('max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-2xs', className)}>
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}
