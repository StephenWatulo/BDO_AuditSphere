'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditorDashboard, CommitteeDashboard, PartnerDashboard } from '@/lib/types';

export function useAuditorDashboard(enabled = true) {
  return useQuery({
    queryKey: ['dashboards', 'auditor'],
    queryFn: () => api.get<AuditorDashboard>('/dashboards/auditor'),
    enabled,
  });
}

export function usePartnerDashboard(enabled = true) {
  return useQuery({
    queryKey: ['dashboards', 'partner'],
    queryFn: () => api.get<PartnerDashboard>('/dashboards/partner'),
    enabled,
  });
}

export function useCommitteeDashboard(enabled = true) {
  return useQuery({
    queryKey: ['dashboards', 'committee'],
    queryFn: () => api.get<CommitteeDashboard>('/dashboards/committee'),
    enabled,
  });
}
