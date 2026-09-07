'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HeatmapCell, ListParams, Paged, Risk, RiskAssessment, RiskCategory, RiskVelocity, ScoringModel } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const riskKeys = {
  all: ['risks'] as const,
  list: (params: Record<string, unknown>) => ['risks', 'list', params] as const,
  detail: (id: string) => ['risks', 'detail', id] as const,
  heatmap: ['risks', 'heatmap'] as const,
  categories: ['risk-categories'] as const,
  scoringModels: ['scoring-models'] as const,
};

export function useRisks(
  params: ListParams & { entityId?: string; processId?: string; categoryId?: string; rating?: string | string[]; status?: string } = {},
  enabled = true,
) {
  const p = compactParams(params);
  return useQuery({
    queryKey: riskKeys.list(p),
    queryFn: () => api.get<Paged<Risk>>('/risks', p),
    enabled,
  });
}

export function useRisk(id?: string | null) {
  return useQuery({
    queryKey: riskKeys.detail(id ?? ''),
    queryFn: () => api.get<Risk>(`/risks/${id}`),
    enabled: !!id,
  });
}

export function useRiskHeatmap() {
  return useQuery({
    queryKey: riskKeys.heatmap,
    queryFn: async () => {
      const res = await api.get<{ cells: HeatmapCell[] } | HeatmapCell[]>('/risks/heatmap');
      return Array.isArray(res) ? res : res.cells;
    },
  });
}

export function useRiskCategories() {
  return useQuery({
    queryKey: riskKeys.categories,
    queryFn: async () => {
      const res = await api.get<Paged<RiskCategory> | RiskCategory[]>('/risk-categories');
      return Array.isArray(res) ? res : res.items;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useScoringModels() {
  return useQuery({
    queryKey: riskKeys.scoringModels,
    queryFn: async () => {
      const res = await api.get<Paged<ScoringModel> | ScoringModel[]>('/scoring-models');
      return Array.isArray(res) ? res : res.items;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export interface RiskInput {
  code?: string;
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  entityId?: string | null;
  processId?: string | null;
  ownerId?: string | null;
  source?: string | null;
  status?: string;
  inherentLikelihood?: number;
  inherentImpact?: number;
  controlEffectiveness?: number;
  velocity?: RiskVelocity;
  appetiteThreshold?: number | null;
  tags?: string[];
}

export function useCreateRisk() {
  return useApiMutation<Risk, RiskInput>((input) => api.post('/risks', input), {
    invalidate: [riskKeys.all],
    success: 'Risk created',
  });
}

export function useUpdateRisk(id: string) {
  return useApiMutation<Risk, RiskInput>((input) => api.patch(`/risks/${id}`, input), {
    invalidate: [riskKeys.all],
    success: 'Risk updated',
  });
}

export interface AssessRiskInput {
  periodLabel: string;
  inherentLikelihood: number;
  inherentImpact: number;
  controlEffectiveness: number;
  velocity: RiskVelocity;
  rationale?: string;
}

export function useAssessRisk(id: string) {
  return useApiMutation<RiskAssessment, AssessRiskInput>((input) => api.post(`/risks/${id}/assess`, input), {
    invalidate: [riskKeys.all],
    success: 'Assessment recorded',
  });
}
