'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useEntitiesFlat } from '@/lib/queries/universe';
import { ENTITY_TYPE_LABELS } from '@/lib/labels';
import type { EntityNode } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Searchable audit-universe entity selector backed by GET /universe/entities?flat=true. */
export function EntityPicker({
  value,
  onChange,
  placeholder = 'Select entity…',
  disabled,
  className,
  allowClear = true,
  id,
  initialName,
}: {
  value?: string | null;
  onChange: (id: string | null, entity?: EntityNode) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  id?: string;
  initialName?: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const listId = React.useId();
  const { data, isLoading } = useEntitiesFlat({ q, pageSize: 30 }, open);
  const items = data?.items ?? [];
  const selected = items.find((e) => e.id === value);
  const label = selected?.name ?? (value ? initialName ?? 'Selected entity' : null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !label && 'text-muted-foreground')}>{label ?? placeholder}</span>
          <span className="flex items-center gap-1">
            {allowClear && value ? (
              <span
                role="button"
                aria-label="Clear"
                tabIndex={-1}
                className="rounded p-0.5 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              >
                <X className="size-3" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search entities…" value={q} onValueChange={setQ} />
          <CommandList id={listId}>
            <CommandEmpty>{isLoading ? 'Searching…' : 'No entities found.'}</CommandEmpty>
            <CommandGroup>
              {items.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.id}
                  onSelect={() => {
                    onChange(e.id, e);
                    setOpen(false);
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      <span className="font-mono text-2xs text-muted-foreground">{e.code}</span> {e.name}
                    </span>
                    <span className="truncate text-2xs text-muted-foreground">
                      {ENTITY_TYPE_LABELS[e.type] ?? e.type}
                      {e.country ? ` · ${e.country}` : ''}
                    </span>
                  </span>
                  {e.id === value ? <Check className="ml-auto size-4 text-primary" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
