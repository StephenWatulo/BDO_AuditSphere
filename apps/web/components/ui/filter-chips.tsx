'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ChipOption {
  value: string;
  label: React.ReactNode;
}

/** A filter chip that opens a popover with selectable options (single or multi). */
export function ChipSelect({
  label,
  options,
  value,
  onChange,
  multiple,
  className,
}: {
  label: string;
  options: ChipOption[];
  value: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
  multiple?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const active = selected.length > 0;
  const summary = active
    ? selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selected`
    : null;

  const toggle = (v: string) => {
    if (multiple) {
      const next = selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v];
      onChange(next.length ? next : undefined);
    } else {
      onChange(selected[0] === v ? undefined : v);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2',
            active
              ? 'border-primary/40 bg-accent text-accent-foreground'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span>{label}</span>
          {summary ? (
            <>
              <span className="opacity-50">·</span>
              <span className="max-w-32 truncate">{summary}</span>
            </>
          ) : null}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <ul role="listbox" aria-multiselectable={multiple} className="max-h-72 overflow-y-auto">
          {options.map((o) => {
            const isSel = selected.includes(o.value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => toggle(o.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                    isSel && 'text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-3.5 items-center justify-center rounded-sm border',
                      isSel ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {isSel ? <Check className="size-2.5" /> : null}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {active ? (
          <button
            type="button"
            className="mt-1 w-full rounded-sm border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            Clear
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Boolean toggle chip (e.g. "Mine", "Overdue"). */
export function ToggleChip({
  label,
  checked,
  onChange,
  icon,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 [&_svg]:size-3',
        checked
          ? 'border-primary/40 bg-accent text-accent-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Segmented control for quick stage/status filtering. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex h-7 items-center gap-0.5 rounded-md bg-muted p-0.5', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-6 rounded-sm px-2.5 text-xs font-medium transition-colors',
            value === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
