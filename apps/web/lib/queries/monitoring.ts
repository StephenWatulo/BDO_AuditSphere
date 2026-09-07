'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DataConnector, ListParams, MonitoringAlert, MonitoringRule, MonitoringSummary, Paged, RiskSignal } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const monitoringKeys = {
  all: ['monitoring'] as const,
  summary: ['monitoring', 'summary'] as const,
  signals: (params: Record<string, unknown>) => ['monitoring', 'signals', params] as const,
  alerts: (params: Record<string, unknown>) => ['monitoring', 'alerts', params] as const,
  alert: (id: string) => ['monitoring', 'alert', id] as const,
  rules: (params: Record<string, unknown>) => ['monitoring', 'rules', params] as const,
  connectors: (params: Record<string, unknown>) => ['monitoring', 'connectors', params] as const,
};

export function useMonitoringSummary(enabled = true) {
  return useQuery({
    queryKey: monitoringKeys.summary,
    queryFn: () => api.get<MonitoringSummary>('/monitoring/summary'),
    enabled,
  });
}

export function useRiskSignals(params: ListParams & { status?: string; source?: string; riskId?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: monitoringKeys.signals(p),
    queryFn: () => api.get<Paged<RiskSignal>>('/monitoring/signals', p),
    enabled,
  });
}

export function useUpdateRiskSignal() {
  return useApiMutation<RiskSignal, { id: string; status?: string; riskId?: string | null }>(
    ({ id, ...input }) => api.patch(`/monitoring/signals/${id}`, input),
    { invalidate: [monitoringKeys.all], success: 'Signal updated' },
  );
}

export function useMonitoringAlerts(params: ListParams & { status?: string; ruleId?: string; mine?: boolean; from?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: monitoringKeys.alerts(p),
    queryFn: () => api.get<Paged<MonitoringAlert>>('/monitoring/alerts', p),
    enabled,
  });
}

export function useUpdateMonitoringAlert() {
  return useApiMutation<MonitoringAlert, { id: string; status?: string; assigneeId?: string | null; findingId?: string | null }>(
    ({ id, ...input }) => api.patch(`/monitoring/alerts/${id}`, input),
    { invalidate: [monitoringKeys.all], success: 'Alert updated' },
  );
}

export function useMonitoringAlert(id: string) {
  return useQuery({
    queryKey: monitoringKeys.alert(id),
    queryFn: () => api.get<MonitoringAlert>(`/monitoring/alerts/${encodeURIComponent(id)}`),
    enabled: !!id,
  });
}

export function useMonitoringRules(params: ListParams & { ruleType?: string; active?: boolean } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: monitoringKeys.rules(p),
    queryFn: () => api.get<Paged<MonitoringRule>>('/monitoring/rules', p),
    enabled,
  });
}

export function useCreateMonitoringRule() {
  return useApiMutation<MonitoringRule, Partial<MonitoringRule>>(
    (input) => api.post('/monitoring/rules', input),
    { invalidate: [monitoringKeys.all], success: 'Monitoring rule created' },
  );
}

export function useUpdateMonitoringRule() {
  return useApiMutation<MonitoringRule, { id: string } & Partial<MonitoringRule>>(
    ({ id, ...input }) => api.patch(`/monitoring/rules/${id}`, input),
    { invalidate: [monitoringKeys.all], success: 'Monitoring rule updated' },
  );
}

export function useDataConnectors(params: ListParams & { type?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: monitoringKeys.connectors(p),
    queryFn: () => api.get<Paged<DataConnector>>('/monitoring/connectors', p),
    enabled,
  });
}
