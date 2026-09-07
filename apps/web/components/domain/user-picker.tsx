'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UserAvatar } from '@/components/ui/avatar';
import { useUsers } from '@/lib/queries/users';
import type { UserRef } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Searchable user selector backed by GET /users. */
export function UserPicker({
  value,
  onChange,
  placeholder = 'Select user…',
  role,
  disabled,
  className,
  allowClear = true,
  id,
  initial,
}: {
  value?: string | null;
  onChange: (id: string | null, user?: UserRef) => void;
  placeholder?: string;
  role?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  id?: string;
  /** Known user object for the current value (avoids a lookup). */
  initial?: UserRef | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const listId = React.useId();
  const { data, isLoading } = useUsers({ q, role, status: 'ACTIVE', pageSize: 20 }, open);
  const items = data?.items ?? [];
  const selected = items.find((u) => u.id === value) ?? (initial && initial.id === value ? initial : undefined);

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
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <UserAvatar name={selected.displayName} src={selected.avatarUrl} size="xs" />
              <span className="truncate">{selected.displayName}</span>
            </span>
          ) : value ? (
            <span className="truncate text-muted-foreground">Selected user</span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
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
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search people…" value={q} onValueChange={setQ} />
          <CommandList id={listId}>
            <CommandEmpty>{isLoading ? 'Searching…' : 'No people found.'}</CommandEmpty>
            <CommandGroup>
              {items.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.id}
                  onSelect={() => {
                    onChange(u.id, u);
                    setOpen(false);
                  }}
                >
                  <UserAvatar name={u.displayName} src={u.avatarUrl} size="xs" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{u.displayName}</span>
                    <span className="truncate text-2xs text-muted-foreground">{u.jobTitle ?? u.email}</span>
                  </span>
                  {u.id === value ? <Check className="ml-auto size-4 text-primary" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
