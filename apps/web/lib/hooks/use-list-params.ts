'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SortingState } from '@tanstack/react-table';

export type ListState = Record<string, string | string[] | number | boolean | undefined>;

/**
 * URL-synchronised list state (page, pageSize, q, sort, filters). Keeps table
 * filters shareable and survives refreshes without extra client stores.
 */
export function useListParams<T extends ListState>(defaults: T & { page?: number; pageSize?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = React.useMemo(() => {
    const out: Record<string, unknown> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const all = searchParams.getAll(key);
      if (all.length === 0) continue;
      const def = defaults[key];
      if (Array.isArray(def)) out[key] = all;
      else if (typeof def === 'number') out[key] = Number(all[0]) || def;
      else if (typeof def === 'boolean') out[key] = all[0] === 'true';
      else out[key] = all[0];
    }
    // Keys not in defaults but present in the URL (e.g. filter values that default to undefined)
    searchParams.forEach((_, key) => {
      if (!(key in out)) {
        const all = searchParams.getAll(key);
        out[key] = all.length > 1 ? all : all[0];
      }
    });
    return out as T & { page: number; pageSize: number };
  }, [searchParams, defaults]);

  const set = React.useCallback(
    (patch: Partial<T> & { page?: number; pageSize?: number }) => {
      const sp = new URLSearchParams(searchParams.toString());
      const resetPage = Object.keys(patch).some((k) => k !== 'page' && k !== 'pageSize');
      for (const [k, v] of Object.entries(patch)) {
        sp.delete(k);
        if (v === undefined || v === null || v === '' || v === false) continue;
        if (Array.isArray(v)) v.forEach((item) => sp.append(k, String(item)));
        else sp.set(k, String(v));
      }
      if (resetPage && !('page' in patch)) sp.delete('page');
      // Drop values equal to defaults to keep URLs short
      for (const [k, def] of Object.entries(defaults)) {
        if (!Array.isArray(def) && def !== undefined && sp.get(k) === String(def)) sp.delete(k);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, defaults],
  );

  const reset = React.useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  const sorting: SortingState = React.useMemo(() => {
    const raw = typeof state.sort === 'string' ? state.sort : '';
    if (!raw) return [];
    const [id, dir] = raw.split(':');
    return id ? [{ id, desc: dir === 'desc' }] : [];
  }, [state.sort]);

  const setSorting = React.useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      set({ sort: first ? `${first.id}:${first.desc ? 'desc' : 'asc'}` : undefined } as unknown as Partial<T>);
    },
    [set, sorting],
  );

  return { state, set, reset, sorting, setSorting };
}
