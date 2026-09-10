import { Injectable } from '@nestjs/common';
import { Prisma, RoleKey } from '@auditsphere/db';
import { AUDIT_FUNCTION_ROLES, ROLE_PERMISSIONS } from '@auditsphere/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AuthUser } from './auth.types';

const CACHE_TTL_MS = 60_000;

export const USER_ACCESS_INCLUDE = {
  tenant: { select: { id: true, slug: true, name: true, isActive: true } },
  roles: {
    include: {
      role: { include: { permissions: { include: { permission: { select: { key: true } } } } } },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{ include: typeof USER_ACCESS_INCLUDE }>;

/**
 * Computes the effective permission set of a user: the static role matrix from
 * `@auditsphere/shared` unioned with any `RolePermission` rows stored for the
 * tenant (so administrators can extend roles later without a release).
 */
export function buildAuthUser(user: UserWithAccess, mfaEnforcement: 'off' | 'audit' | 'all' = 'audit'): AuthUser {
  const roles = Array.from(new Set(user.roles.map((ur) => ur.role.key))) as RoleKey[];
  const permissions = new Set<string>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) permissions.add(p);
  for (const ur of user.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.key);

  const isAuditFunction = roles.some((r) => AUDIT_FUNCTION_ROLES.includes(r));
  const preferences = user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
    ? user.preferences
    : {};
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    jobTitle: user.jobTitle,
    avatarUrl: user.avatarUrl,
    status: user.status,
    authProvider: user.authProvider,
    mfaEnabled: user.mfaEnabled,
    mustChangePassword: preferences.mustChangePassword === true,
    mfaRequiredToEnrol:
      user.authProvider === 'LOCAL' &&
      !user.mfaEnabled &&
      (mfaEnforcement === 'all' || (mfaEnforcement === 'audit' && isAuditFunction)),
    roles,
    permissions: Array.from(permissions).sort(),
    tenant: user.tenant,
  };
}

/** Strips internal-only fields for the wire `user` shape. */
export function toPublicUser(user: AuthUser) {
  const { tenant, ...rest } = user;
  return { ...rest, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
}

@Injectable()
export class UserAccessService {
  private readonly cache = new Map<string, { expires: number; value: AuthUser }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async load(userId: string, opts: { fresh?: boolean } = {}): Promise<AuthUser | null> {
    const now = Date.now();
    if (!opts.fresh) {
      const hit = this.cache.get(userId);
      if (hit && hit.expires > now) return hit.value;
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: USER_ACCESS_INCLUDE,
    });
    if (!user) {
      this.cache.delete(userId);
      return null;
    }
    const value = buildAuthUser(user, this.config.auth.mfaEnforcement);
    this.cache.set(userId, { expires: now + CACHE_TTL_MS, value });
    return value;
  }

  invalidate(userId?: string) {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }
}
