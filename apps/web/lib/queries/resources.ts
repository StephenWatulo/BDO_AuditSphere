'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ChargeCode, ListParams, Paged, ResourceSummary, StaffAvailability, TimeEntry, Timesheet } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const resourceKeys = {
  all: ['resources'] as const,
  summary: ['resources', 'summary'] as const,
  chargeCodes: ['resources', 'charge-codes'] as const,
  timesheets: (params: Record<string, unknown>) => ['resources', 'timesheets', params] as const,
  availability: (params: Record<string, unknown>) => ['resources', 'availability', params] as const,
};

export function useResourceSummary(enabled = true) {
  return useQuery({
    queryKey: resourceKeys.summary,
    queryFn: () => api.get<ResourceSummary>('/resources/summary'),
    enabled,
  });
}

export function useChargeCodes(enabled = true) {
  return useQuery({
    queryKey: resourceKeys.chargeCodes,
    queryFn: () => api.get<ChargeCode[]>('/charge-codes'),
    enabled,
  });
}

export function useTimesheets(params: ListParams & { mine?: boolean; userId?: string; status?: string; weekStart?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: resourceKeys.timesheets(p),
    queryFn: () => api.get<Paged<Timesheet>>('/timesheets', p),
    enabled,
  });
}

export function useCurrentTimesheet() {
  return useApiMutation<Timesheet, { weekStart?: string }>((input) => api.post('/timesheets/current', input), {
    invalidate: [resourceKeys.summary, resourceKeys.all],
    success: 'Timesheet opened',
  });
}

export interface TimeEntryInput {
  date?: string;
  chargeCodeId?: string;
  engagementId?: string | null;
  hours?: number;
  notes?: string | null;
}

export function useCreateTimeEntry(timesheetId?: string) {
  return useApiMutation<TimeEntry, TimeEntryInput>(
    (input) => api.post(`/timesheets/${timesheetId}/entries`, input),
    { invalidate: [resourceKeys.summary, resourceKeys.all], success: 'Time recorded' },
  );
}

export function useUpdateTimeEntry() {
  return useApiMutation<TimeEntry, { id: string } & TimeEntryInput>(
    ({ id, ...input }) => api.patch(`/time-entries/${id}`, input),
    { invalidate: [resourceKeys.summary, resourceKeys.all], success: 'Time entry updated' },
  );
}

export function useDeleteTimeEntry() {
  return useApiMutation<void, string>((id) => api.delete(`/time-entries/${id}`), {
    invalidate: [resourceKeys.summary, resourceKeys.all],
    success: 'Time entry removed',
  });
}

export function useSubmitTimesheet() {
  return useApiMutation<Timesheet, string>((id) => api.post(`/timesheets/${id}/submit`), {
    invalidate: [resourceKeys.summary, resourceKeys.all],
    success: 'Timesheet submitted',
  });
}

export function useApproveTimesheet() {
  return useApiMutation<Timesheet, string>((id) => api.post(`/timesheets/${id}/approve`), {
    invalidate: [resourceKeys.summary, resourceKeys.all],
    success: 'Timesheet approved',
  });
}

export function useRejectTimesheet() {
  return useApiMutation<Timesheet, { id: string; reason: string }>(
    ({ id, reason }) => api.post(`/timesheets/${id}/reject`, { reason }),
    { invalidate: [resourceKeys.summary, resourceKeys.all], success: 'Timesheet rejected' },
  );
}

export function useAvailability(params: ListParams & { userId?: string; type?: string; from?: string; to?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: resourceKeys.availability(p),
    queryFn: () => api.get<Paged<StaffAvailability>>('/resources/availability', p),
    enabled,
  });
}

export function useCreateAvailability() {
  return useApiMutation<StaffAvailability, Partial<StaffAvailability>>(
    (input) => api.post('/resources/availability', input),
    { invalidate: [resourceKeys.summary, resourceKeys.all], success: 'Availability recorded' },
  );
}

export function useUpdateAvailability() {
  return useApiMutation<StaffAvailability, { id: string } & Partial<StaffAvailability>>(
    ({ id, ...input }) => api.patch(`/resources/availability/${id}`, input),
    { invalidate: [resourceKeys.summary, resourceKeys.all], success: 'Availability updated' },
  );
}
