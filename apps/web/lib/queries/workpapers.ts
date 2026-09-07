'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Paged, ReviewNote, Workpaper, WorkpaperSnapshot, WorkpaperTemplate } from '@/lib/types';
import { useApiMutation } from './helpers';
import { engagementKeys } from './engagements';

export const workpaperKeys = {
  all: ['workpapers'] as const,
  detail: (id: string) => ['workpapers', 'detail', id] as const,
  version: (id: string, n: number) => ['workpapers', id, 'version', n] as const,
  templates: ['workpaper-templates'] as const,
};

export function useWorkpaper(id?: string) {
  return useQuery({
    queryKey: workpaperKeys.detail(id ?? ''),
    queryFn: () => api.get<Workpaper>(`/workpapers/${id}`),
    enabled: !!id,
  });
}

export function useWorkpaperVersion(id: string, n?: number) {
  return useQuery({
    queryKey: workpaperKeys.version(id, n ?? 0),
    queryFn: () => api.get<WorkpaperSnapshot>(`/workpapers/${id}/versions/${n}`),
    enabled: !!id && !!n,
  });
}

export type WorkpaperPatch = Partial<
  Pick<
    Workpaper,
    'reference' | 'title' | 'objective' | 'riskId' | 'controlId' | 'procedure' | 'testPerformed' | 'results' | 'exceptions' | 'conclusion' | 'content'
  >
>;

export function useUpdateWorkpaper(id: string, engagementId?: string) {
  return useApiMutation<Workpaper, WorkpaperPatch>((input) => api.patch(`/workpapers/${id}`, input), {
    invalidate: [workpaperKeys.detail(id), ...(engagementId ? [engagementKeys.workpapers(engagementId)] : [])],
  });
}

export function useWorkpaperTransition(id: string, engagementId?: string) {
  return useApiMutation<Workpaper, { action: string; comment?: string }>(
    (input) => api.post(`/workpapers/${id}/transition`, input),
    {
      invalidate: [
        workpaperKeys.detail(id),
        ...(engagementId ? [engagementKeys.workpapers(engagementId), engagementKeys.detail(engagementId)] : []),
      ],
      success: 'Workpaper status updated',
    },
  );
}

export function useRaiseReviewNote(workpaperId: string) {
  return useApiMutation<ReviewNote, { text: string; priority?: string; assignedToId?: string }>(
    (input) => api.post(`/workpapers/${workpaperId}/review-notes`, input),
    { invalidate: [workpaperKeys.detail(workpaperId)], success: 'Review note raised' },
  );
}

export function useUpdateReviewNote(workpaperId: string) {
  return useApiMutation<ReviewNote, { noteId: string; response?: string; clear?: boolean }>(
    ({ noteId, ...input }) => api.patch(`/review-notes/${noteId}`, input),
    { invalidate: [workpaperKeys.detail(workpaperId)], success: (_d, v) => (v.clear ? 'Review note cleared' : 'Response saved') },
  );
}

export function useWorkpaperTemplates() {
  return useQuery({
    queryKey: workpaperKeys.templates,
    queryFn: async () => {
      const res = await api.get<Paged<WorkpaperTemplate> | WorkpaperTemplate[]>('/workpaper-templates');
      return Array.isArray(res) ? res : res.items;
    },
    staleTime: 10 * 60 * 1000,
  });
}
