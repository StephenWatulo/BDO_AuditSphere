'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Control, ControlTest, ListParams, Paged } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';
import { riskKeys } from './risks';

export const controlKeys = {
  all: ['controls'] as const,
  list: (params: Record<string, unknown>) => ['controls', 'list', params] as const,
  detail: (id: string) => ['controls', 'detail', id] as const,
};

export function useControls(
  params: ListParams & { processId?: string; type?: string; nature?: string; effectiveness?: string | string[] } = {},
  enabled = true,
) {
  const p = compactParams(params);
  return useQuery({
    queryKey: controlKeys.list(p),
    queryFn: () => api.get<Paged<Control>>('/controls', p),
    enabled,
  });
}

export function useControl(id?: string | null) {
  return useQuery({
    queryKey: controlKeys.detail(id ?? ''),
    queryFn: () => api.get<Control>(`/controls/${id}`),
    enabled: !!id,
  });
}

export type ControlInput = Partial<
  Pick<
    Control,
    | 'code'
    | 'title'
    | 'description'
    | 'processId'
    | 'ownerId'
    | 'frequency'
    | 'type'
    | 'nature'
    | 'isKeyControl'
    | 'effectiveness'
    | 'frameworkReferences'
    | 'isActive'
  >
>;

export function useCreateControl() {
  return useApiMutation<Control, ControlInput>((input) => api.post('/controls', input), {
    invalidate: [controlKeys.all],
    success: 'Control created',
  });
}

export function useUpdateControl(id: string) {
  return useApiMutation<Control, ControlInput>((input) => api.patch(`/controls/${id}`, input), {
    invalidate: [controlKeys.all],
    success: 'Control updated',
  });
}

export function useSetControlRisks(id: string) {
  return useApiMutation<Control, { riskIds: string[] }>((input) => api.put(`/controls/${id}/risks`, input), {
    invalidate: [controlKeys.all, riskKeys.all],
    success: 'Linked risks updated',
  });
}

export interface ControlTestInput {
  testType: 'DESIGN' | 'OPERATING';
  engagementId?: string;
  workpaperId?: string;
  periodStart?: string;
  periodEnd?: string;
  populationSize?: number;
  sampleSize?: number;
  exceptions?: number;
  result: ControlTest['result'];
  procedure?: string;
  conclusion?: string;
  remediation?: string;
  testedAt?: string;
}

export function useRecordControlTest(controlId: string) {
  return useApiMutation<ControlTest, ControlTestInput>((input) => api.post(`/controls/${controlId}/tests`, input), {
    invalidate: [controlKeys.all],
    success: 'Control test recorded',
  });
}
