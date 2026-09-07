'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DocumentRequest, ListParams, Paged } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';
import { engagementKeys } from './engagements';

export const requestKeys = {
  all: ['requests'] as const,
  list: (params: Record<string, unknown>) => ['requests', 'list', params] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
};

export function useRequests(
  params: ListParams & { engagementId?: string; status?: string | string[]; mine?: boolean } = {},
  enabled = true,
) {
  const p = compactParams(params);
  return useQuery({
    queryKey: requestKeys.list(p),
    queryFn: () => api.get<Paged<DocumentRequest>>('/requests', p),
    enabled,
  });
}

export function useRequest(id?: string) {
  return useQuery({
    queryKey: requestKeys.detail(id ?? ''),
    queryFn: () => api.get<DocumentRequest>(`/requests/${id}`),
    enabled: !!id,
  });
}

export interface RequestInput {
  engagementId?: string;
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeEmail?: string | null;
  dueDate?: string;
  responseNote?: string | null;
}

export function useCreateRequest() {
  return useApiMutation<DocumentRequest, RequestInput>((input) => api.post('/requests', input), {
    invalidate: (d) => [requestKeys.all, engagementKeys.detail(d.engagementId)],
    success: (d) => `Request ${d.reference} raised`,
  });
}

export function useUpdateRequest(id: string) {
  return useApiMutation<DocumentRequest, RequestInput & { silent?: boolean }>(
    ({ silent: _s, ...input }) => api.patch(`/requests/${id}`, input),
    { invalidate: [requestKeys.all], success: (_d, v) => (v.silent ? undefined : 'Request updated') },
  );
}

export function useRequestTransition(id: string) {
  return useApiMutation<DocumentRequest, { action: string; comment?: string }>(
    (input) => api.post(`/requests/${id}/transition`, input),
    { invalidate: [requestKeys.all, engagementKeys.all], success: 'Request status updated' },
  );
}

export function useLinkRequestDocument(id: string) {
  return useApiMutation<DocumentRequest, { documentId: string }>((input) => api.post(`/requests/${id}/documents`, input), {
    invalidate: [requestKeys.detail(id)],
  });
}
