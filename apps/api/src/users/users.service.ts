import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleKey } from '@auditsphere/db';
import { PERMISSIONS, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { hashPassword } from '../auth/password';
import { UserAccessService } from '../auth/user-access.service';
import { randomPassword } from '../common/crypto';
import { paginate, parseSort } from '../common/pagination';
import { compact } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateUserDto, SetRolesDto, UpdateUserDto, UserListQueryDto, UserOptionsQueryDto } from './users.dto';

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  officeLocation: true,
  country: true,
  phone: true,
  avatarUrl: true,
  status: true,
  authProvider: true,
  mfaEnabled: true,
  lastLoginAt: true,
  weeklyCapacity: true,
  chargeRate: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { key: true } }, entityId: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

function shape(u: UserRow) {
  const { roles, ...rest } = u;
  return { ...rest, roles: Array.from(new Set(roles.map((r) => r.role.key))) };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly userAccess: UserAccessService,
  ) {}

  async list(query: UserListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { roles: { some: { role: { key: query.role } } } } : {}),
      ...(query.q
        ? { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { displayName: { contains: query.q, mode: 'insensitive' } }] }
        : {}),
    };
    const orderBy = parseSort(query.sort, ['displayName', 'email', 'createdAt', 'lastLoginAt', 'status'] as const, { displayName: 'asc' });
    const page = await paginate(
      query,
      () => db.user.count({ where }),
      (p) => db.user.findMany({ where, orderBy, select: USER_SELECT, ...p }),
    );
    return { ...page, items: page.items.map(shape) };
  }

  async options(query: UserOptionsQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      ...(query.role ? { roles: { some: { role: { key: query.role } } } } : {}),
      ...(query.q ? { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { displayName: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    return paginate(query, () => db.user.count({ where }), (p) => db.user.findMany({
      where, ...p, orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      select: { id: true, displayName: true, email: true, avatarUrl: true, jobTitle: true },
    }));
  }

  async get(id: string) {
    const user = await this.prisma.scoped().user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return shape(user);
  }

  async create(dto: CreateUserDto) {
    const db = this.prisma.scoped();
    const tenantId = this.ctx.tenantId;
    const existing = await db.user.findFirst({ where: { email: { equals: dto.email, mode: 'insensitive' } } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const roleIds = await this.ensureRoles(dto.roles);
    const temporaryPassword = dto.password ? undefined : randomPassword();
    const passwordHash = await hashPassword(dto.password ?? temporaryPassword!);

    const created = await db.user.create({
      data: {
        tenantId,
        email: dto.email,
        displayName: dto.displayName,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        jobTitle: dto.jobTitle ?? null,
        officeLocation: dto.officeLocation ?? null,
        country: dto.country ?? null,
        phone: dto.phone ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        weeklyCapacity: dto.weeklyCapacity ?? 40,
        chargeRate: dto.chargeRate ?? null,
        status: dto.password ? 'ACTIVE' : 'INVITED',
        authProvider: 'LOCAL',
        passwordHash,
        roles: { create: roleIds.map((roleId) => ({ tenantId, roleId })) },
      },
      select: USER_SELECT,
    });
    const user = shape(created);
    await this.audit.record({ action: 'user.created', targetType: 'User', targetId: user.id, after: user });
    return temporaryPassword ? { user, temporaryPassword } : { user };
  }

  async update(id: string, dto: UpdateUserDto) {
    const db = this.prisma.scoped();
    const before = await db.user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT });
    if (!before) throw new NotFoundException('User not found');
    if (dto.status && id === this.ctx.userId && dto.status !== 'ACTIVE') {
      throw new BadRequestException('You cannot suspend or deactivate your own account');
    }
    const after = await db.user.update({
      where: { id },
      data: compact({
        displayName: dto.displayName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        jobTitle: dto.jobTitle,
        officeLocation: dto.officeLocation,
        country: dto.country,
        phone: dto.phone,
        avatarUrl: dto.avatarUrl,
        weeklyCapacity: dto.weeklyCapacity,
        chargeRate: dto.chargeRate,
        status: dto.status,
        ...(dto.status === 'DEACTIVATED' ? { deletedAt: null } : {}),
      }),
      select: USER_SELECT,
    });
    if (dto.status && dto.status !== 'ACTIVE' && dto.status !== 'INVITED') {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    this.userAccess.invalidate(id);
    await this.audit.record({ action: 'user.updated', targetType: 'User', targetId: id, before: shape(before), after: shape(after) });
    return shape(after);
  }

  async setRoles(id: string, dto: SetRolesDto) {
    const db = this.prisma.scoped();
    const tenantId = this.ctx.tenantId;
    const before = await db.user.findFirst({ where: { id, deletedAt: null }, select: USER_SELECT });
    if (!before) throw new NotFoundException('User not found');
    if (id === this.ctx.userId && !dto.roles.includes('GLOBAL_ADMIN') && this.ctx.hasRole('GLOBAL_ADMIN')) {
      throw new BadRequestException('You cannot remove your own administrator role');
    }
    const roleIds = await this.ensureRoles(dto.roles);
    await this.prisma.transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id, entityId: null } });
      await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ tenantId, userId: id, roleId })) });
    });
    this.userAccess.invalidate(id);
    const after = await this.get(id);
    await this.audit.record({
      action: 'user.roles_changed',
      targetType: 'User',
      targetId: id,
      before: { roles: shape(before).roles },
      after: { roles: after.roles },
    });
    return after;
  }

  /** Roles of the tenant with their effective permission keys. */
  async roles() {
    const rows = await this.prisma.scoped().role.findMany({
      include: { permissions: { include: { permission: { select: { key: true } } } } },
      orderBy: { key: 'asc' },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const items = ROLE_KEYS.map((key) => {
      const row = byKey.get(key);
      const permissions = new Set<string>(ROLE_PERMISSIONS[key]);
      for (const rp of row?.permissions ?? []) permissions.add(rp.permission.key);
      return {
        id: row?.id ?? null,
        key,
        name: row?.name ?? ROLE_LABELS[key],
        description: row?.description ?? null,
        isSystem: row?.isSystem ?? true,
        permissions: Array.from(permissions).sort(),
      };
    });
    return { items, permissions: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })) };
  }

  /** Upserts the Role rows for the given keys and returns their ids in order. */
  async ensureRoles(keys: RoleKey[]): Promise<string[]> {
    const tenantId = this.ctx.tenantId;
    const unique = Array.from(new Set(keys));
    const ids: string[] = [];
    for (const key of unique) {
      const role = await this.prisma.role.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: {},
        create: { tenantId, key, name: ROLE_LABELS[key], isSystem: true },
      });
      ids.push(role.id);
    }
    return ids;
  }
}
