import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewLevel, Workpaper, WorkpaperStatus } from '@auditsphere/db';
import { WORKPAPER_WORKFLOW } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { TransitionDto } from '../common/dto/transition.dto';
import { toSerializable } from '../common/serialize.interceptor';
import { compact, isBlank, json, USER_SUMMARY_SELECT } from '../common/utils';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { GuardContext, GuardRegistry } from '../workflow/guard-registry';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateReviewNoteDto, CreateWorkpaperDto, CreateWorkpaperTemplateDto, UpdateReviewNoteDto, UpdateWorkpaperDto } from './workpapers.dto';

const LIST_INCLUDE = {
  preparedBy: { select: USER_SUMMARY_SELECT },
  reviewedBy: { select: USER_SUMMARY_SELECT },
  signedOffBy: { select: USER_SUMMARY_SELECT },
  programStep: { select: { id: true, reference: true, section: true, status: true } },
  _count: { select: { reviewNotes: { where: { status: { in: ['OPEN', 'ADDRESSED'] } } }, evidence: true, findings: true } },
} satisfies Prisma.WorkpaperInclude;

const CONTENT_FIELDS = ['reference', 'title', 'objective', 'procedure', 'testPerformed', 'results', 'exceptions', 'conclusion', 'content', 'riskId', 'controlId', 'sortOrder'] as const;

/** Builds an empty `content` document from a template structure. */
export function contentFromTemplate(structure: unknown): Record<string, unknown> {
  const sections = (structure as { sections?: unknown[] } | null)?.sections;
  if (!Array.isArray(sections)) return {};
  return {
    sections: sections.map((s, i) => {
      const sec = (s ?? {}) as Record<string, unknown>;
      return {
        key: typeof sec.key === 'string' ? sec.key : `section_${i + 1}`,
        title: typeof sec.title === 'string' ? sec.title : typeof sec.name === 'string' ? sec.name : `Section ${i + 1}`,
        prompt: typeof sec.prompt === 'string' ? sec.prompt : null,
        required: Boolean(sec.required),
        value: '',
      };
    }),
  };
}

type WpGuardCtx = GuardContext<Workpaper>;

@Injectable()
export class WorkpapersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly workflow: WorkflowService,
    private readonly notifications: NotificationService,
    registry: GuardRegistry,
  ) {
    const m = WORKPAPER_WORKFLOW.name;
    registry.register<Workpaper>(m, 'has_procedure_and_conclusion', ({ entity }: WpGuardCtx) => ({
      ok: !isBlank(entity.procedure) && !isBlank(entity.conclusion),
      message: 'Procedure and conclusion must be documented',
    }));
    registry.register<Workpaper>(m, 'reviewer_is_not_preparer', ({ entity, actor }: WpGuardCtx) => ({
      ok: !entity.preparedById || entity.preparedById !== actor.userId,
      message: 'The preparer cannot review their own workpaper',
    }));
    registry.register<Workpaper>(m, 'signer_is_not_preparer', ({ entity, actor }: WpGuardCtx) => ({
      ok: !entity.preparedById || entity.preparedById !== actor.userId,
      message: 'The preparer cannot sign off their own workpaper',
    }));
    registry.register<Workpaper>(m, 'all_notes_addressed', async ({ entity }: WpGuardCtx) => {
      const open = await this.prisma.scoped().reviewNote.count({ where: { workpaperId: entity.id, status: 'OPEN' } });
      return { ok: open === 0, message: `${open} review note(s) not yet addressed` };
    });
    registry.register<Workpaper>(m, 'no_open_review_notes', async ({ entity }: WpGuardCtx) => {
      const open = await this.prisma.scoped().reviewNote.count({ where: { workpaperId: entity.id, status: { in: ['OPEN', 'ADDRESSED'] } } });
      return { ok: open === 0, message: `${open} review note(s) not yet cleared` };
    });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async listForEngagement(engagementId: string) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: engagementId, deletedAt: null }, select: { id: true } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    const items = await db.workpaper.findMany({
      where: { engagementId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { reference: 'asc' }],
      include: LIST_INCLUDE,
    });
    return {
      items: items.map(({ _count, ...w }) => ({ ...w, openReviewNotes: _count.reviewNotes, evidenceCount: _count.evidence, findingsCount: _count.findings })),
      total: items.length,
    };
  }

  async get(id: string, user: AuthUser) {
    const wp = await this.prisma.scoped().workpaper.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...LIST_INCLUDE,
        engagement: { select: { id: true, auditNumber: true, title: true, stage: true } },
        template: { select: { id: true, name: true, structure: true } },
        risk: { select: { id: true, code: true, title: true } },
        control: { select: { id: true, code: true, title: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: { id: true, versionNumber: true, changeSummary: true, createdAt: true, changedBy: { select: USER_SUMMARY_SELECT } },
        },
        reviewNotes: {
          orderBy: { createdAt: 'desc' },
          include: { raisedBy: { select: USER_SUMMARY_SELECT }, assignedTo: { select: USER_SUMMARY_SELECT }, clearedBy: { select: USER_SUMMARY_SELECT } },
        },
        evidence: { orderBy: { reference: 'asc' }, include: { document: true, obtainedBy: { select: USER_SUMMARY_SELECT } } },
        findings: { where: { deletedAt: null }, select: { id: true, reference: true, title: true, severity: true, status: true } },
      },
    });
    if (!wp) throw new NotFoundException('Workpaper not found');
    const availableActions = await this.workflow.availableActions(WORKPAPER_WORKFLOW, wp.status, { userId: user.id, permissions: user.permissions }, wp);
    const { _count, ...rest } = wp;
    return { ...rest, openReviewNotes: _count.reviewNotes, availableActions };
  }

  async getVersion(id: string, versionNumber: number) {
    const db = this.prisma.scoped();
    const wp = await db.workpaper.findFirst({ where: { id, deletedAt: null }, select: { id: true, currentVersion: true } });
    if (!wp) throw new NotFoundException('Workpaper not found');
    const version = await db.workpaperVersion.findFirst({
      where: { workpaperId: id, versionNumber },
      include: { changedBy: { select: USER_SUMMARY_SELECT } },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async assertWorkpaper(id: string) {
    const wp = await this.prisma.scoped().workpaper.findFirst({ where: { id, deletedAt: null } });
    if (!wp) throw new NotFoundException('Workpaper not found');
    return wp;
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async create(engagementId: string, dto: CreateWorkpaperDto) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: engagementId, deletedAt: null } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    if (engagement.stage === 'CLOSED') throw new ConflictException('Closed engagements cannot receive new workpapers');

    let content: Record<string, unknown> = {};
    if (dto.templateId) {
      const template = await db.workpaperTemplate.findFirst({ where: { id: dto.templateId, isActive: true } });
      if (!template) throw new BadRequestException('Template not found');
      content = contentFromTemplate(template.structure);
    }
    if (dto.programStepId) {
      const step = await db.auditProgramStep.findFirst({ where: { id: dto.programStepId, program: { engagementId } } });
      if (!step) throw new BadRequestException('Programme step not found on this engagement');
    }
    const duplicate = await db.workpaper.findFirst({ where: { engagementId, reference: dto.reference }, select: { id: true } });
    if (duplicate) throw new ConflictException(`Workpaper reference ${dto.reference} already exists on this engagement`);

    const created = await db.workpaper.create({
      data: {
        tenantId: this.ctx.tenantId,
        engagementId,
        programStepId: dto.programStepId ?? null,
        templateId: dto.templateId ?? null,
        reference: dto.reference,
        title: dto.title,
        objective: dto.objective ?? null,
        procedure: dto.procedure ?? null,
        riskId: dto.riskId ?? null,
        controlId: dto.controlId ?? null,
        content: json(content),
        sortOrder: dto.sortOrder ?? 0,
        preparedById: this.ctx.userId,
      },
      include: LIST_INCLUDE,
    });
    if (dto.programStepId) {
      await db.auditProgramStep.updateMany({ where: { id: dto.programStepId, status: 'NOT_STARTED' }, data: { status: 'IN_PROGRESS' } });
    }
    await this.audit.record({ action: 'workpaper.created', targetType: 'Workpaper', targetId: created.id, after: created });
    return created;
  }

  /** Every PATCH snapshots the previous state as a WorkpaperVersion. */
  async update(id: string, dto: UpdateWorkpaperDto) {
    const before = await this.assertWorkpaper(id);
    if (before.isLocked) throw new ConflictException('Workpaper is signed off and locked; unlock it first');
    if (before.status === 'IN_REVIEW' && !this.ctx.hasPermission('workpaper:review')) {
      throw new ConflictException('Workpaper is in review; it can be edited once notes are raised or it is reopened');
    }
    const changed = CONTENT_FIELDS.filter((f) => dto[f] !== undefined);
    if (changed.length === 0) throw new BadRequestException('No content fields supplied');
    if (dto.reference && dto.reference !== before.reference) {
      const dup = await this.prisma.scoped().workpaper.findFirst({ where: { engagementId: before.engagementId, reference: dto.reference, id: { not: id } } });
      if (dup) throw new ConflictException(`Workpaper reference ${dto.reference} already exists on this engagement`);
    }

    const snapshot = toSerializable(before) as Prisma.InputJsonValue;
    const after = await this.prisma.transaction(async (tx) => {
      await tx.workpaperVersion.create({
        data: {
          tenantId: this.ctx.tenantId,
          workpaperId: id,
          versionNumber: before.currentVersion,
          snapshot,
          changeSummary: dto.changeSummary ?? `Updated ${changed.join(', ')}`,
          changedById: this.ctx.userId,
        },
      });
      return tx.workpaper.update({
        where: { id },
        data: {
          ...compact({
            reference: dto.reference,
            title: dto.title,
            objective: dto.objective,
            procedure: dto.procedure,
            testPerformed: dto.testPerformed,
            results: dto.results,
            exceptions: dto.exceptions,
            conclusion: dto.conclusion,
            content: dto.content === undefined ? undefined : json(dto.content),
            riskId: dto.riskId,
            controlId: dto.controlId,
            sortOrder: dto.sortOrder,
          }),
          currentVersion: { increment: 1 },
          preparedById: before.preparedById ?? this.ctx.userId,
        },
        include: LIST_INCLUDE,
      });
    });
    await this.audit.record({ action: 'workpaper.updated', targetType: 'Workpaper', targetId: id, before, after, metadata: { fields: changed } });
    return after;
  }

  async transition(id: string, dto: TransitionDto, user: AuthUser) {
    const wp = await this.assertWorkpaper(id);
    const transition = await this.workflow.transition({
      machine: WORKPAPER_WORKFLOW,
      entityType: 'Workpaper',
      current: wp.status,
      action: dto.action,
      actor: { userId: user.id, permissions: user.permissions },
      guardContext: wp,
      comment: dto.comment,
    });

    const now = new Date();
    const tenantId = this.ctx.tenantId;
    const data: Prisma.WorkpaperUncheckedUpdateInput = { status: transition.to as WorkpaperStatus };
    let review: { level: ReviewLevel; decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' } | null = null;
    switch (transition.action) {
      case 'mark_prepared':
        data.preparedById = wp.preparedById ?? user.id;
        data.preparedAt = now;
        break;
      case 'reopen':
        data.preparedAt = null;
        break;
      case 'start_review':
        data.reviewedById = user.id;
        data.reviewedAt = null;
        break;
      case 'raise_notes':
        review = { level: 'FIRST', decision: 'CHANGES_REQUESTED' };
        break;
      case 'approve_review':
        data.reviewedById = user.id;
        data.reviewedAt = now;
        review = { level: 'FIRST', decision: 'APPROVED' };
        break;
      case 'sign_off':
        data.signedOffById = user.id;
        data.signedOffAt = now;
        data.isLocked = true;
        review = { level: user.roles.includes('AUDIT_PARTNER') ? 'PARTNER' : 'SECOND', decision: 'APPROVED' };
        break;
      case 'unlock':
        data.isLocked = false;
        data.signedOffById = null;
        data.signedOffAt = null;
        data.reviewedAt = null;
        data.preparedAt = null;
        break;
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const w = await tx.workpaper.update({ where: { id }, data, include: LIST_INCLUDE });
      if (review) {
        await tx.review.create({
          data: { tenantId, targetType: 'Workpaper', targetId: id, level: review.level, reviewerId: user.id, decision: review.decision, comment: dto.comment ?? null },
        });
      }
      if (wp.programStepId) {
        if (transition.action === 'sign_off') await tx.auditProgramStep.update({ where: { id: wp.programStepId }, data: { status: 'COMPLETED' } });
        if (transition.action === 'unlock') await tx.auditProgramStep.update({ where: { id: wp.programStepId }, data: { status: 'IN_PROGRESS' } });
      }
      return w;
    });

    await this.audit.record({
      action: transition.action === 'sign_off' ? 'workpaper.signed_off' : transition.action === 'unlock' ? 'workpaper.unlocked' : 'workpaper.status_changed',
      targetType: 'Workpaper',
      targetId: id,
      before: { status: wp.status, isLocked: wp.isLocked },
      after: { status: updated.status, isLocked: updated.isLocked },
      metadata: { action: transition.action, comment: dto.comment ?? null },
    });

    const recipients = new Set<string | null>();
    if (['start_review', 'raise_notes', 'approve_review', 'sign_off', 'unlock'].includes(transition.action)) recipients.add(wp.preparedById);
    if (['mark_prepared', 'address_notes'].includes(transition.action)) {
      recipients.add(wp.reviewedById);
      const eng = await this.prisma.scoped().engagement.findFirst({ where: { id: wp.engagementId }, select: { managerId: true, leadId: true } });
      recipients.add(eng?.managerId ?? eng?.leadId ?? null);
    }
    recipients.delete(user.id);
    await this.notifications.notifyMany(Array.from(recipients), {
      type: 'workpaper.status_changed',
      title: `Workpaper ${wp.reference} ${wp.title}: ${transition.label.toLowerCase()}`,
      body: dto.comment,
      link: `/engagements/${wp.engagementId}/workpapers/${id}`,
      payload: { workpaperId: id, engagementId: wp.engagementId, action: transition.action },
    });
    return this.get(id, user);
  }

  // ---------------------------------------------------------------------------
  // Review notes
  // ---------------------------------------------------------------------------

  async createReviewNote(workpaperId: string, dto: CreateReviewNoteDto) {
    const wp = await this.assertWorkpaper(workpaperId);
    const note = await this.prisma.scoped().reviewNote.create({
      data: {
        tenantId: this.ctx.tenantId,
        workpaperId,
        text: dto.text,
        priority: dto.priority ?? 'NORMAL',
        raisedById: this.ctx.userId,
        assignedToId: dto.assignedToId ?? wp.preparedById ?? null,
      },
      include: { raisedBy: { select: USER_SUMMARY_SELECT }, assignedTo: { select: USER_SUMMARY_SELECT } },
    });
    await this.audit.record({ action: 'review_note.created', targetType: 'ReviewNote', targetId: note.id, after: note, metadata: { workpaperId } });
    if (note.assignedToId && note.assignedToId !== this.ctx.userId) {
      await this.notifications.notify(note.assignedToId, {
        type: 'review_note.raised',
        title: `Review note on ${wp.reference} ${wp.title}`,
        body: dto.text,
        link: `/engagements/${wp.engagementId}/workpapers/${workpaperId}`,
        payload: { workpaperId, reviewNoteId: note.id },
      });
    }
    return note;
  }

  async updateReviewNote(id: string, dto: UpdateReviewNoteDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await db.reviewNote.findFirst({ where: { id }, include: { workpaper: { select: { id: true, engagementId: true, reference: true, title: true, preparedById: true } } } });
    if (!before) throw new NotFoundException('Review note not found');
    const canReview = before.raisedById === user.id || user.permissions.includes('workpaper:review');
    const now = new Date();
    let data: Prisma.ReviewNoteUncheckedUpdateInput;
    let action: string;

    if (dto.clear) {
      if (!canReview) throw new ForbiddenException('Only the raiser or a reviewer can clear a note');
      if (before.status === 'CLEARED') throw new ConflictException('Note is already cleared');
      data = { status: 'CLEARED', clearedById: user.id, clearedAt: now };
      action = 'review_note.cleared';
    } else if (dto.reopen) {
      if (!canReview) throw new ForbiddenException('Only the raiser or a reviewer can reopen a note');
      if (before.status === 'OPEN') throw new ConflictException('Note is already open');
      data = { status: 'OPEN', clearedById: null, clearedAt: null };
      action = 'review_note.reopened';
    } else if (dto.response !== undefined) {
      const canRespond = canReview || before.assignedToId === user.id || before.workpaper.preparedById === user.id || user.permissions.includes('workpaper:prepare');
      if (!canRespond) throw new ForbiddenException('You cannot respond to this note');
      if (before.status === 'CLEARED') throw new ConflictException('Cleared notes cannot be responded to');
      data = { response: dto.response, respondedAt: now, status: 'ADDRESSED' };
      action = 'review_note.addressed';
    } else {
      throw new BadRequestException('Provide response, clear or reopen');
    }

    const after = await db.reviewNote.update({
      where: { id },
      data,
      include: { raisedBy: { select: USER_SUMMARY_SELECT }, assignedTo: { select: USER_SUMMARY_SELECT }, clearedBy: { select: USER_SUMMARY_SELECT } },
    });
    await this.audit.record({ action, targetType: 'ReviewNote', targetId: id, before, after });
    const recipient = action === 'review_note.addressed' ? before.raisedById : before.assignedToId;
    if (recipient && recipient !== user.id) {
      await this.notifications.notify(recipient, {
        type: action,
        title: `Review note on ${before.workpaper.reference} ${action.split('.')[1]}`,
        body: dto.response,
        link: `/engagements/${before.workpaper.engagementId}/workpapers/${before.workpaper.id}`,
        payload: { workpaperId: before.workpaper.id, reviewNoteId: id },
      });
    }
    return after;
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  async listTemplates() {
    const items = await this.prisma.scoped().workpaperTemplate.findMany({ where: { isActive: true }, orderBy: [{ tenantId: 'desc' }, { name: 'asc' }] });
    return { items: items.map((t) => ({ ...t, isGlobal: t.tenantId === null })), total: items.length };
  }

  async createTemplate(dto: CreateWorkpaperTemplateDto) {
    const created = await this.prisma.scoped().workpaperTemplate.create({
      data: {
        tenantId: this.ctx.tenantId,
        name: dto.name,
        category: dto.category ?? null,
        description: dto.description ?? null,
        structure: json(dto.structure),
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.record({ action: 'workpaper_template.created', targetType: 'WorkpaperTemplate', targetId: created.id, after: created });
    return created;
  }
}
