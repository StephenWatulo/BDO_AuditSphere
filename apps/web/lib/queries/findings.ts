'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Finding, FindingAgeing, FindingSummary, ListParams, Paged, Recommendation } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';
import { engagementKeys } from './engagements';

export const findingKeys = {
  all: ['findings'] as const,
  list: (params: Record<string, unknown>) => ['findings', 'list', params] as const,
  detail: (id: string) => ['findings', 'detail', id] as const,
  ageing: ['findings', 'ageing'] as const,
};

export function useFindings(
  params: ListParams & {
    engagementId?: string;
    entityId?: string;
    status?: string | string[];
    severity?: string | string[];
    actionOwnerId?: string;
    overdue?: boolean;
    mine?: boolean;
  } = {},
  enabled = true,
) {
  const p = compactParams(params);
  return useQuery({
    queryKey: findingKeys.list(p),
    queryFn: () => api.get<Paged<FindingSummary>>('/findings', p),
    enabled,
  });
}

export function useFinding(id?: string) {
  return useQuery({
    queryKey: findingKeys.detail(id ?? ''),
    queryFn: () => api.get<Finding>(`/findings/${id}`),
    enabled: !!id,
  });
}

export function useFindingAgeing(enabled = true) {
  return useQuery({
    queryKey: findingKeys.ageing,
    queryFn: () => api.get<FindingAgeing>('/findings/ageing'),
    enabled,
  });
}

export interface FindingInput {
  engagementId?: string;
  title?: string;
  severity?: string;
  condition?: string;
  criteria?: string;
  cause?: string | null;
  impact?: string | null;
  recommendation?: string | null;
  managementResponse?: string | null;
  workpaperId?: string | null;
  riskId?: string | null;
  controlId?: string | null;
  processId?: string | null;
  entityId?: string | null;
  rootCauseCategory?: string | null;
  repeatOfId?: string | null;
  actionOwnerId?: string | null;
  actionOwnerName?: string | null;
  actionOwnerEmail?: string | null;
  dueDate?: string | null;
  category?: string | null;
}

export function useCreateFinding() {
  return useApiMutation<Finding, FindingInput>((input) => api.post('/findings', input), {
    invalidate: (d) => [findingKeys.all, engagementKeys.detail(d.engagementId)],
    success: (d) => `Finding ${d.reference} created`,
  });
}

export function useUpdateFinding(id: string) {
  return useApiMutation<Finding, FindingInput & { silent?: boolean }>(
    ({ silent: _s, ...input }) => api.patch(`/findings/${id}`, input),
    { invalidate: [findingKeys.all], success: (_d, v) => (v.silent ? undefined : 'Finding updated') },
  );
}

export function useFindingTransition(id: string) {
  return useApiMutation<Finding, { action: string; comment?: string }>(
    (input) => api.post(`/findings/${id}/transition`, input),
    { invalidate: [findingKeys.all, engagementKeys.all], success: 'Finding status updated' },
  );
}

export function useExtendFinding(id: string) {
  return useApiMutation<Finding, { dueDate: string; reason: string }>((input) => api.post(`/findings/${id}/extend`, input), {
    invalidate: [findingKeys.all],
    success: 'Due date extended',
  });
}

export function useAddRecommendation(findingId: string) {
  return useApiMutation<Recommendation, Partial<Recommendation>>(
    (input) => api.post(`/findings/${findingId}/recommendations`, input),
    { invalidate: [findingKeys.detail(findingId)], success: 'Recommendation added' },
  );
}

export function useUpdateRecommendation(findingId: string) {
  return useApiMutation<Recommendation, { id: string } & Partial<Recommendation>>(
    ({ id, ...input }) => api.patch(`/recommendations/${id}`, input),
    { invalidate: [findingKeys.detail(findingId)], success: 'Recommendation updated' },
  );
}
