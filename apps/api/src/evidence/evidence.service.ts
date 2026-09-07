import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Evidence, Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { paginate, parseSort } from '../common/pagination';
import { compact, pad, toDate, USER_SUMMARY_SELECT } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateEvidenceDto, EvidenceListQueryDto, UpdateEvidenceDto } from './evidence.dto';

const EVIDENCE_INCLUDE = {
  document: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, classification: true, uploadedAt: true } },
  workpaper: { select: { id: true, reference: true, title: true, status: true } },
  obtainedBy: { select: USER_SUMMARY_SELECT },
  _count: { select: { findings: true } },
} satisfies Prisma.EvidenceInclude;

/** `E-001` style reference from the highest existing sequence. */
export function nextEvidenceReference(latest: string | null | undefined): string {
  const m = latest ? /^E-(\d+)$/.exec(latest) : null;
  const seq = m ? Number(m[1]) + 1 : 1;
  return `E-${pad(seq, 3)}`;
}

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
  ) {}

  async listForEngagement(engagementId: string, query: EvidenceListQueryDto) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: engagementId, deletedAt: null }, select: { id: true } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    const where: Prisma.EvidenceWhereInput = {
      engagementId,
      ...(query.workpaperId ? { workpaperId: query.workpaperId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { OR: [{ description: { contains: query.q, mode: 'insensitive' } }, { reference: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['reference', 'createdAt', 'obtainedAt', 'type'] as const, { reference: 'asc' });
    return paginate(
      query,
      () => db.evidence.count({ where }),
      (p) => db.evidence.findMany({ where, orderBy, ...p, include: EVIDENCE_INCLUDE }),
    );
  }

  async create(dto: CreateEvidenceDto) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: dto.engagementId, deletedAt: null } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    if (dto.workpaperId) {
      const wp = await db.workpaper.findFirst({ where: { id: dto.workpaperId, engagementId: dto.engagementId, deletedAt: null } });
      if (!wp) throw new BadRequestException('Workpaper not found on this engagement');
      if (wp.isLocked) throw new ConflictException('Workpaper is signed off and locked');
    }
    if (dto.documentId) {
      const doc = await db.document.findFirst({ where: { id: dto.documentId, deletedAt: null } });
      if (!doc) throw new BadRequestException('Document not found');
      if (doc.ownerType === 'AiContext') throw new BadRequestException('Private AI context cannot be linked as shared evidence. Upload the document to the engagement separately.');
    }

    let created: Evidence | undefined;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const latest = await db.evidence.findFirst({ where: { engagementId: dto.engagementId, reference: { startsWith: 'E-' } }, orderBy: { reference: 'desc' }, select: { reference: true } });
      try {
        created = await db.evidence.create({
          data: {
            tenantId: this.ctx.tenantId,
            engagementId: dto.engagementId,
            workpaperId: dto.workpaperId ?? null,
            documentId: dto.documentId ?? null,
            reference: nextEvidenceReference(latest?.reference),
            description: dto.description,
            type: dto.type ?? 'DOCUMENT',
            obtainedFrom: dto.obtainedFrom ?? null,
            obtainedAt: toDate(dto.obtainedAt) ?? null,
            obtainedById: this.ctx.userId,
            isSufficient: dto.isSufficient ?? null,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 4) continue;
        throw err;
      }
    }
    if (!created) throw new ConflictException('Could not allocate an evidence reference');
    if (dto.documentId) {
      await db.document.updateMany({ where: { id: dto.documentId, ownerType: null }, data: { ownerType: 'Evidence', ownerId: created.id } });
    }
    await this.audit.record({ action: 'evidence.created', targetType: 'Evidence', targetId: created.id, after: created });
    return db.evidence.findFirstOrThrow({ where: { id: created.id }, include: EVIDENCE_INCLUDE });
  }

  async update(id: string, dto: UpdateEvidenceDto) {
    const db = this.prisma.scoped();
    const before = await db.evidence.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Evidence not found');
    if (dto.workpaperId) {
      const wp = await db.workpaper.findFirst({ where: { id: dto.workpaperId, engagementId: before.engagementId, deletedAt: null } });
      if (!wp) throw new BadRequestException('Workpaper not found on this engagement');
    }
    if (dto.documentId) {
      const doc = await db.document.findFirst({ where: { id: dto.documentId, deletedAt: null } });
      if (!doc) throw new BadRequestException('Document not found');
      if (doc.ownerType === 'AiContext') throw new BadRequestException('Private AI context cannot be linked as shared evidence. Upload the document to the engagement separately.');
    }
    const after = await db.evidence.update({
      where: { id },
      data: compact({
        workpaperId: dto.workpaperId,
        documentId: dto.documentId,
        description: dto.description,
        type: dto.type,
        obtainedFrom: dto.obtainedFrom,
        obtainedAt: toDate(dto.obtainedAt),
        isSufficient: dto.isSufficient,
      }),
      include: EVIDENCE_INCLUDE,
    });
    await this.audit.record({ action: 'evidence.updated', targetType: 'Evidence', targetId: id, before, after });
    return after;
  }
}
