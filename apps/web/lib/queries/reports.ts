'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { EngagementRegisterReport, EngagementReport, ExecutiveReport, FindingRegisterReport, ListParams } from '@/lib/types';
import { compactParams } from './helpers';

export const reportKeys = {
  executive: (params: Record<string, unknown>) => ['reports', 'executive', params] as const,
  findings: (params: Record<string, unknown>) => ['reports', 'findings', params] as const,
  engagements: (params: Record<string, unknown>) => ['reports', 'engagements', params] as const,
  engagement: (id: string) => ['reports', 'engagement', id] as const,
};

export function useExecutiveReport(params: { from?: string; to?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: reportKeys.executive(p),
    queryFn: () => api.get<ExecutiveReport>('/reports/executive', p),
    enabled,
  });
}

export function useFindingReport(params: ListParams & { status?: string; severity?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: reportKeys.findings(p),
    queryFn: () => api.get<FindingRegisterReport>('/reports/findings', p),
    enabled,
  });
}

export function useEngagementReportRegister(params: ListParams & { stage?: string; status?: string; leadId?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: reportKeys.engagements(p),
    queryFn: () => api.get<EngagementRegisterReport>('/reports/engagements', p),
    enabled,
  });
}

export function useEngagementReport(id?: string) {
  return useQuery({
    queryKey: reportKeys.engagement(id ?? ''),
    queryFn: () => api.get<EngagementReport>(`/reports/engagements/${id}`),
    enabled: !!id,
  });
}
