import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string;
  userId?: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

export interface BindUserInput {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Request-scoped context carried through AsyncLocalStorage. Populated by the
 * request-context middleware (request id, ip, user agent) and enriched by the
 * JWT guard (tenant, user, permissions). Services and the Prisma tenant client
 * read from it without needing request-scoped providers.
 */
@Injectable()
export class TenantContext {
  private readonly als = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  /** Runs `fn` with an explicit tenant (and optional actor), for jobs and scripts. */
  runAs<T>(
    input: { tenantId: string; userId?: string; email?: string; permissions?: string[]; requestId?: string },
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.als.run(
      {
        requestId: input.requestId ?? `job-${Date.now()}`,
        tenantId: input.tenantId,
        userId: input.userId,
        email: input.email,
        roles: [],
        permissions: input.permissions ?? [],
      },
      fn,
    );
  }

  get store(): RequestContextStore | undefined {
    return this.als.getStore();
  }

  bindUser(user: BindUserInput) {
    const s = this.store;
    if (!s) return;
    s.tenantId = user.tenantId;
    s.userId = user.id;
    s.email = user.email;
    s.roles = [...user.roles];
    s.permissions = [...user.permissions];
  }

  get tenantId(): string {
    const t = this.store?.tenantId;
    if (!t) throw new UnauthorizedException('No tenant context');
    return t;
  }
  get tenantIdOrNull(): string | null {
    return this.store?.tenantId ?? null;
  }
  get userId(): string {
    const u = this.store?.userId;
    if (!u) throw new UnauthorizedException('No user context');
    return u;
  }
  get userIdOrNull(): string | null {
    return this.store?.userId ?? null;
  }
  get email(): string | null {
    return this.store?.email ?? null;
  }
  get requestId(): string | null {
    return this.store?.requestId ?? null;
  }
  get ip(): string | null {
    return this.store?.ip ?? null;
  }
  get userAgent(): string | null {
    return this.store?.userAgent ?? null;
  }
  get roles(): string[] {
    return this.store?.roles ?? [];
  }
  get permissions(): string[] {
    return this.store?.permissions ?? [];
  }
  hasPermission(...keys: string[]): boolean {
    const perms = this.permissions;
    return keys.some((k) => perms.includes(k));
  }
  hasRole(...roles: string[]): boolean {
    const mine = this.roles;
    return roles.some((r) => mine.includes(r));
  }
}
