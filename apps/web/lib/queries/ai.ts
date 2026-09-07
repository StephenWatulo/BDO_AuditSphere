'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AiContextDocument, AiCopilotResponse, AiFeature, AiInteraction, ListParams, Paged } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const aiKeys = {
  all: ['ai'] as const,
  context: ['ai', 'context-documents'] as const,
  interactions: (params: Record<string, unknown>) => ['ai', 'interactions', params] as const,
};

export interface CopilotInput {
  feature: AiFeature;
  prompt: string;
  targetType?: string;
  targetId?: string;
  context?: string;
  documentIds?: string[];
}

export function useAiContextDocuments(enabled: boolean) {
  return useQuery({ queryKey: aiKeys.context, queryFn: () => api.get<{ items: AiContextDocument[] }>('/ai/context-documents'), enabled });
}

export function useUploadAiContext() {
  return useApiMutation<AiContextDocument, File>((file) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload('/ai/context-documents', form);
  }, { invalidate: [aiKeys.context], silent: true });
}

export function useDeleteAiContext() {
  return useApiMutation<void, string>((id) => api.delete(`/documents/${id}`), { invalidate: [aiKeys.context] });
}

export function useCopilot() {
  return useApiMutation<AiCopilotResponse, CopilotInput>((input) => api.post('/ai/copilot', input), {
    invalidate: [aiKeys.all],
  });
}

export function useAiInteractions(params: ListParams & { feature?: AiFeature } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: aiKeys.interactions(p),
    queryFn: () => api.get<Paged<AiInteraction>>('/ai/interactions', p),
    enabled,
  });
}

export function useAiFeedback() {
  return useApiMutation<AiInteraction, { id: string; accepted?: boolean; rating?: number }>(
    ({ id, ...input }) => api.patch(`/ai/interactions/${id}`, input),
    { invalidate: [aiKeys.all], success: 'AI feedback saved' },
  );
}
