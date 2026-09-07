import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LibraryItem, Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { paginate, parseSort } from '../common/pagination';
import { compact, json, USER_SUMMARY_SELECT } from '../common/utils';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateLibraryItemDto, LibraryDecisionDto, LibraryListQueryDto, UpdateLibraryItemDto } from './library.dto';

const ITEM_INCLUDE = {
  createdBy: { select: USER_SUMMARY_SELECT },
  approvedBy: { select: USER_SUMMARY_SELECT },
  frameworkRefs: { include: { reference: { include: { framework: { select: { id: true, code: true, name: true } } } } } },
  _count: { select: { programs: true, newerVersions: true } },
} satisfies Prisma.LibraryItemInclude;

function validateContent(type: string, content: Record<string, unknown>) {
  if (type === 'AUDIT_PROGRAM') {
    const sections = content.sections;
    if (!Array.isArray(sections) || sections.length === 0) throw new BadRequestException('AUDIT_PROGRAM content must contain a non-empty sections array');
    for (const s of sections) {
      const steps = (s as { steps?: unknown }).steps;
      if (!Array.isArray(steps)) throw new BadRequestException('Each section must contain a steps array');
    }
  }
}

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly notifications: NotificationService,
  ) {}

  async list(query: LibraryListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.LibraryItemWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : { status: { not: 'RETIRED' } }),
      ...(query.industry ? { industry: { equals: query.industry, mode: 'insensitive' } } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }, { summary: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['title', 'code', 'type', 'status', 'usageCount', 'updatedAt', 'version'] as const, { updatedAt: 'desc' });
    const page = await paginate(
      query,
      () => db.libraryItem.count({ where }),
      (p) => db.libraryItem.findMany({ where, orderBy, ...p, include: { createdBy: { select: USER_SUMMARY_SELECT }, _count: { select: { programs: true } } } }),
    );
    return { ...page, items: page.items.map((i) => ({ ...i, isGlobal: i.tenantId === null })) };
  }

  async get(id: string) {
    const item = await this.prisma.scoped().libraryItem.findFirst({
      where: { id },
      include: { ...ITEM_INCLUDE, parentVersion: { select: { id: true, version: true, status: true } }, newerVersions: { select: { id: true, version: true, status: true }, orderBy: { version: 'asc' } } },
    });
    if (!item) throw new NotFoundException('Library item not found');
    return { ...item, isGlobal: item.tenantId === null };
  }

  private async assertItem(id: string): Promise<LibraryItem> {
    const item = await this.prisma.scoped().libraryItem.findFirst({ where: { id } });
    if (!item) throw new NotFoundException('Library item not found');
    return item;
  }

  private assertTenantOwned(item: LibraryItem) {
    if (item.tenantId === null && !this.ctx.hasRole('GLOBAL_ADMIN')) {
      throw new ForbiddenException('Global BDO content is read-only; edit a published item to create a tenant version');
    }
  }

  private async assertReferences(ids: string[] | undefined) {
    if (!ids?.length) return;
    const count = await this.prisma.frameworkReference.count({ where: { id: { in: ids } } });
    if (count !== new Set(ids).size) throw new BadRequestException('One or more framework references were not found');
  }

  async create(dto: CreateLibraryItemDto) {
    validateContent(dto.type, dto.content);
    await this.assertReferences(dto.frameworkReferenceIds);
    const tenantId = this.ctx.tenantId;
    const dup = await this.prisma.scoped().libraryItem.findFirst({ where: { tenantId, code: dto.code, version: 1 } });
    if (dup) throw new ConflictException(`Library code ${dto.code} already exists`);
    const created = await this.prisma.scoped().libraryItem.create({
      data: {
        tenantId,
        type: dto.type,
        code: dto.code,
        title: dto.title,
        summary: dto.summary ?? null,
        content: json(dto.content),
        industry: dto.industry ?? null,
        tags: dto.tags ?? [],
        createdById: this.ctx.userId,
        frameworkRefs: dto.frameworkReferenceIds?.length ? { create: dto.frameworkReferenceIds.map((referenceId) => ({ referenceId })) } : undefined,
      },
      include: ITEM_INCLUDE,
    });
    await this.audit.record({ action: 'library_item.created', targetType: 'LibraryItem', targetId: created.id, after: { code: created.code, title: created.title, type: created.type } });
    return created;
  }

  /** In-place edit for DRAFT/PENDING; a PUBLISHED item yields a new DRAFT version row. */
  async update(id: string, dto: UpdateLibraryItemDto) {
    const db = this.prisma.scoped();
    const before = await this.assertItem(id);
    if (before.status === 'RETIRED') throw new ConflictException('Retired items cannot be edited');
    const type = dto.type ?? before.type;
    const content = dto.content ?? (before.content as Record<string, unknown>);
    validateContent(type, content);
    await this.assertReferences(dto.frameworkReferenceIds);
    const tenantId = this.ctx.tenantId;

    if (before.status === 'PUBLISHED' || before.tenantId === null) {
      if (before.tenantId !== null) this.assertTenantOwned(before);
      const existingNewer = await db.libraryItem.findFirst({ where: { parentVersionId: id, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } } });
      if (existingNewer) throw new ConflictException(`A newer draft (v${existingNewer.version}) already exists for this item`);
      const latest = await db.libraryItem.findFirst({ where: { tenantId, code: before.code }, orderBy: { version: 'desc' }, select: { version: true } });
      const nextVersion = Math.max(before.version, latest?.version ?? 0) + 1;
      const refs = dto.frameworkReferenceIds ?? (await this.prisma.libraryItemFrameworkRef.findMany({ where: { libraryItemId: id }, select: { referenceId: true } })).map((r) => r.referenceId);
      const created = await db.libraryItem.create({
        data: {
          tenantId,
          type,
          code: before.code,
          title: dto.title ?? before.title,
          summary: dto.summary === undefined ? before.summary : dto.summary,
          content: json(content),
          industry: dto.industry === undefined ? before.industry : dto.industry,
          tags: dto.tags ?? before.tags,
          version: nextVersion,
          parentVersionId: id,
          status: 'DRAFT',
          createdById: this.ctx.userId,
          frameworkRefs: refs.length ? { create: refs.map((referenceId) => ({ referenceId })) } : undefined,
        },
        include: ITEM_INCLUDE,
      });
      await this.audit.record({ action: 'library_item.version_created', targetType: 'LibraryItem', targetId: created.id, before: { id, version: before.version }, after: { version: created.version } });
      return created;
    }

    this.assertTenantOwned(before);
    const after = await this.prisma.transaction(async (tx) => {
      if (dto.frameworkReferenceIds) {
        await tx.libraryItemFrameworkRef.deleteMany({ where: { libraryItemId: id } });
        if (dto.frameworkReferenceIds.length) await tx.libraryItemFrameworkRef.createMany({ data: dto.frameworkReferenceIds.map((referenceId) => ({ libraryItemId: id, referenceId })) });
      }
      return tx.libraryItem.update({
        where: { id },
        data: compact({
          type: dto.type,
          title: dto.title,
          summary: dto.summary,
          content: dto.content === undefined ? undefined : json(dto.content),
          industry: dto.industry,
          tags: dto.tags,
          code: dto.code,
        }),
        include: ITEM_INCLUDE,
      });
    });
    await this.audit.record({ action: 'library_item.updated', targetType: 'LibraryItem', targetId: id, before, after });
    return after;
  }

  async submit(id: string, dto: LibraryDecisionDto) {
    const before = await this.assertItem(id);
    this.assertTenantOwned(before);
    if (before.status !== 'DRAFT') throw new ConflictException(`Only DRAFT items can be submitted (current: ${before.status})`);
    const after = await this.prisma.scoped().libraryItem.update({ where: { id }, data: { status: 'PENDING_APPROVAL' }, include: ITEM_INCLUDE });
    await this.audit.record({ action: 'library_item.submitted', targetType: 'LibraryItem', targetId: id, before: { status: before.status }, after: { status: after.status }, metadata: { comment: dto.comment ?? null } });
    const approvers = await this.prisma.scoped().user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { key: { in: ['CHIEF_AUDIT_EXECUTIVE', 'AUDIT_PARTNER'] } } } } },
      select: { id: true },
      take: 20,
    });
    await this.notifications.notifyMany(approvers.map((a) => a.id).filter((a) => a !== this.ctx.userId), {
      type: 'library_item.pending_approval',
      title: `Library item ${after.code} v${after.version} awaits approval`,
      body: dto.comment,
      link: `/library/${id}`,
      payload: { libraryItemId: id },
    });
    return after;
  }

  async approve(id: string, dto: LibraryDecisionDto, user: AuthUser) {
    const before = await this.assertItem(id);
    this.assertTenantOwned(before);
    if (before.status !== 'PENDING_APPROVAL') throw new ConflictException(`Only PENDING_APPROVAL items can be approved (current: ${before.status})`);
    const after = await this.prisma.transaction(async (tx) => {
      // Retire the previously published version of the same code in this tenant.
      await tx.libraryItem.updateMany({ where: { code: before.code, status: 'PUBLISHED', id: { not: id }, tenantId: before.tenantId }, data: { status: 'RETIRED' } });
      return tx.libraryItem.update({ where: { id }, data: { status: 'PUBLISHED', approvedById: user.id, approvedAt: new Date() }, include: ITEM_INCLUDE });
    });
    await this.audit.record({ action: 'library_item.approved', targetType: 'LibraryItem', targetId: id, before: { status: before.status }, after: { status: after.status }, metadata: { comment: dto.comment ?? null } });
    if (before.createdById !== user.id) {
      await this.notifications.notify(before.createdById, { type: 'library_item.approved', title: `Library item ${after.code} v${after.version} published`, body: dto.comment, link: `/library/${id}`, payload: { libraryItemId: id } });
    }
    return after;
  }

  async retire(id: string, dto: LibraryDecisionDto) {
    const before = await this.assertItem(id);
    this.assertTenantOwned(before);
    if (before.status === 'RETIRED') throw new ConflictException('Item is already retired');
    const after = await this.prisma.scoped().libraryItem.update({ where: { id }, data: { status: 'RETIRED' }, include: ITEM_INCLUDE });
    await this.audit.record({ action: 'library_item.retired', targetType: 'LibraryItem', targetId: id, before: { status: before.status }, after: { status: after.status }, metadata: { comment: dto.comment ?? null } });
    return after;
  }

  async frameworks() {
    const items = await this.prisma.framework.findMany({
      orderBy: { code: 'asc' },
      include: { references: { orderBy: { refCode: 'asc' }, select: { id: true, refCode: true, title: true, description: true, parentId: true } } },
    });
    return { items, total: items.length };
  }
}
