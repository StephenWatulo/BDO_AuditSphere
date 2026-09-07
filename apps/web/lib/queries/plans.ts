'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditPlan, Engagement, ListParams, ManagementRequest, Paged, PlanItem } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const planKeys = {
  all: ['plans'] as const,
  list: (params: Record<string, unknown>) => ['plans', 'list', params] as const,
  detail: (id: string) => ['plans', 'detail', id] as const,
  managementRequests: (params: Record<string, unknown>) => ['management-requests', params] as const,
};

export function usePlans(params: ListParams & { status?: string; fiscalYear?: number } = {}) {
  const p = compactParams(params);
  return useQuery({
    queryKey: planKeys.list(p),
    queryFn: () => api.get<Paged<AuditPlan>>('/plans', p),
  });
}

export function usePlan(id?: string) {
  return useQuery({
    queryKey: planKeys.detail(id ?? ''),
    queryFn: () => api.get<AuditPlan>(`/plans/${id}`),
    enabled: !!id,
  });
}

export type PlanInput = Partial<
  Pick<AuditPlan, 'title' | 'fiscalYear' | 'horizonYears' | 'startDate' | 'endDate' | 'totalBudgetHours' | 'totalBudgetAmount' | 'currency' | 'narrative'>
>;

export function useCreatePlan() {
  return useApiMutation<AuditPlan, PlanInput>((input) => api.post('/plans', input), {
    invalidate: [planKeys.all],
    success: 'Plan created',
  });
}

export function useUpdatePlan(id: string) {
  return useApiMutation<AuditPlan, PlanInput>((input) => api.patch(`/plans/${id}`, input), {
    invalidate: [planKeys.all],
    success: 'Plan updated',
  });
}

export type PlanItemInput = Partial<
  Pick<
    PlanItem,
    | 'entityId'
    | 'title'
    | 'description'
    | 'source'
    | 'engagementType'
    | 'riskRating'
    | 'priority'
    | 'plannedYear'
    | 'plannedQuarter'
    | 'plannedStart'
    | 'plannedEnd'
    | 'budgetHours'
    | 'budgetAmount'
    | 'leadId'
    | 'status'
    | 'rationale'
  >
>;

export function useCreatePlanItem(planId: string) {
  return useApiMutation<PlanItem, PlanItemInput>((input) => api.post(`/plans/${planId}/items`, input), {
    invalidate: [planKeys.detail(planId), planKeys.all],
    success: 'Plan item added',
  });
}

export function useUpdatePlanItem(planId: string) {
  return useApiMutation<PlanItem, { itemId: string } & PlanItemInput & { silent?: boolean }>(
    ({ itemId, silent: _silent, ...input }) => api.patch(`/plans/${planId}/items/${itemId}`, input),
    {
      invalidate: [planKeys.detail(planId)],
      success: (_d, v) => (v.silent ? undefined : 'Plan item updated'),
    },
  );
}

export function useDeletePlanItem(planId: string) {
  return useApiMutation<void, string>((itemId) => api.delete(`/plans/${planId}/items/${itemId}`), {
    invalidate: [planKeys.detail(planId), planKeys.all],
    success: 'Plan item removed',
  });
}

export function usePlanTransition(planId: string) {
  return useApiMutation<AuditPlan, { action: string; comment?: string }>(
    (input) => api.post(`/plans/${planId}/transition`, input),
    { invalidate: [planKeys.all], success: 'Plan status updated' },
  );
}

export function useCreateEngagementFromItem(planId: string) {
  return useApiMutation<Engagement, string>(
    (itemId) => api.post(`/plans/${planId}/items/${itemId}/create-engagement`),
    { invalidate: [planKeys.all, ['engagements']], success: 'Engagement created from plan item' },
  );
}

export function useManagementRequests(params: ListParams & { status?: string } = {}) {
  const p = compactParams(params);
  return useQuery({
    queryKey: planKeys.managementRequests(p),
    queryFn: () => api.get<Paged<ManagementRequest>>('/management-requests', p),
  });
}

export function useCreateManagementRequest() {
  return useApiMutation<ManagementRequest, Partial<ManagementRequest> & { entityId?: string }>(
    (input) => api.post('/management-requests', input),
    { invalidate: [['management-requests']], success: 'Management request logged' },
  );
}

export function useUpdateManagementRequest() {
  return useApiMutation<ManagementRequest, { id: string } & Partial<ManagementRequest>>(
    ({ id, ...input }) => api.patch(`/management-requests/${id}`, input),
    { invalidate: [['management-requests']], success: 'Request updated' },
  );
}
