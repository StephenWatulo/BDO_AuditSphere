'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AuditProgram,
  Engagement,
  EngagementMember,
  EngagementMilestone,
  EngagementRole,
  EngagementStakeholder,
  EngagementSummary,
  Evidence,
  ListParams,
  Paged,
  ProgramStep,
  Workpaper,
  WorkpaperSummary,
} from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const engagementKeys = {
  all: ['engagements'] as const,
  list: (params: Record<string, unknown>) => ['engagements', 'list', params] as const,
  detail: (id: string) => ['engagements', 'detail', id] as const,
  programs: (id: string) => ['engagements', id, 'programs'] as const,
  workpapers: (id: string) => ['engagements', id, 'workpapers'] as const,
  evidence: (id: string) => ['engagements', id, 'evidence'] as const,
};

export function useEngagements(
  params: ListParams & {
    stage?: string | string[];
    status?: string;
    entityId?: string;
    type?: string;
    leadId?: string;
    mine?: boolean;
  } = {},
  enabled = true,
) {
  const p = compactParams(params);
  return useQuery({
    queryKey: engagementKeys.list(p),
    queryFn: () => api.get<Paged<EngagementSummary>>('/engagements', p),
    enabled,
  });
}

export function useEngagement(id?: string) {
  return useQuery({
    queryKey: engagementKeys.detail(id ?? ''),
    queryFn: () => api.get<Engagement>(`/engagements/${id}`),
    enabled: !!id,
  });
}

export interface EngagementInput {
  title?: string;
  type?: string;
  entityId?: string | null;
  objectives?: string | null;
  scope?: string | null;
  outOfScope?: string | null;
  background?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  budgetHours?: number | null;
  budgetAmount?: number | null;
  leadId?: string | null;
  managerId?: string | null;
  partnerId?: string | null;
  riskRating?: string;
  status?: string;
  opinion?: string;
  executiveSummary?: string | null;
  reportDocumentId?: string | null;
}

export function useCreateEngagement() {
  return useApiMutation<Engagement, EngagementInput>((input) => api.post('/engagements', input), {
    invalidate: [engagementKeys.all],
    success: (d) => `Engagement ${d.auditNumber} created`,
  });
}

export function useUpdateEngagement(id: string) {
  return useApiMutation<Engagement, EngagementInput>((input) => api.patch(`/engagements/${id}`, input), {
    invalidate: [engagementKeys.all],
    success: 'Engagement updated',
  });
}

export function useEngagementTransition(id: string) {
  return useApiMutation<Engagement, { action: string; comment?: string }>(
    (input) => api.post(`/engagements/${id}/transition`, input),
    { invalidate: [engagementKeys.all], success: 'Stage updated' },
  );
}

export function useAddMember(id: string) {
  return useApiMutation<EngagementMember, { userId: string; role: EngagementRole; plannedHours?: number }>(
    (input) => api.post(`/engagements/${id}/members`, input),
    { invalidate: [engagementKeys.detail(id)], success: 'Team member added' },
  );
}

export function useRemoveMember(id: string) {
  return useApiMutation<void, string>((userId) => api.delete(`/engagements/${id}/members/${userId}`), {
    invalidate: [engagementKeys.detail(id)],
    success: 'Team member removed',
  });
}

export function useAddStakeholder(id: string) {
  return useApiMutation<EngagementStakeholder, Partial<EngagementStakeholder>>(
    (input) => api.post(`/engagements/${id}/stakeholders`, input),
    { invalidate: [engagementKeys.detail(id)], success: 'Stakeholder added' },
  );
}

export function useRemoveStakeholder(id: string) {
  return useApiMutation<void, string>((sid) => api.delete(`/engagements/${id}/stakeholders/${sid}`), {
    invalidate: [engagementKeys.detail(id)],
    success: 'Stakeholder removed',
  });
}

export function useAddMilestone(id: string) {
  return useApiMutation<EngagementMilestone, Partial<EngagementMilestone>>(
    (input) => api.post(`/engagements/${id}/milestones`, input),
    { invalidate: [engagementKeys.detail(id)], success: 'Milestone added' },
  );
}

export function useUpdateMilestone(id: string) {
  return useApiMutation<EngagementMilestone, { milestoneId: string } & Partial<EngagementMilestone>>(
    ({ milestoneId, ...input }) => api.patch(`/engagements/${id}/milestones/${milestoneId}`, input),
    { invalidate: [engagementKeys.detail(id)], success: 'Milestone updated' },
  );
}

export function useDeleteMilestone(id: string) {
  return useApiMutation<void, string>((mid) => api.delete(`/engagements/${id}/milestones/${mid}`), {
    invalidate: [engagementKeys.detail(id)],
    success: 'Milestone removed',
  });
}

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

export function usePrograms(engagementId?: string) {
  return useQuery({
    queryKey: engagementKeys.programs(engagementId ?? ''),
    queryFn: async () => {
      const res = await api.get<Paged<AuditProgram> | AuditProgram[]>(`/engagements/${engagementId}/programs`);
      return Array.isArray(res) ? res : res.items;
    },
    enabled: !!engagementId,
  });
}

export function useCreateProgram(engagementId: string) {
  return useApiMutation<AuditProgram, { title: string; description?: string; libraryItemId?: string }>(
    (input) => api.post(`/engagements/${engagementId}/programs`, input),
    { invalidate: [engagementKeys.programs(engagementId), engagementKeys.detail(engagementId)], success: 'Programme created' },
  );
}

export type StepInput = Partial<
  Pick<ProgramStep, 'section' | 'reference' | 'objective' | 'procedure' | 'riskId' | 'controlId' | 'assigneeId' | 'estimatedHours' | 'status' | 'sortOrder'>
>;

export function useAddStep(engagementId: string) {
  return useApiMutation<ProgramStep, { programId: string } & StepInput>(
    ({ programId, ...input }) => api.post(`/programs/${programId}/steps`, input),
    { invalidate: [engagementKeys.programs(engagementId)], success: 'Step added' },
  );
}

export function useUpdateStep(engagementId: string) {
  return useApiMutation<ProgramStep, { stepId: string; silent?: boolean } & StepInput>(
    ({ stepId, silent: _s, ...input }) => api.patch(`/program-steps/${stepId}`, input),
    { invalidate: [engagementKeys.programs(engagementId)], success: (_d, v) => (v.silent ? undefined : 'Step updated') },
  );
}

export function useDeleteStep(engagementId: string) {
  return useApiMutation<void, string>((stepId) => api.delete(`/program-steps/${stepId}`), {
    invalidate: [engagementKeys.programs(engagementId)],
    success: 'Step removed',
  });
}

export function useReorderSteps(engagementId: string) {
  return useApiMutation<void, { programId: string; stepIds: string[] }>(
    ({ programId, stepIds }) => api.post(`/programs/${programId}/reorder`, { stepIds }),
    { invalidate: [engagementKeys.programs(engagementId)] },
  );
}

export function useApproveProgram(engagementId: string) {
  return useApiMutation<AuditProgram, string>((programId) => api.post(`/programs/${programId}/approve`), {
    invalidate: [engagementKeys.programs(engagementId), engagementKeys.detail(engagementId)],
    success: 'Programme approved',
  });
}

export function useCreateWorkpaperFromStep(engagementId: string) {
  return useApiMutation<Workpaper, string>((stepId) => api.post(`/program-steps/${stepId}/create-workpaper`), {
    invalidate: [engagementKeys.programs(engagementId), engagementKeys.workpapers(engagementId), engagementKeys.detail(engagementId)],
    success: 'Workpaper created',
  });
}

// ---------------------------------------------------------------------------
// Workpapers and evidence lists
// ---------------------------------------------------------------------------

export function useEngagementWorkpapers(engagementId?: string) {
  return useQuery({
    queryKey: engagementKeys.workpapers(engagementId ?? ''),
    queryFn: async () => {
      const res = await api.get<Paged<WorkpaperSummary> | WorkpaperSummary[]>(`/engagements/${engagementId}/workpapers`);
      return Array.isArray(res) ? res : res.items;
    },
    enabled: !!engagementId,
  });
}

export interface WorkpaperCreateInput {
  reference: string;
  title: string;
  objective?: string;
  procedure?: string;
  riskId?: string;
  controlId?: string;
  templateId?: string;
  programStepId?: string;
}

export function useCreateWorkpaper(engagementId: string) {
  return useApiMutation<Workpaper, WorkpaperCreateInput>(
    (input) => api.post(`/engagements/${engagementId}/workpapers`, input),
    { invalidate: [engagementKeys.workpapers(engagementId), engagementKeys.detail(engagementId)], success: 'Workpaper created' },
  );
}

export function useEngagementEvidence(engagementId?: string) {
  return useQuery({
    queryKey: engagementKeys.evidence(engagementId ?? ''),
    queryFn: async () => {
      const res = await api.get<Paged<Evidence> | Evidence[]>(`/engagements/${engagementId}/evidence`);
      return Array.isArray(res) ? res : res.items;
    },
    enabled: !!engagementId,
  });
}
