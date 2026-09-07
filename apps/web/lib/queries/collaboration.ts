'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditTrailEntry, Comment, ListParams, Notification, Paged, SearchResults, Task } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const collabKeys = {
  tasks: (params: Record<string, unknown>) => ['tasks', params] as const,
  comments: (targetType: string, targetId: string) => ['comments', targetType, targetId] as const,
  notifications: (unread: boolean) => ['notifications', unread ? 'unread' : 'all'] as const,
  auditTrail: (params: Record<string, unknown>) => ['audit-trail', params] as const,
  search: (q: string) => ['search', q] as const,
};

export function useTasks(params: ListParams & { mine?: boolean; status?: string | string[] } = {}) {
  const p = compactParams(params);
  return useQuery({
    queryKey: collabKeys.tasks(p),
    queryFn: () => api.get<Paged<Task>>('/tasks', p),
  });
}

export function useCreateTask() {
  return useApiMutation<Task, Partial<Task>>((input) => api.post('/tasks', input), {
    invalidate: [['tasks']],
    success: 'Task created',
  });
}

export function useUpdateTask() {
  return useApiMutation<Task, { id: string } & Partial<Task>>(({ id, ...input }) => api.patch(`/tasks/${id}`, input), {
    invalidate: [['tasks']],
  });
}

export function useComments(targetType?: string, targetId?: string) {
  return useQuery({
    queryKey: collabKeys.comments(targetType ?? '', targetId ?? ''),
    queryFn: async () => {
      const res = await api.get<Paged<Comment> | Comment[]>('/comments', { targetType, targetId, pageSize: 200 });
      return Array.isArray(res) ? res : res.items;
    },
    enabled: !!targetType && !!targetId,
  });
}

export function useAddComment() {
  return useApiMutation<Comment, { targetType: string; targetId: string; body: string; parentId?: string; isInternal?: boolean }>(
    (input) => api.post('/comments', input),
    { invalidate: (_d, v) => [collabKeys.comments(v.targetType, v.targetId)] },
  );
}

export function useNotifications(unread = false, options: { refetchInterval?: number; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: collabKeys.notifications(unread),
    queryFn: async () => {
      const res = await api.get<Paged<Notification> | Notification[]>('/notifications', compactParams({ unread, pageSize: 50 }));
      return Array.isArray(res) ? { items: res, total: res.length } : res;
    },
    refetchInterval: options.refetchInterval,
    enabled: options.enabled ?? true,
  });
}

export function useMarkNotificationRead() {
  return useApiMutation<void, string>((id) => api.post(`/notifications/${id}/read`), {
    invalidate: [['notifications']],
  });
}

export function useMarkAllNotificationsRead() {
  return useApiMutation<void, void>(() => api.post('/notifications/read-all'), {
    invalidate: [['notifications']],
    success: 'All notifications marked as read',
  });
}

export function useAuditTrail(
  params: ListParams & { targetType?: string; targetId?: string; actorId?: string; from?: string; to?: string } = {},
  enabled = true,
) {
  const p = compactParams(params);
  return useQuery({
    queryKey: collabKeys.auditTrail(p),
    queryFn: () => api.get<Paged<AuditTrailEntry>>('/audit-trail', p),
    enabled,
  });
}

export function useSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: collabKeys.search(term),
    queryFn: () => api.get<SearchResults>('/search', { q: term }),
    enabled: term.length >= 2,
    staleTime: 15 * 1000,
  });
}
