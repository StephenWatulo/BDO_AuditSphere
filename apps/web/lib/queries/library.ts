'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Framework, LibraryItem, ListParams, Paged } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const libraryKeys = {
  all: ['library'] as const,
  list: (params: Record<string, unknown>) => ['library', 'list', params] as const,
  detail: (id: string) => ['library', 'detail', id] as const,
  frameworks: ['library', 'frameworks'] as const,
};

export function useLibraryItems(params: ListParams & { type?: string; status?: string | string[] } = {}) {
  const p = compactParams(params);
  return useQuery({
    queryKey: libraryKeys.list(p),
    queryFn: () => api.get<Paged<LibraryItem>>('/library/items', p),
  });
}

export function useLibraryItem(id?: string | null) {
  return useQuery({
    queryKey: libraryKeys.detail(id ?? ''),
    queryFn: () => api.get<LibraryItem>(`/library/items/${id}`),
    enabled: !!id,
  });
}

export type LibraryItemInput = Partial<Pick<LibraryItem, 'type' | 'code' | 'title' | 'summary' | 'content' | 'industry' | 'tags'>>;

export function useCreateLibraryItem() {
  return useApiMutation<LibraryItem, LibraryItemInput>((input) => api.post('/library/items', input), {
    invalidate: [libraryKeys.all],
    success: 'Library item created',
  });
}

export function useUpdateLibraryItem(id: string) {
  return useApiMutation<LibraryItem, LibraryItemInput>((input) => api.patch(`/library/items/${id}`, input), {
    invalidate: [libraryKeys.all],
    success: 'Library item updated',
  });
}

export function useLibraryAction() {
  return useApiMutation<LibraryItem, { id: string; action: 'submit' | 'approve' | 'retire' }>(
    ({ id, action }) => api.post(`/library/items/${id}/${action}`),
    {
      invalidate: [libraryKeys.all],
      success: (_d, v) => ({ submit: 'Submitted for approval', approve: 'Item published', retire: 'Item retired' })[v.action],
    },
  );
}

export function useFrameworks() {
  return useQuery({
    queryKey: libraryKeys.frameworks,
    queryFn: async () => {
      const res = await api.get<Paged<Framework> | Framework[]>('/library/frameworks');
      return Array.isArray(res) ? res : res.items;
    },
    staleTime: 30 * 60 * 1000,
  });
}
