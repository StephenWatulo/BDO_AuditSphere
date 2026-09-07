import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { compact, USER_SUMMARY_SELECT } from '../common/utils';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { WorkpapersService } from '../workpapers/workpapers.service';
import { ReorderDto } from '../workpapers/workpapers.dto';
import { CreateProgramDto, CreateStepDto, UpdateStepDto } from './programs.dto';

const STEP_INCLUDE = {
  assignee: { select: USER_SUMMARY_SELECT },
  risk: { select: { id: true, code: true, title: true } },
  control: { select: { id: true, code: true, title: true } },
  workpapers: { where: { deletedAt: null }, select: { id: true, reference: true, title: true, status: true } },
} satisfies Prisma.AuditProgramStepInclude;

const PROGRAM_INCLUDE = {
  approvedBy: { select: USER_SUMMARY_SELECT },
  libraryItem: { select: { id: true, code: true, title: true, version: true } },
  steps: { orderBy: [{ sortOrder: 'asc' }, { reference: 'asc' }], include: STEP_INCLUDE },
} satisfies Prisma.AuditProgramInclude;

export interface LibraryStepInput {
  section: string;
  reference: string;
  objective: string;
  procedure: string;
  estimatedHours: number | null;
  sortOrder: number;
}

/** Flattens the `{ sections: [{ name, steps: [...] }] }` library content shape. */
export function stepsFromLibraryContent(content: unknown): LibraryStepInput[] {
  const sections = (content as { sections?: unknown[] } | null)?.sections;
  if (!Array.isArray(sections)) return [];
  const out: LibraryStepInput[] = [];
  let order = 0;
  sections.forEach((s, si) => {
    const sec = (s ?? {}) as Record<string, unknown>;
    const name = typeof sec.name === 'string' && sec.name.trim() ? sec.name.trim() : `Section ${si + 1}`;
    const steps = Array.isArray(sec.steps) ? sec.steps : [];
    steps.forEach((st, i) => {
      const step = (st ?? {}) as Record<string, unknown>;
      const reference = typeof step.reference === 'string' && step.reference.trim() ? step.reference.trim() : `${si + 1}.${i + 1}`;
      out.push({
        section: name,
        reference,
        objective: typeof step.objective === 'string' ? step.objective : '',
        procedure: typeof step.procedure === 'string' ? step.procedure : '',
        estimatedHours: typeof step.estimatedHours === 'number' ? step.estimatedHours : null,
        sortOrder: order++,
      });
    });
  });
  return out;
}

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly workpapers: WorkpapersService,
    private readonly notifications: NotificationService,
  ) {}

  async listForEngagement(engagementId: string) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: engagementId, deletedAt: null }, select: { id: true } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    const items = await db.auditProgram.findMany({ where: { engagementId }, orderBy: { createdAt: 'asc' }, include: PROGRAM_INCLUDE });
    return { items, total: items.length };
  }

  async create(engagementId: string, dto: CreateProgramDto) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: engagementId, deletedAt: null } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    if (engagement.stage === 'CLOSED') throw new ConflictException('Closed engagements cannot receive programmes');
    const tenantId = this.ctx.tenantId;

    let steps: LibraryStepInput[] = [];
    if (dto.libraryItemId) {
      const item = await db.libraryItem.findFirst({ where: { id: dto.libraryItemId, type: 'AUDIT_PROGRAM', status: { in: ['PUBLISHED', 'DRAFT', 'PENDING_APPROVAL'] } } });
      if (!item) throw new BadRequestException('Library audit programme not found');
      steps = stepsFromLibraryContent(item.content);
      if (steps.length === 0) throw new BadRequestException('Library item has no steps');
      const seen = new Set<string>();
      for (const s of steps) {
        if (seen.has(s.reference)) throw new BadRequestException(`Library item has duplicate step reference ${s.reference}`);
        seen.add(s.reference);
      }
      await db.libraryItem.update({ where: { id: item.id }, data: { usageCount: { increment: 1 } } });
    }

    const created = await db.auditProgram.create({
      data: {
        tenantId,
        engagementId,
        title: dto.title,
        description: dto.description ?? null,
        libraryItemId: dto.libraryItemId ?? null,
        steps: steps.length ? { create: steps.map((s) => ({ tenantId, ...s })) } : undefined,
      },
      include: PROGRAM_INCLUDE,
    });
    await this.audit.record({ action: 'program.created', targetType: 'AuditProgram', targetId: created.id, after: { ...created, steps: created.steps.length } });
    return created;
  }

  async assertProgram(id: string) {
    const p = await this.prisma.scoped().auditProgram.findFirst({ where: { id } });
    if (!p) throw new NotFoundException('Programme not found');
    return p;
  }

  async approve(id: string, userId: string) {
    const program = await this.assertProgram(id);
    if (program.status === 'APPROVED' || program.status === 'IN_PROGRESS' || program.status === 'COMPLETED') {
      throw new ConflictException(`Programme is already ${program.status.toLowerCase()}`);
    }
    const steps = await this.prisma.scoped().auditProgramStep.count({ where: { programId: id } });
    if (steps === 0) throw new BadRequestException('A programme needs at least one step before approval');
    const after = await this.prisma.scoped().auditProgram.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
      include: PROGRAM_INCLUDE,
    });
    await this.audit.record({ action: 'program.approved', targetType: 'AuditProgram', targetId: id, before: { status: program.status }, after: { status: after.status } });
    const engagement = await this.prisma.scoped().engagement.findFirst({ where: { id: program.engagementId }, select: { leadId: true, auditNumber: true } });
    if (engagement?.leadId && engagement.leadId !== userId) {
      await this.notifications.notify(engagement.leadId, {
        type: 'program.approved',
        title: `Programme "${program.title}" approved on ${engagement.auditNumber}`,
        link: `/engagements/${program.engagementId}/programme`,
        payload: { programId: id },
      });
    }
    return after;
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------

  async addStep(programId: string, dto: CreateStepDto) {
    const db = this.prisma.scoped();
    const program = await this.assertProgram(programId);
    if (program.status === 'COMPLETED') throw new ConflictException('Completed programmes cannot be changed');
    const dup = await db.auditProgramStep.findFirst({ where: { programId, reference: dto.reference } });
    if (dup) throw new ConflictException(`Step reference ${dto.reference} already exists in this programme`);
    const sortOrder = dto.sortOrder ?? ((await db.auditProgramStep.aggregate({ where: { programId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
    const created = await db.auditProgramStep.create({
      data: {
        tenantId: this.ctx.tenantId,
        programId,
        section: dto.section,
        reference: dto.reference,
        objective: dto.objective,
        procedure: dto.procedure,
        riskId: dto.riskId ?? null,
        controlId: dto.controlId ?? null,
        assigneeId: dto.assigneeId ?? null,
        estimatedHours: dto.estimatedHours ?? null,
        sortOrder,
      },
      include: STEP_INCLUDE,
    });
    if (program.status === 'APPROVED') await db.auditProgram.update({ where: { id: programId }, data: { status: 'IN_PROGRESS' } });
    await this.audit.record({ action: 'program_step.created', targetType: 'AuditProgramStep', targetId: created.id, after: created });
    await this.notifyAssignee(created.assigneeId, created.reference, created.objective, program.engagementId);
    return created;
  }

  async updateStep(id: string, dto: UpdateStepDto) {
    const db = this.prisma.scoped();
    const before = await db.auditProgramStep.findFirst({ where: { id }, include: { program: { select: { engagementId: true, status: true } } } });
    if (!before) throw new NotFoundException('Programme step not found');
    if (dto.reference && dto.reference !== before.reference) {
      const dup = await db.auditProgramStep.findFirst({ where: { programId: before.programId, reference: dto.reference, id: { not: id } } });
      if (dup) throw new ConflictException(`Step reference ${dto.reference} already exists in this programme`);
    }
    const after = await db.auditProgramStep.update({
      where: { id },
      data: compact({
        section: dto.section,
        reference: dto.reference,
        objective: dto.objective,
        procedure: dto.procedure,
        riskId: dto.riskId,
        controlId: dto.controlId,
        assigneeId: dto.assigneeId,
        estimatedHours: dto.estimatedHours,
        sortOrder: dto.sortOrder,
        status: dto.status,
      }),
      include: STEP_INCLUDE,
    });
    if (dto.status && before.program.status === 'APPROVED' && dto.status !== 'NOT_STARTED') {
      await db.auditProgram.update({ where: { id: before.programId }, data: { status: 'IN_PROGRESS' } });
    }
    await this.audit.record({ action: 'program_step.updated', targetType: 'AuditProgramStep', targetId: id, before, after });
    if (dto.assigneeId && dto.assigneeId !== before.assigneeId) await this.notifyAssignee(dto.assigneeId, after.reference, after.objective, before.program.engagementId);
    return after;
  }

  async deleteStep(id: string) {
    const db = this.prisma.scoped();
    const before = await db.auditProgramStep.findFirst({ where: { id }, include: { _count: { select: { workpapers: true } } } });
    if (!before) throw new NotFoundException('Programme step not found');
    if (before._count.workpapers > 0) throw new ConflictException('Step has linked workpapers; mark it NOT_APPLICABLE instead');
    await db.auditProgramStep.delete({ where: { id } });
    await this.audit.record({ action: 'program_step.deleted', targetType: 'AuditProgramStep', targetId: id, before });
  }

  async reorder(programId: string, dto: ReorderDto) {
    const db = this.prisma.scoped();
    await this.assertProgram(programId);
    const steps = await db.auditProgramStep.findMany({ where: { programId }, select: { id: true } });
    const ids = new Set(steps.map((s) => s.id));
    const unknown = dto.stepIds.filter((id) => !ids.has(id));
    if (unknown.length) throw new BadRequestException('stepIds contains steps not in this programme');
    const ordered = [...dto.stepIds, ...steps.map((s) => s.id).filter((id) => !dto.stepIds.includes(id))];
    await this.prisma.transaction(async (tx) => {
      for (let i = 0; i < ordered.length; i++) await tx.auditProgramStep.update({ where: { id: ordered[i] }, data: { sortOrder: i } });
    });
    await this.audit.record({ action: 'program.reordered', targetType: 'AuditProgram', targetId: programId, metadata: { order: ordered } });
    return db.auditProgram.findFirst({ where: { id: programId }, include: PROGRAM_INCLUDE });
  }

  async createWorkpaperFromStep(stepId: string) {
    const db = this.prisma.scoped();
    const step = await db.auditProgramStep.findFirst({ where: { id: stepId }, include: { program: { select: { engagementId: true } } } });
    if (!step) throw new NotFoundException('Programme step not found');
    const existing = await db.workpaper.findFirst({ where: { programStepId: stepId, deletedAt: null } });
    if (existing) throw new ConflictException(`Workpaper ${existing.reference} is already linked to this step`);
    const taken = await db.workpaper.findFirst({ where: { engagementId: step.program.engagementId, reference: step.reference } });
    const reference = taken ? `${step.reference}-${Date.now().toString(36).slice(-4).toUpperCase()}` : step.reference;
    return this.workpapers.create(step.program.engagementId, {
      reference,
      title: step.objective.length > 200 ? `${step.objective.slice(0, 197)}...` : step.objective,
      objective: step.objective,
      procedure: step.procedure,
      riskId: step.riskId,
      controlId: step.controlId,
      programStepId: step.id,
      sortOrder: step.sortOrder,
    });
  }

  private async notifyAssignee(assigneeId: string | null, reference: string, objective: string, engagementId: string) {
    if (!assigneeId || assigneeId === this.ctx.userId) return;
    await this.notifications.notify(assigneeId, {
      type: 'program_step.assigned',
      title: `Programme step ${reference} assigned to you`,
      body: objective,
      link: `/engagements/${engagementId}/programme`,
      payload: { engagementId },
    });
  }
}
