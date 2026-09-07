'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Search, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SimpleSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Server-side paging. */
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Server-side sorting. */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Free-text search box (controlled). */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Active filter chips rendered in the toolbar. */
  chips?: FilterChip[];
  onClearFilters?: () => void;
  /** Extra toolbar controls (filters, toggles). */
  toolbar?: React.ReactNode;
  /** Actions on the right of the toolbar. */
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
  getRowId?: (row: TData, index: number) => string;
  className?: string;
  dense?: boolean;
  /** Hide the toolbar entirely. */
  hideToolbar?: boolean;
  /** Persist column visibility under this key. */
  storageKey?: string;
  /** Initial hidden columns. */
  initialHidden?: string[];
}

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  total,
  page = 1,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  sorting,
  onSortingChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  chips,
  onClearFilters,
  toolbar,
  actions,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  emptyIcon,
  onRowClick,
  rowClassName,
  getRowId,
  className,
  dense,
  hideToolbar,
  storageKey,
  initialHidden,
}: DataTableProps<TData>) {
  const [localSorting, setLocalSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    const base: VisibilityState = {};
    for (const id of initialHidden ?? []) base[id] = false;
    if (storageKey && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`as.table.${storageKey}`);
        if (raw) return { ...base, ...(JSON.parse(raw) as VisibilityState) };
      } catch {
        /* ignore */
      }
    }
    return base;
  });

  React.useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`as.table.${storageKey}`, JSON.stringify(columnVisibility));
    } catch {
      /* ignore */
    }
  }, [columnVisibility, storageKey]);

  const [searchDraft, setSearchDraft] = React.useState(search ?? '');
  React.useEffect(() => setSearchDraft(search ?? ''), [search]);
  const debounced = useDebounced(searchDraft, 350);
  React.useEffect(() => {
    if (onSearchChange && debounced !== (search ?? '')) onSearchChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const serverSort = !!onSortingChange;
  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting: serverSort ? (sorting ?? []) : localSorting, columnVisibility },
    onSortingChange: serverSort ? onSortingChange : setLocalSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: serverSort ? undefined : getSortedRowModel(),
    manualSorting: serverSort,
    manualPagination: true,
    getRowId,
  });

  const pageCount = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = total ? Math.min(page * pageSize, total) : 0;
  const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length;
  const hasChips = !!chips && chips.length > 0;

  return (
    <div className={cn('surface flex flex-col overflow-hidden', className)}>
      {!hideToolbar ? (
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {onSearchChange ? (
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-7 pl-7 pr-7 text-xs"
                  aria-label="Search"
                />
                {searchDraft ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                    onClick={() => setSearchDraft('')}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {toolbar}
            <div className="ml-auto flex items-center gap-1.5">
              {actions}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Choose columns">
                    <Columns3 />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onCheckedChange={(v) => col.toggleVisibility(!!v)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {hasChips ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips!.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
                >
                  {chip.label}
                  <button
                    type="button"
                    aria-label={`Remove filter ${chip.label}`}
                    className="rounded-full p-0.5 hover:bg-background"
                    onClick={chip.onRemove}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {onClearFilters ? (
                <Button variant="link" size="sm" className="h-6 px-1 text-xs" onClick={onClearFilters}>
                  Clear all
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative w-full overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as { align?: 'right' | 'center'; width?: string } | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: meta?.width }}
                      className={cn(meta?.align === 'right' && 'text-right', meta?.align === 'center' && 'text-center')}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className={cn(
                            'inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-2',
                            sorted && 'text-foreground',
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                <TableRow key={`s-${i}`} className="hover:bg-transparent">
                  {Array.from({ length: visibleColumnCount }).map((__, j) => (
                    <TableCell key={j} className={dense ? 'py-1.5' : undefined}>
                      <Skeleton className="h-3.5 w-[70%]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="p-0">
                  <ErrorState error={error} onRetry={onRetry} compact />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="p-0">
                  <EmptyState
                    compact
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row: Row<TData>) => (
                <TableRow
                  key={row.id}
                  className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row.original))}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row.original);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { align?: 'right' | 'center'; nowrap?: boolean } | undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          dense && 'py-1.5',
                          meta?.align === 'right' && 'text-right tabular-nums',
                          meta?.align === 'center' && 'text-center',
                          meta?.nowrap && 'whitespace-nowrap',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && total !== undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <div>
            {total > 0 ? (
              <>
                Showing <span className="font-medium text-foreground">{from}–{to}</span> of{' '}
                <span className="font-medium text-foreground">{total}</span>
              </>
            ) : (
              'No results'
            )}
          </div>
          <div className="flex items-center gap-2">
            {onPageSizeChange ? (
              <SimpleSelect
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
                options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: `${n} / page` }))}
                className="h-7 w-28 text-xs"
                aria-label="Rows per page"
              />
            ) : null}
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page + 1)}
              disabled={pageCount !== undefined && page >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Helper to translate table sorting state into the API `sort` param. */
export function sortParam(sorting?: SortingState): string | undefined {
  if (!sorting || sorting.length === 0) return undefined;
  const s = sorting[0];
  return `${s.id}:${s.desc ? 'desc' : 'asc'}`;
}
