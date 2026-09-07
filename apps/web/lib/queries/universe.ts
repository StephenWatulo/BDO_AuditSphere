'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CoverageSummary, EntityDetail, EntityNode, Paged, Process } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const universeKeys = {
  all: ['universe'] as const,
  tree: (params: Record<string, unknown>) => ['universe', 'tree', params] as const,
  flat: (params: Record<string, unknown>) => ['universe', 'flat', params] as const,
  detail: (id: string) => ['universe', 'entity', id] as const,
  processes: (entityId?: string) => ['universe', 'processes', entityId ?? 'all'] as const,
  coverage: ['universe', 'coverage'] as const,
};

export function useEntityTree(params: { type?: string; country?: string; riskRating?: string } = {}) {
  const p = compactParams(params);
  return useQuery({
    queryKey: universeKeys.tree(p),
    queryFn: async () => {
      const res = await api.get<{ items: EntityNode[] } | EntityNode[]>('/universe/entities', p);
      return Array.isArray(res) ? res : res.items;
    },
  });
}

export function useEntitiesFlat(params: Record<string, unknown> = {}, enabled = true) {
  const p = compactParams({ ...params, flat: true });
  return useQuery({
    queryKey: universeKeys.flat(p),
    queryFn: () => api.get<Paged<EntityNode>>('/universe/entities', p),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEntity(id?: string | null) {
  return useQuery({
    queryKey: universeKeys.detail(id ?? ''),
    queryFn: () => api.get<EntityDetail>(`/universe/entities/${id}`),
    enabled: !!id,
  });
}

export function useCoverage() {
  return useQuery({
    queryKey: universeKeys.coverage,
    queryFn: () => api.get<CoverageSummary>('/universe/coverage'),
  });
}

export type EntityInput = Partial<
  Pick<
    EntityNode,
    | 'parentId'
    | 'type'
    | 'code'
    | 'name'
    | 'description'
    | 'ownerId'
    | 'country'
    | 'riskRating'
    | 'lastAuditDate'
    | 'nextAuditDue'
    | 'auditFrequencyMonths'
    | 'isActive'
    | 'strategicObjectives'
  >
>;

export function useCreateEntity() {
  return useApiMutation<EntityNode, EntityInput>((input) => api.post('/universe/entities', input), {
    invalidate: [universeKeys.all],
    success: 'Entity created',
  });
}

export function useUpdateEntity(id: string) {
  return useApiMutation<EntityNode, EntityInput>((input) => api.patch(`/universe/entities/${id}`, input), {
    invalidate: [universeKeys.all],
    success: 'Entity updated',
  });
}

export function useDeleteEntity() {
  return useApiMutation<void, string>((id) => api.delete(`/universe/entities/${id}`), {
    invalidate: [universeKeys.all],
    success: 'Entity removed',
  });
}

export function useProcesses(entityId?: string) {
  return useQuery({
    queryKey: universeKeys.processes(entityId),
    queryFn: async () => {
      const res = await api.get<Paged<Process> | Process[]>('/universe/processes', compactParams({ entityId }));
      return Array.isArray(res) ? res : res.items;
    },
    enabled: !!entityId,
  });
}

export type ProcessInput = Partial<Pick<Process, 'entityId' | 'code' | 'name' | 'description' | 'ownerId' | 'category' | 'isKey'>>;

export function useCreateProcess() {
  return useApiMutation<Process, ProcessInput>((input) => api.post('/universe/processes', input), {
    invalidate: [universeKeys.all],
    success: 'Process added',
  });
}

export function useUpdateProcess() {
  return useApiMutation<Process, { id: string } & ProcessInput>(
    ({ id, ...input }) => api.patch(`/universe/processes/${id}`, input),
    { invalidate: [universeKeys.all], success: 'Process updated' },
  );
}
