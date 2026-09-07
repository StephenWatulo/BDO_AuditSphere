'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ListParams, Paged, Role, RoleKey, User, UserStatus } from '@/lib/types';
import { compactParams, useApiMutation } from './helpers';

export const userKeys = {
  all: ['users'] as const,
  list: (params: Record<string, unknown>) => ['users', 'list', params] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
  roles: ['roles'] as const,
};

export function useUsers(params: ListParams & { status?: string; role?: string } = {}, enabled = true) {
  const p = compactParams(params);
  return useQuery({
    queryKey: userKeys.list(p),
    queryFn: () => api.get<Paged<User>>('/users', p),
    enabled,
  });
}

export function useUser(id?: string) {
  return useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => api.get<User>(`/users/${id}`),
    enabled: !!id,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: userKeys.roles,
    queryFn: async () => {
      const res = await api.get<Role[] | { items: Role[] }>('/roles');
      return Array.isArray(res) ? res : res.items;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  roles: RoleKey[];
  password?: string;
}

export function useCreateUser() {
  return useApiMutation<User & { temporaryPassword?: string }, CreateUserInput>(
    (input) => api.post('/users', input),
    { invalidate: [userKeys.all], success: 'User invited' },
  );
}

export function useUpdateUser(id: string) {
  return useApiMutation<User, Partial<User> & { status?: UserStatus }>((input) => api.patch(`/users/${id}`, input), {
    invalidate: [userKeys.all],
    success: 'User updated',
  });
}

export function useSetUserRoles(id: string) {
  return useApiMutation<User, { roles: RoleKey[] }>((input) => api.put(`/users/${id}/roles`, input), {
    invalidate: [userKeys.all],
    success: 'Roles updated',
  });
}
