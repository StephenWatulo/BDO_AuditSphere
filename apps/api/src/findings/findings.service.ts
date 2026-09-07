import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Finding, FindingStatus, Prisma } from '@auditsphere/db';
import { AGEING_BUCKETS, ageingBucket, daysOverdue, FINDING_WORKFLOW } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { TransitionDto } from '../common/dto/transition.dto';
import { paginate, parseSort } from '../common/pagination';
import { compact, isBlank, pad, toDate, USER_SUMMARY_SELECT } from '../common/utils';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { GuardContext, GuardRegistry } from '../workflow/guard-registry';
import { WorkflowService } from '../workflow/workflow.service';
import { BUSINESS_OWNER_FIELDS, CreateFindingDto, CreateRecommendationDto, ExtendFindingDto, FindingListQueryDto, UpdateFindingDto, UpdateRecommendationDto } from './findings.dto';

export const OPEN_STATUSES: FindingStatus[] = ['DRAFT', 'MANAGEMENT_REVIEW', 'AGREED', 'IMPLEMENTATION', 'VALIDATION'];
export const ACTIONABLE_STATUSES: FindingStatus[] = ['AGREED', 'IMPLEMENTATION', 'VALIDATION'];
export const VALIDATOR_GUARD = 'validator_is_not_action_owner';

const LIST_INCLUDE = {
  engagement: { select: { id: true, auditNumber: true, title: true, stage: true } },
  entity: { select: { id: true, name: true, code: true } },
  actionOwner: { select: USER_SUMMARY_SELECT },
  raisedBy: { select: USER_SUMMARY_SELECT },
  _count: { select: { recommendations: true, evidence: true } },
} satisfies Prisma.FindingInclude;

/** `mine=true` matches by action owner id, and by action owner email when the actor's email is known. */
export type ListActor = string | { id: string; email?: string | null };

/** Pure where-clause builder for GET /findings (unit tested). */
export function buildFindingsWhere(query: FindingListQueryDto, actor: ListActor, now = new Date()): Prisma.FindingWhereInput {
  const where: Prisma.FindingWhereInput = { deletedAt: null };
  const me = typeof actor === 'string' ? { id: actor } : actor;
  if (query.engagementId) where.engagementId = query.engagementId;
  if (query.entityId) where.entityId = query.entityId;
  if (query.status) where.status = query.status;
  if (query.severity) where.severity = query.severity;
  if (query.actionOwnerId) where.actionOwnerId = query.actionOwnerId;
  if (query.isRepeat !== undefined) where.isRepeat = query.isRepeat;
  if (query.mine) {
    // A finding may name the action owner by email before they are picked as a platform
    // user, so a provisioned business owner also sees findings addressed to their email.
    if (me.email) {
      delete where.actionOwnerId;
      where.AND = [{ OR: [{ actionOwnerId: me.id }, { actionOwnerEmail: { equals: me.email, mode: 'insensitive' } }] }];
    } else {
      where.actionOwnerId = me.id;
    }
  }
  if (query.overdue) {
    where.dueDate = { lt: now };
    where.status = query.status ? query.status : { in: ACTIONABLE_STATUSES };
  }
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { reference: { contains: query.q, mode: 'insensitive' } },
      { condition: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return where;
}

/** `F-01`, `F-02`, ... from the highest existing reference. */
export function nextFindingReference(latest: string | null | undefined): string {
  const m = latest ? /^F-(\d+)$/.exec(latest) : null;
  const seq = m ? Number(m[1]) + 1 : 1;
  return `F-${pad(seq, 2)}`;
}

export function withAgeing<T extends { dueDate: Date | null; status: FindingStatus }>(f: T, now = new Date()) {
  const active = ACTIONABLE_STATUSES.includes(f.status);
  return {
    ...f,
    ageingBucket: active ? ageingBucket(f.dueDate, now) : 'NOT_DUE',
    daysOverdue: active ? daysOverdue(f.dueDate, now) : 0,
    isOverdue: active && daysOverdue(f.dueDate, now) > 0,
  };
}

type FGuardCtx = GuardContext<Finding>;

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly workflow: WorkflowService,
    private readonly notifications: NotificationService,
    registry: GuardRegistry,
  ) {
    const m = FINDING_WORKFLOW.name;
    registry.register<Finding>(m, 'has_condition_criteria', ({ entity }: FGuardCtx) => ({
      ok: !isBlank(entity.condition) && !isBlank(entity.criteria),
      message: 'Condition and criteria must be documented',
    }));
    registry.register<Finding>(m, 'has_recommendation', async ({ entity }: FGuardCtx) => {
      if (!isBlank(entity.recommendation)) return true;
      const count = await this.prisma.scoped().recommendation.count({ where: { findingId: entity.id } });
      return { ok: count > 0, message: 'At least one recommendation is required' };
    });
    registry.register<Finding>(m, 'has_management_response', ({ entity }: FGuardCtx) => ({
      ok: !isBlank(entity.managementResponse),
      message: 'A management response is required',
    }));
    registry.register<Finding>(m, 'has_action_owner_and_due_date', ({ entity }: FGuardCtx) => ({
      ok: Boolean(entity.actionOwnerId || !isBlank(entity.actionOwnerName) || !isBlank(entity.actionOwnerEmail)) && Boolean(entity.dueDate),
      message: 'An action owner and a due date are required',
    }));
    registry.register<Finding>(m, 'has_implementation_evidence', async ({ entity }: FGuardCtx) => {
      const db = this.prisma.scoped();
      const [evidence, documents, implemented] = await Promise.all([
        db.evidence.count({ where: { findings: { some: { id: entity.id } } } }),
        db.document.count({ where: { ownerType: 'Finding', ownerId: entity.id, deletedAt: null, uploadedAt: { not: null } } }),
        db.recommendation.count({ where: { findingId: entity.id, status: { in: ['IMPLEMENTED', 'VALIDATED'] } } }),
      ]);
      return { ok: evidence + documents + implemented > 0, message: 'Attach implementation evidence (document or evidence record) before requesting validation' };
    });
    registry.register<Finding>(m, VALIDATOR_GUARD, ({ entity, actor }: FGuardCtx) => ({
      ok: !entity.actionOwnerId || entity.actionOwnerId !== actor.userId,
      message: 'The action owner cannot validate their own finding',
    }));
  }

  private extraGuardsFor(action: string): string[] {
    return action === 'validate_and_close' || action === 'reject_validation' ? [VALIDATOR_GUARD] : [];
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(query: FindingListQueryDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const now = new Date();
    const where = buildFindingsWhere(query, user, now);
    const orderBy = parseSort(query.sort, ['reference', 'title', 'severity', 'status', 'dueDate', 'createdAt', 'agreedAt', 'closedAt'] as const, { createdAt: 'desc' });
    const page = await paginate(
      query,
      () => db.finding.count({ where }),
      (p) => db.finding.findMany({ where, orderBy, ...p, include: LIST_INCLUDE }),
    );
    return { ...page, items: page.items.map(({ _count, ...f }) => ({ ...withAgeing(f, now), recommendationCount: _count.recommendations, evidenceCount: _count.evidence })) };
  }

  async get(id: string, user: AuthUser) {
    const f = await this.prisma.scoped().finding.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...LIST_INCLUDE,
        workpaper: { select: { id: true, reference: true, title: true } },
        risk: { select: { id: true, code: true, title: true } },
        control: { select: { id: true, code: true, title: true } },
        process: { select: { id: true, code: true, name: true } },
        validatedBy: { select: USER_SUMMARY_SELECT },
        repeatOf: { select: { id: true, reference: true, title: true, engagementId: true } },
        recommendations: { orderBy: { sequence: 'asc' }, include: { owner: { select: USER_SUMMARY_SELECT } } },
        statusHistory: { orderBy: { changedAt: 'desc' }, include: { changedBy: { select: USER_SUMMARY_SELECT } } },
        evidence: { include: { document: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedAt: true } } } },
      },
    });
    if (!f) throw new NotFoundException('Finding not found');
    const [documents, availableActions] = await Promise.all([
      this.prisma.scoped().document.findMany({ where: { ownerType: 'Finding', ownerId: id, deletedAt: null }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedAt: true, classification: true } }),
      this.workflow.availableActions(FINDING_WORKFLOW, f.status, { userId: user.id, permissions: user.permissions }, f, (t) => this.extraGuardsFor(t.action)),
    ]);
    const { _count, ...rest } = f;
    return { ...withAgeing(rest), recommendationCount: _count.recommendations, evidenceCount: _count.evidence, documents, availableActions };
  }

  async assertFinding(id: string) {
    const f = await this.prisma.scoped().finding.findFirst({ where: { id, deletedAt: null } });
    if (!f) throw new NotFoundException('Finding not found');
    return f;
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async create(dto: CreateFindingDto) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: dto.engagementId, deletedAt: null } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    if (engagement.stage === 'CLOSED') throw new ConflictException('Closed engagements cannot receive new findings');
    if (dto.workpaperId) {
      const wp = await db.workpaper.findFirst({ where: { id: dto.workpaperId, engagementId: dto.engagementId, deletedAt: null } });
      if (!wp) throw new BadRequestException('Workpaper not found on this engagement');
    }
    if (dto.repeatOfId) {
      const prev = await db.finding.findFirst({ where: { id: dto.repeatOfId, deletedAt: null } });
      if (!prev) throw new BadRequestException('repeatOfId does not reference a finding in this tenant');
    }

    let created: Finding | undefined;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const latest = await db.finding.findFirst({ where: { engagementId: dto.engagementId, reference: { startsWith: 'F-' } }, orderBy: { reference: 'desc' }, select: { reference: true } });
      try {
        created = await db.finding.create({
          data: {
            tenantId: this.ctx.tenantId,
            engagementId: dto.engagementId,
            workpaperId: dto.workpaperId ?? null,
            entityId: dto.entityId === undefined ? engagement.entityId : dto.entityId,
            processId: dto.processId ?? null,
            riskId: dto.riskId ?? null,
            controlId: dto.controlId ?? null,
            reference: nextFindingReference(latest?.reference),
            title: dto.title,
            severity: dto.severity,
            condition: dto.condition,
            criteria: dto.criteria,
            cause: dto.cause ?? null,
            impact: dto.impact ?? null,
            recommendation: dto.recommendation ?? null,
            rootCauseCategory: dto.rootCauseCategory ?? null,
            category: dto.category ?? null,
            actionOwnerId: dto.actionOwnerId ?? null,
            actionOwnerName: dto.actionOwnerName ?? null,
            actionOwnerEmail: dto.actionOwnerEmail ?? null,
            dueDate: toDate(dto.dueDate) ?? null,
            isRepeat: Boolean(dto.repeatOfId),
            repeatOfId: dto.repeatOfId ?? null,
            raisedById: this.ctx.userId,
            statusHistory: { create: { tenantId: this.ctx.tenantId, fromStatus: null, toStatus: 'DRAFT', changedById: this.ctx.userId, comment: 'Finding raised' } },
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 4) continue;
        throw err;
      }
    }
    if (!created) throw new ConflictException('Could not allocate a finding reference');
    await this.audit.record({ action: 'finding.created', targetType: 'Finding', targetId: created.id, after: created });
    return db.finding.findFirstOrThrow({ where: { id: created.id }, include: LIST_INCLUDE });
  }

  async update(id: string, dto: UpdateFindingDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await this.assertFinding(id);
    const canManage = user.permissions.includes('finding:manage');
    if (!canManage) {
      if (!user.permissions.includes('finding:respond')) throw new ForbiddenException('Missing permission: finding:manage');
      const disallowed = Object.keys(dto).filter((k) => !(BUSINESS_OWNER_FIELDS as readonly string[]).includes(k) && dto[k as keyof UpdateFindingDto] !== undefined);
      if (disallowed.length) throw new ForbiddenException(`Business owners may only edit: ${BUSINESS_OWNER_FIELDS.join(', ')}`);
      if (!['MANAGEMENT_REVIEW', 'AGREED', 'IMPLEMENTATION'].includes(before.status)) {
        throw new ConflictException('Management response can only be edited while the finding is under review or being implemented');
      }
    }
    if (before.status === 'CLOSED' || before.status === 'RISK_ACCEPTED') throw new ConflictException('Closed findings cannot be edited');
    if (dto.evidenceIds) {
      const count = await db.evidence.count({ where: { id: { in: dto.evidenceIds }, engagementId: before.engagementId } });
      if (count !== new Set(dto.evidenceIds).size) throw new BadRequestException('One or more evidence records were not found on this engagement');
    }
    const after = await db.finding.update({
      where: { id },
      data: {
        ...compact({
          title: dto.title,
          severity: dto.severity,
          condition: dto.condition,
          criteria: dto.criteria,
          cause: dto.cause,
          impact: dto.impact,
          recommendation: dto.recommendation,
          managementResponse: dto.managementResponse,
          workpaperId: dto.workpaperId,
          riskId: dto.riskId,
          controlId: dto.controlId,
          processId: dto.processId,
          entityId: dto.entityId,
          rootCauseCategory: dto.rootCauseCategory,
          category: dto.category,
          repeatOfId: dto.repeatOfId,
          isRepeat: dto.repeatOfId === undefined ? undefined : Boolean(dto.repeatOfId),
          actionOwnerId: dto.actionOwnerId,
          actionOwnerName: dto.actionOwnerName,
          actionOwnerEmail: dto.actionOwnerEmail,
          dueDate: toDate(dto.dueDate),
        }),
        ...(dto.evidenceIds ? { evidence: { set: dto.evidenceIds.map((eid) => ({ id: eid })) } } : {}),
      },
      include: LIST_INCLUDE,
    });
    await this.audit.record({ action: 'finding.updated', targetType: 'Finding', targetId: id, before, after, metadata: { fields: Object.keys(compact(dto)) } });
    if (dto.actionOwnerId && dto.actionOwnerId !== before.actionOwnerId && dto.actionOwnerId !== user.id) {
      await this.notifications.notify(dto.actionOwnerId, {
        type: 'finding.assigned',
        title: `You are the action owner for ${after.reference} ${after.title}`,
        link: `/findings/${id}`,
        payload: { findingId: id },
      });
    }
    return withAgeing(after);
  }

  async transition(id: string, dto: TransitionDto, user: AuthUser) {
    const finding = await this.assertFinding(id);
    const transition = await this.workflow.transition({
      machine: FINDING_WORKFLOW,
      entityType: 'Finding',
      current: finding.status,
      action: dto.action,
      actor: { userId: user.id, permissions: user.permissions },
      guardContext: finding,
      comment: dto.comment,
      extraGuards: this.extraGuardsFor(dto.action),
    });

    const now = new Date();
    const to = transition.to as FindingStatus;
    const data: Prisma.FindingUncheckedUpdateInput = { status: to };
    let recommendationStatus: Prisma.RecommendationUpdateManyMutationInput | null = null;
    switch (transition.action) {
      case 'agree':
        data.agreedAt = now;
        if (!finding.originalDueDate) data.originalDueDate = finding.dueDate;
        recommendationStatus = { status: 'AGREED' };
        break;
      case 'start_implementation':
        recommendationStatus = { status: 'IN_PROGRESS' };
        break;
      case 'request_validation':
        data.implementedAt = now;
        break;
      case 'validate_and_close':
        data.validatedById = user.id;
        data.validatedAt = now;
        data.closedAt = now;
        recommendationStatus = { status: 'VALIDATED', progressPct: 100, completedAt: now };
        break;
      case 'accept_risk':
        data.closedAt = now;
        recommendationStatus = { status: 'NOT_IMPLEMENTED' };
        break;
      case 'return_to_draft':
        data.agreedAt = null;
        break;
    }

    const updated = await this.prisma.transaction(async (tx) => {
      const f = await tx.finding.update({ where: { id }, data, include: LIST_INCLUDE });
      await tx.findingStatusHistory.create({
        data: { tenantId: this.ctx.tenantId, findingId: id, fromStatus: finding.status, toStatus: to, changedById: user.id, comment: dto.comment ?? transition.label },
      });
      if (recommendationStatus) {
        await tx.recommendation.updateMany({ where: { findingId: id, status: { notIn: ['SUPERSEDED', 'VALIDATED'] } }, data: recommendationStatus });
      }
      return f;
    });

    await this.audit.record({
      action: 'finding.status_changed',
      targetType: 'Finding',
      targetId: id,
      before: { status: finding.status },
      after: { status: updated.status },
      metadata: { action: transition.action, comment: dto.comment ?? null },
    });

    const recipients = new Set<string | null>([finding.raisedById, finding.actionOwnerId]);
    if (['submit', 'request_validation'].includes(transition.action)) {
      const eng = await this.prisma.scoped().engagement.findFirst({ where: { id: finding.engagementId }, select: { leadId: true, managerId: true } });
      recipients.add(eng?.leadId ?? null);
      recipients.add(eng?.managerId ?? null);
    }
    recipients.delete(user.id);
    await this.notifications.notifyMany(Array.from(recipients), {
      type: 'finding.status_changed',
      title: `${updated.reference} ${updated.title}: ${transition.label.toLowerCase()}`,
      body: dto.comment,
      link: `/findings/${id}`,
      payload: { findingId: id, action: transition.action, from: finding.status, to },
    });
    return this.get(id, user);
  }

  async extend(id: string, dto: ExtendFindingDto, user: AuthUser) {
    const before = await this.assertFinding(id);
    if (!ACTIONABLE_STATUSES.includes(before.status)) throw new ConflictException('Only agreed findings that are being implemented can be extended');
    const newDue = new Date(dto.dueDate);
    if (before.dueDate && newDue <= before.dueDate) throw new BadRequestException('The new due date must be later than the current one');
    const after = await this.prisma.scoped().finding.update({
      where: { id },
      data: { dueDate: newDue, originalDueDate: before.originalDueDate ?? before.dueDate, extensionCount: { increment: 1 }, escalationLevel: 0 },
      include: LIST_INCLUDE,
    });
    await this.audit.record({
      action: 'finding.extended',
      targetType: 'Finding',
      targetId: id,
      before: { dueDate: before.dueDate, extensionCount: before.extensionCount },
      after: { dueDate: after.dueDate, extensionCount: after.extensionCount },
      metadata: { reason: dto.reason },
    });
    await this.notifications.notifyMany([before.raisedById, before.actionOwnerId].filter((u) => u !== user.id), {
      type: 'finding.extended',
      title: `${after.reference} due date extended to ${newDue.toISOString().slice(0, 10)} (extension #${after.extensionCount})`,
      body: dto.reason,
      link: `/findings/${id}`,
      payload: { findingId: id },
    });
    return withAgeing(after);
  }

  // ---------------------------------------------------------------------------
  // Recommendations
  // ---------------------------------------------------------------------------

  async addRecommendation(findingId: string, dto: CreateRecommendationDto) {
    const db = this.prisma.scoped();
    const finding = await this.assertFinding(findingId);
    if (finding.status === 'CLOSED' || finding.status === 'RISK_ACCEPTED') throw new ConflictException('Closed findings cannot receive recommendations');
    const max = await db.recommendation.aggregate({ where: { findingId }, _max: { sequence: true } });
    const created = await db.recommendation.create({
      data: {
        tenantId: this.ctx.tenantId,
        findingId,
        sequence: (max._max.sequence ?? 0) + 1,
        text: dto.text,
        priority: dto.priority ?? 'MEDIUM',
        ownerId: dto.ownerId ?? null,
        ownerName: dto.ownerName ?? null,
        dueDate: toDate(dto.dueDate) ?? null,
        actionPlan: dto.actionPlan ?? null,
        status: finding.status === 'DRAFT' || finding.status === 'MANAGEMENT_REVIEW' ? 'PROPOSED' : 'AGREED',
      },
      include: { owner: { select: USER_SUMMARY_SELECT } },
    });
    await this.audit.record({ action: 'recommendation.created', targetType: 'Recommendation', targetId: created.id, after: created, metadata: { findingId } });
    return created;
  }

  async updateRecommendation(id: string, dto: UpdateRecommendationDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await db.recommendation.findFirst({ where: { id }, include: { finding: { select: { id: true, status: true, actionOwnerId: true, reference: true, raisedById: true } } } });
    if (!before) throw new NotFoundException('Recommendation not found');
    const canManage = user.permissions.includes('finding:manage');
    if (!canManage) {
      const isOwner = before.ownerId === user.id || before.finding.actionOwnerId === user.id || user.permissions.includes('finding:respond');
      if (!isOwner) throw new ForbiddenException('You cannot edit this recommendation');
      const allowed = ['actionPlan', 'progressNote', 'progressPct', 'status', 'ownerId', 'ownerName', 'dueDate'];
      const disallowed = Object.keys(compact(dto)).filter((k) => !allowed.includes(k));
      if (disallowed.length) throw new ForbiddenException(`Business owners may only edit: ${allowed.join(', ')}`);
      if (dto.status && !['IN_PROGRESS', 'IMPLEMENTED'].includes(dto.status)) throw new ForbiddenException('Business owners can only mark recommendations IN_PROGRESS or IMPLEMENTED');
    }
    const after = await db.recommendation.update({
      where: { id },
      data: compact({
        text: dto.text,
        priority: dto.priority,
        ownerId: dto.ownerId,
        ownerName: dto.ownerName,
        dueDate: toDate(dto.dueDate),
        actionPlan: dto.actionPlan,
        status: dto.status,
        progressNote: dto.progressNote,
        progressPct: dto.status === 'IMPLEMENTED' || dto.status === 'VALIDATED' ? 100 : dto.progressPct,
        completedAt: dto.status === 'IMPLEMENTED' || dto.status === 'VALIDATED' ? (before.completedAt ?? new Date()) : undefined,
      }),
      include: { owner: { select: USER_SUMMARY_SELECT } },
    });
    await this.audit.record({ action: 'recommendation.updated', targetType: 'Recommendation', targetId: id, before, after });
    if (dto.status === 'IMPLEMENTED' && before.finding.raisedById !== user.id) {
      await this.notifications.notify(before.finding.raisedById, {
        type: 'recommendation.implemented',
        title: `Recommendation ${before.sequence} on ${before.finding.reference} marked implemented`,
        body: dto.progressNote,
        link: `/findings/${before.finding.id}`,
        payload: { findingId: before.finding.id, recommendationId: id },
      });
    }
    return after;
  }

  // ---------------------------------------------------------------------------
  // Ageing
  // ---------------------------------------------------------------------------

  async ageing(engagementId?: string, entityId?: string) {
    const db = this.prisma.scoped();
    const now = new Date();
    const base: Prisma.FindingWhereInput = { deletedAt: null, ...(engagementId ? { engagementId } : {}), ...(entityId ? { entityId } : {}) };
    const [open, bySeverityRows, byStatusRows] = await Promise.all([
      db.finding.findMany({ where: { ...base, status: { in: ACTIONABLE_STATUSES } }, select: { dueDate: true, severity: true, status: true } }),
      db.finding.groupBy({ by: ['severity'], where: { ...base, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
      db.finding.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
    ]);
    const bucketCounts = new Map<string, number>(AGEING_BUCKETS.map((b) => [b, 0]));
    const overdueBySeverity = new Map<string, number>();
    let overdueTotal = 0;
    for (const f of open) {
      const b = ageingBucket(f.dueDate, now);
      bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);
      if (b !== 'NOT_DUE') {
        overdueTotal++;
        overdueBySeverity.set(f.severity, (overdueBySeverity.get(f.severity) ?? 0) + 1);
      }
    }
    return {
      buckets: AGEING_BUCKETS.map((bucket) => ({ bucket, count: bucketCounts.get(bucket) ?? 0 })),
      bySeverity: bySeverityRows.map((r) => ({ severity: r.severity, open: r._count._all, overdue: overdueBySeverity.get(r.severity) ?? 0 })),
      byStatus: byStatusRows.map((r) => ({ status: r.status, count: r._count._all })),
      overdueTotal,
      openTotal: open.length,
    };
  }
}
