'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { PermissionKey } from '@auditsphere/shared';
import { api, isApiError } from '@/lib/api';
import type { User } from '@/lib/types';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

export function useCurrentUser() {
  const query = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<{ user: User }>('/auth/me', undefined, { noRefresh: false });
      return res.user;
    },
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => !(isApiError(err) && (err.status === 401 || err.status === 403)) && count < 2,
  });
  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function hasPermission(user: Pick<User, 'permissions'> | null | undefined, permission: PermissionKey | PermissionKey[]) {
  if (!user) return false;
  const perms = user.permissions ?? [];
  if (Array.isArray(permission)) return permission.some((p) => perms.includes(p));
  return perms.includes(permission);
}

/** Returns a `can(permission)` predicate bound to the current user. */
export function useCan() {
  const { user } = useCurrentUser();
  return React.useCallback(
    (permission: PermissionKey | PermissionKey[] | undefined) => {
      if (!permission) return true;
      return hasPermission(user, permission);
    },
    [user],
  );
}

interface CanProps {
  permission: PermissionKey | PermissionKey[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/** Renders children only when the current user holds (any of) the permission(s). */
export function Can({ permission, fallback = null, children }: CanProps) {
  const can = useCan();
  return <>{can(permission) ? children : fallback}</>;
}

export function useSignOut() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.post('/auth/logout', undefined, { noRefresh: true });
      } catch {
        // Ignore - cookies are cleared server-side; we navigate regardless.
      }
    },
    onSettled: () => {
      qc.clear();
      router.replace('/sign-in');
    },
  });
}

/** Choose the default dashboard for the signed-in user. */
export function primaryDashboard(user: User | null): 'auditor' | 'partner' | 'committee' | null {
  if (!user) return null;
  const roles = user.roles ?? [];
  if (roles.includes('AUDIT_COMMITTEE_VIEWER') && !hasPermission(user, 'dashboard:auditor')) return 'committee';
  if ((roles.includes('AUDIT_PARTNER') || roles.includes('CHIEF_AUDIT_EXECUTIVE')) && hasPermission(user, 'dashboard:partner'))
    return 'partner';
  if (hasPermission(user, 'dashboard:auditor')) return 'auditor';
  if (hasPermission(user, 'dashboard:partner')) return 'partner';
  if (hasPermission(user, 'dashboard:committee')) return 'committee';
  return null;
}

/** Permissions that only make sense inside the full audit workspace. */
const WORKSPACE_PERMISSIONS: PermissionKey[] = [
  'dashboard:auditor',
  'dashboard:partner',
  'dashboard:committee',
  'universe:read',
  'risk:read',
  'control:read',
  'plan:read',
  'report:export',
];

/** Business-side users who respond to document requests or provide management responses. */
export function canUsePortal(user: User | null | undefined): boolean {
  return hasPermission(user, ['request:respond', 'finding:respond']);
}

export function hasWorkspaceAccess(user: User | null | undefined): boolean {
  return hasPermission(user, WORKSPACE_PERMISSIONS);
}

/** True for users whose only work in the platform is responding through the client portal. */
export function isPortalOnlyUser(user: User | null | undefined): boolean {
  return canUsePortal(user) && !hasWorkspaceAccess(user);
}

/** Where a signed-in user lands when no return path was requested. */
export function homePathFor(user: User | null | undefined): string {
  return isPortalOnlyUser(user) ? '/portal' : '/';
}
