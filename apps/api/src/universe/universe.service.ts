import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEntity, Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { paginate, parseSort } from '../common/pagination';
import { addMonths, compact, json, toDate, USER_SUMMARY_SELECT } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import {
  CreateEntityDto,
  CreateProcessDto,
  EntityListQueryDto,
  ProcessListQueryDto,
  UpdateEntityDto,
  UpdateProcessDto,
} from './universe.dto';

export interface EntityNode extends AuditEntity {
  children: EntityNode[];
}

/** Pure tree builder; roots are nodes whose parent is absent from the set. */
export function buildEntityTree(rows: AuditEntity[]): EntityNode[] {
  const byId = new Map<string, EntityNode>();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });
  const roots: EntityNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: EntityNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

const OPEN_FINDING_STATUSES = ['DRAFT', 'MANAGEMENT_REVIEW', 'AGREED', 'IMPLEMENTATION', 'VALIDATION'] as const;

@Injectable()
export class UniverseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
  ) {}

  private entityWhere(query: EntityListQueryDto): Prisma.AuditEntityWhereInput {
    return {
      deletedAt: null,
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.country ? { country: { equals: query.country, mode: 'insensitive' } } : {}),
      ...(query.riskRating ? { riskRating: query.riskRating } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
  }

  async listEntities(query: EntityListQueryDto) {
    const db = this.prisma.scoped();
    const where = this.entityWhere(query);
    if (query.flat) {
      const orderBy = parseSort(query.sort, ['name', 'code', 'type', 'riskRating', 'lastAuditDate', 'nextAuditDue'] as const, { name: 'asc' });
      return paginate(
        query,
        () => db.auditEntity.count({ where }),
        (p) => db.auditEntity.findMany({ where, orderBy, ...p, include: { owner: { select: USER_SUMMARY_SELECT }, _count: { select: { processes: true, risks: true } } } }),
      );
    }
    const rows = await db.auditEntity.findMany({ where, orderBy: { name: 'asc' } });
    return { items: buildEntityTree(rows), total: rows.length };
  }

  async getEntity(id: string) {
    const db = this.prisma.scoped();
    const entity = await db.auditEntity.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: USER_SUMMARY_SELECT },
        parent: { select: { id: true, name: true, code: true, type: true } },
        children: { where: { deletedAt: null }, select: { id: true, name: true, code: true, type: true, riskRating: true } },
        processes: { where: { deletedAt: null }, orderBy: { name: 'asc' }, include: { owner: { select: USER_SUMMARY_SELECT } } },
        risks: {
          where: { deletedAt: null },
          orderBy: { residualScore: 'desc' },
          select: { id: true, code: true, title: true, rating: true, residualScore: true, inherentScore: true, status: true },
        },
        engagements: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, auditNumber: true, title: true, stage: true, status: true, opinion: true, plannedStart: true, plannedEnd: true },
        },
      },
    });
    if (!entity) throw new NotFoundException('Entity not found');
    const openFindingsCount = await db.finding.count({
      where: { entityId: id, deletedAt: null, status: { in: [...OPEN_FINDING_STATUSES] } },
    });
    return { ...entity, openFindingsCount };
  }

  async createEntity(dto: CreateEntityDto) {
    const db = this.prisma.scoped();
    if (dto.parentId) await this.assertEntity(dto.parentId);
    const lastAuditDate = toDate(dto.lastAuditDate) ?? null;
    const nextAuditDue =
      toDate(dto.nextAuditDue) ?? (lastAuditDate && dto.auditFrequencyMonths ? addMonths(lastAuditDate, dto.auditFrequencyMonths) : null);
    const created = await db.auditEntity.create({
      data: {
        tenantId: this.ctx.tenantId,
        parentId: dto.parentId ?? null,
        type: dto.type,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        ownerId: dto.ownerId ?? null,
        country: dto.country ?? null,
        strategicObjectives: dto.strategicObjectives ?? [],
        regulatoryRequirements: json(dto.regulatoryRequirements ?? []),
        riskRating: dto.riskRating ?? 'MEDIUM',
        lastAuditDate,
        nextAuditDue,
        auditFrequencyMonths: dto.auditFrequencyMonths ?? null,
        metadata: json(dto.metadata ?? {}),
      },
    });
    await this.audit.record({ action: 'entity.created', targetType: 'AuditEntity', targetId: created.id, after: created });
    return created;
  }

  async updateEntity(id: string, dto: UpdateEntityDto) {
    const db = this.prisma.scoped();
    const before = await this.assertEntity(id);
    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('An entity cannot be its own parent');
      await this.assertEntity(dto.parentId);
      if (await this.isDescendant(dto.parentId, id)) throw new BadRequestException('Cannot move an entity under its own descendant');
    }
    const after = await db.auditEntity.update({
      where: { id },
      data: compact({
        parentId: dto.parentId,
        type: dto.type,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        ownerId: dto.ownerId,
        country: dto.country,
        strategicObjectives: dto.strategicObjectives,
        regulatoryRequirements: dto.regulatoryRequirements === undefined ? undefined : json(dto.regulatoryRequirements),
        riskRating: dto.riskRating,
        lastAuditDate: toDate(dto.lastAuditDate),
        nextAuditDue: toDate(dto.nextAuditDue),
        auditFrequencyMonths: dto.auditFrequencyMonths,
        metadata: dto.metadata === undefined ? undefined : json(dto.metadata),
        isActive: dto.isActive,
      }),
    });
    await this.audit.record({ action: 'entity.updated', targetType: 'AuditEntity', targetId: id, before, after });
    return after;
  }

  async deleteEntity(id: string) {
    const db = this.prisma.scoped();
    const before = await this.assertEntity(id);
    const children = await db.auditEntity.count({ where: { parentId: id, deletedAt: null } });
    if (children > 0) throw new BadRequestException('Delete or move child entities first');
    await db.auditEntity.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit.record({ action: 'entity.deleted', targetType: 'AuditEntity', targetId: id, before });
  }

  private async isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
    const db = this.prisma.scoped();
    let current: string | null = candidateId;
    for (let i = 0; i < 64 && current; i++) {
      const row: { parentId: string | null } | null = await db.auditEntity.findFirst({ where: { id: current }, select: { parentId: true } });
      if (!row) return false;
      if (row.parentId === ancestorId) return true;
      current = row.parentId;
    }
    return false;
  }

  async assertEntity(id: string) {
    const e = await this.prisma.scoped().auditEntity.findFirst({ where: { id, deletedAt: null } });
    if (!e) throw new NotFoundException('Entity not found');
    return e;
  }

  // ---------------------------------------------------------------------------
  // Processes
  // ---------------------------------------------------------------------------

  async listProcesses(query: ProcessListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.ProcessWhereInput = {
      deletedAt: null,
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.isKey !== undefined ? { isKey: query.isKey } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['name', 'code', 'category', 'createdAt'] as const, { name: 'asc' });
    return paginate(
      query,
      () => db.process.count({ where }),
      (p) =>
        db.process.findMany({
          where,
          orderBy,
          ...p,
          include: { owner: { select: USER_SUMMARY_SELECT }, entity: { select: { id: true, name: true, code: true } }, _count: { select: { risks: true, controls: true } } },
        }),
    );
  }

  async createProcess(dto: CreateProcessDto) {
    await this.assertEntity(dto.entityId);
    const created = await this.prisma.scoped().process.create({
      data: {
        tenantId: this.ctx.tenantId,
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        ownerId: dto.ownerId ?? null,
        category: dto.category ?? null,
        isKey: dto.isKey ?? false,
      },
    });
    await this.audit.record({ action: 'process.created', targetType: 'Process', targetId: created.id, after: created });
    return created;
  }

  async updateProcess(id: string, dto: UpdateProcessDto) {
    const db = this.prisma.scoped();
    const before = await db.process.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Process not found');
    if (dto.entityId) await this.assertEntity(dto.entityId);
    const after = await db.process.update({
      where: { id },
      data: compact({
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        ownerId: dto.ownerId,
        category: dto.category,
        isKey: dto.isKey,
      }),
    });
    await this.audit.record({ action: 'process.updated', targetType: 'Process', targetId: id, before, after });
    return after;
  }

  // ---------------------------------------------------------------------------
  // Coverage
  // ---------------------------------------------------------------------------

  async coverage() {
    const db = this.prisma.scoped();
    const now = new Date();
    const m12 = addMonths(now, -12);
    const m36 = addMonths(now, -36);
    const base: Prisma.AuditEntityWhereInput = { deletedAt: null, isActive: true };
    const auditedSince = (since: Date): Prisma.AuditEntityWhereInput => ({
      ...base,
      OR: [{ lastAuditDate: { gte: since } }, { engagements: { some: { deletedAt: null, reportIssuedAt: { gte: since } } } }],
    });
    const never: Prisma.AuditEntityWhereInput = {
      ...base,
      lastAuditDate: null,
      engagements: { none: { deletedAt: null, reportIssuedAt: { not: null } } },
    };

    const [total, auditedLast12Months, auditedLast36Months, neverAudited, totalsByType, coveredByType] = await Promise.all([
      db.auditEntity.count({ where: base }),
      db.auditEntity.count({ where: auditedSince(m12) }),
      db.auditEntity.count({ where: auditedSince(m36) }),
      db.auditEntity.count({ where: never }),
      db.auditEntity.groupBy({ by: ['type'], where: base, _count: { _all: true } }),
      db.auditEntity.groupBy({ by: ['type'], where: auditedSince(m36), _count: { _all: true } }),
    ]);
    const covered = new Map(coveredByType.map((r) => [r.type, r._count._all]));
    return {
      total,
      auditedLast12Months,
      auditedLast36Months,
      neverAudited,
      byType: totalsByType.map((r) => ({ type: r.type, total: r._count._all, covered: covered.get(r.type) ?? 0 })),
    };
  }
}
