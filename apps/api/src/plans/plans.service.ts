import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditPlan, PlanStatus, Prisma } from '@auditsphere/db';
import { PLAN_WORKFLOW } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { TransitionDto } from '../common/dto/transition.dto';
import { paginate, parseSort } from '../common/pagination';
import { compact, toDate, USER_SUMMARY_SELECT } from '../common/utils';
import { EngagementsService } from '../engagements/engagements.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { GuardContext, GuardRegistry } from '../workflow/guard-registry';
import { WorkflowService } from '../workflow/workflow.service';
import {
  CreateManagementRequestDto,
  CreatePlanDto,
  CreatePlanItemDto,
  ManagementRequestListQueryDto,
  PlanListQueryDto,
  UpdateManagementRequestDto,
  UpdatePlanDto,
  UpdatePlanItemDto,
} from './plans.dto';

const ITEM_INCLUDE = {
  entity: { select: { id: true, name: true, code: true } },
  lead: { select: USER_SUMMARY_SELECT },
  engagement: { select: { id: true, auditNumber: true, title: true, stage: true, status: true } },
} satisfies Prisma.AuditPlanItemInclude;

const EDITABLE_STATUSES: PlanStatus[] = ['DRAFT', 'APPROVED', 'ACTIVE'];

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly workflow: WorkflowService,
    private readonly engagements: EngagementsService,
    private readonly notifications: NotificationService,
    registry: GuardRegistry,
  ) {
    registry.register<AuditPlan>(PLAN_WORKFLOW.name, 'has_items', async ({ entity }: GuardContext<AuditPlan>) => {
      const count = await this.prisma.scoped().auditPlanItem.count({ where: { planId: entity.id, status: { not: 'CANCELLED' } } });
      return { ok: count > 0, message: 'The plan has no items' };
    });
  }

  // ---------------------------------------------------------------------------
  // Plans
  // ---------------------------------------------------------------------------

  async list(query: PlanListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.AuditPlanWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.fiscalYear ? { fiscalYear: query.fiscalYear } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const orderBy = parseSort(query.sort, ['fiscalYear', 'title', 'status', 'createdAt'] as const, { fiscalYear: 'desc' });
    return paginate(
      query,
      () => db.auditPlan.count({ where }),
      (p) =>
        db.auditPlan.findMany({
          where,
          orderBy,
          ...p,
          include: { createdBy: { select: USER_SUMMARY_SELECT }, approvedBy: { select: USER_SUMMARY_SELECT }, _count: { select: { items: true } } },
        }),
    );
  }

  async get(id: string, user: AuthUser) {
    const plan = await this.prisma.scoped().auditPlan.findFirst({
      where: { id },
      include: {
        createdBy: { select: USER_SUMMARY_SELECT },
        approvedBy: { select: USER_SUMMARY_SELECT },
        items: { orderBy: [{ plannedYear: 'asc' }, { plannedQuarter: 'asc' }, { priority: 'asc' }], include: ITEM_INCLUDE },
      },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const active = plan.items.filter((i) => i.status !== 'CANCELLED');
    const totalBudgetHours = active.reduce((s, i) => s + (i.budgetHours?.toNumber() ?? 0), 0);
    const totalBudgetAmount = active.reduce((s, i) => s + (i.budgetAmount?.toNumber() ?? 0), 0);
    const byQuarter = new Map<string, { year: number; quarter: number | null; count: number; budgetHours: number }>();
    const byRating = new Map<string, { rating: string; count: number; budgetHours: number }>();
    const byStatus = new Map<string, number>();
    for (const i of active) {
      const qk = `${i.plannedYear}-${i.plannedQuarter ?? 0}`;
      const q = byQuarter.get(qk) ?? { year: i.plannedYear, quarter: i.plannedQuarter, count: 0, budgetHours: 0 };
      q.count++;
      q.budgetHours += i.budgetHours?.toNumber() ?? 0;
      byQuarter.set(qk, q);
      const r = byRating.get(i.riskRating) ?? { rating: i.riskRating, count: 0, budgetHours: 0 };
      r.count++;
      r.budgetHours += i.budgetHours?.toNumber() ?? 0;
      byRating.set(i.riskRating, r);
    }
    for (const i of plan.items) byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);

    const availableActions = await this.workflow.availableActions(PLAN_WORKFLOW, plan.status, { userId: user.id, permissions: user.permissions }, plan);
    return {
      ...plan,
      rollups: {
        totalBudgetHours,
        totalBudgetAmount,
        itemCount: active.length,
        byQuarter: Array.from(byQuarter.values()).sort((a, b) => a.year - b.year || (a.quarter ?? 0) - (b.quarter ?? 0)),
        byRating: Array.from(byRating.values()),
        byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      },
      availableActions,
    };
  }

  async create(dto: CreatePlanDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start) throw new BadRequestException('endDate must be after startDate');
    const db = this.prisma.scoped();
    const latest = await db.auditPlan.findFirst({ where: { fiscalYear: dto.fiscalYear }, orderBy: { version: 'desc' }, select: { version: true } });
    const created = await db.auditPlan.create({
      data: {
        tenantId: this.ctx.tenantId,
        title: dto.title,
        fiscalYear: dto.fiscalYear,
        horizonYears: dto.horizonYears ?? 1,
        startDate: start,
        endDate: end,
        version: (latest?.version ?? 0) + 1,
        totalBudgetHours: dto.totalBudgetHours ?? null,
        totalBudgetAmount: dto.totalBudgetAmount ?? null,
        currency: dto.currency ?? 'USD',
        narrative: dto.narrative ?? null,
        createdById: this.ctx.userId,
      },
    });
    await this.audit.record({ action: 'plan.created', targetType: 'AuditPlan', targetId: created.id, after: created });
    return created;
  }

  async update(id: string, dto: UpdatePlanDto) {
    const db = this.prisma.scoped();
    const before = await this.assertPlan(id);
    if (!EDITABLE_STATUSES.includes(before.status)) throw new ConflictException(`A plan in status ${before.status} cannot be edited`);
    const after = await db.auditPlan.update({
      where: { id },
      data: compact({
        title: dto.title,
        fiscalYear: dto.fiscalYear,
        horizonYears: dto.horizonYears,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        totalBudgetHours: dto.totalBudgetHours,
        totalBudgetAmount: dto.totalBudgetAmount,
        currency: dto.currency,
        narrative: dto.narrative,
      }),
    });
    await this.audit.record({ action: 'plan.updated', targetType: 'AuditPlan', targetId: id, before, after });
    return after;
  }

  async transition(id: string, dto: TransitionDto, user: AuthUser) {
    const plan = await this.assertPlan(id);
    const transition = await this.workflow.transition({
      machine: PLAN_WORKFLOW,
      entityType: 'AuditPlan',
      current: plan.status,
      action: dto.action,
      actor: { userId: user.id, permissions: user.permissions },
      guardContext: plan,
      comment: dto.comment,
    });
    const data: Prisma.AuditPlanUpdateInput = { status: transition.to as PlanStatus };
    if (transition.action === 'approve') {
      data.approvedBy = { connect: { id: user.id } };
      data.approvedAt = new Date();
    }
    if (transition.action === 'reopen' || transition.action === 'return') {
      data.approvedBy = { disconnect: true };
      data.approvedAt = null;
    }
    const updated = await this.prisma.transaction(async (tx) => {
      const p = await tx.auditPlan.update({ where: { id }, data });
      if (transition.action === 'activate') {
        await tx.auditPlanItem.updateMany({ where: { planId: id, status: 'PROPOSED' }, data: { status: 'PLANNED' } });
      }
      return p;
    });
    await this.audit.record({
      action: 'plan.status_changed',
      targetType: 'AuditPlan',
      targetId: id,
      before: { status: plan.status },
      after: { status: updated.status },
      metadata: { action: transition.action, comment: dto.comment ?? null },
    });
    if (plan.createdById !== user.id) {
      await this.notifications.notify(plan.createdById, {
        type: 'plan.status_changed',
        title: `Audit plan "${plan.title}" is now ${updated.status.replace(/_/g, ' ').toLowerCase()}`,
        body: dto.comment,
        link: `/plans/${id}`,
        payload: { planId: id, action: transition.action },
      });
    }
    return this.get(id, user);
  }

  async assertPlan(id: string) {
    const plan = await this.prisma.scoped().auditPlan.findFirst({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  async addItem(planId: string, dto: CreatePlanItemDto) {
    const plan = await this.assertPlan(planId);
    if (plan.status === 'ARCHIVED') throw new ConflictException('Archived plans cannot be changed');
    const created = await this.prisma.scoped().auditPlanItem.create({
      data: {
        tenantId: this.ctx.tenantId,
        planId,
        entityId: dto.entityId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        source: dto.source ?? 'RISK_BASED',
        engagementType: dto.engagementType ?? 'OPERATIONAL',
        riskRating: dto.riskRating ?? 'MEDIUM',
        priority: dto.priority ?? 3,
        plannedYear: dto.plannedYear,
        plannedQuarter: dto.plannedQuarter ?? null,
        plannedStart: toDate(dto.plannedStart) ?? null,
        plannedEnd: toDate(dto.plannedEnd) ?? null,
        budgetHours: dto.budgetHours ?? null,
        budgetAmount: dto.budgetAmount ?? null,
        leadId: dto.leadId ?? null,
        status: dto.status ?? (plan.status === 'DRAFT' ? 'PROPOSED' : 'PLANNED'),
        rationale: dto.rationale ?? null,
      },
      include: ITEM_INCLUDE,
    });
    await this.audit.record({ action: 'plan_item.created', targetType: 'AuditPlanItem', targetId: created.id, after: created });
    return created;
  }

  async updateItem(planId: string, itemId: string, dto: UpdatePlanItemDto) {
    const db = this.prisma.scoped();
    const before = await db.auditPlanItem.findFirst({ where: { id: itemId, planId } });
    if (!before) throw new NotFoundException('Plan item not found');
    const after = await db.auditPlanItem.update({
      where: { id: itemId },
      data: compact({
        entityId: dto.entityId,
        title: dto.title,
        description: dto.description,
        source: dto.source,
        engagementType: dto.engagementType,
        riskRating: dto.riskRating,
        priority: dto.priority,
        plannedYear: dto.plannedYear,
        plannedQuarter: dto.plannedQuarter,
        plannedStart: toDate(dto.plannedStart),
        plannedEnd: toDate(dto.plannedEnd),
        budgetHours: dto.budgetHours,
        budgetAmount: dto.budgetAmount,
        leadId: dto.leadId,
        status: dto.status,
        rationale: dto.rationale,
      }),
      include: ITEM_INCLUDE,
    });
    await this.audit.record({ action: 'plan_item.updated', targetType: 'AuditPlanItem', targetId: itemId, before, after });
    return after;
  }

  async deleteItem(planId: string, itemId: string) {
    const db = this.prisma.scoped();
    const before = await db.auditPlanItem.findFirst({ where: { id: itemId, planId } });
    if (!before) throw new NotFoundException('Plan item not found');
    if (before.engagementId) throw new ConflictException('This item already has an engagement; cancel it instead of deleting');
    await db.auditPlanItem.delete({ where: { id: itemId } });
    await this.audit.record({ action: 'plan_item.deleted', targetType: 'AuditPlanItem', targetId: itemId, before });
  }

  async createEngagementFromItem(planId: string, itemId: string) {
    const db = this.prisma.scoped();
    const item = await db.auditPlanItem.findFirst({ where: { id: itemId, planId } });
    if (!item) throw new NotFoundException('Plan item not found');
    if (item.engagementId) throw new ConflictException('An engagement already exists for this plan item');
    if (item.status === 'CANCELLED') throw new ConflictException('Cancelled items cannot be started');

    const engagement = await this.engagements.create(
      {
        title: item.title,
        type: item.engagementType,
        entityId: item.entityId,
        objectives: item.description ?? undefined,
        plannedStart: item.plannedStart?.toISOString() ?? null,
        plannedEnd: item.plannedEnd?.toISOString() ?? null,
        budgetHours: item.budgetHours?.toNumber() ?? null,
        budgetAmount: item.budgetAmount?.toNumber() ?? null,
        leadId: item.leadId,
        riskRating: item.riskRating,
      },
      { planItemId: item.id },
    );
    await db.auditPlanItem.update({ where: { id: itemId }, data: { status: 'IN_PROGRESS' } });
    await this.audit.record({
      action: 'plan_item.engagement_created',
      targetType: 'AuditPlanItem',
      targetId: itemId,
      metadata: { engagementId: engagement.id, auditNumber: engagement.auditNumber },
    });
    return engagement;
  }

  // ---------------------------------------------------------------------------
  // Management requests
  // ---------------------------------------------------------------------------

  async listManagementRequests(query: ManagementRequestListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.ManagementRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const orderBy = parseSort(query.sort, ['receivedAt', 'title', 'status', 'priority'] as const, { receivedAt: 'desc' });
    return paginate(
      query,
      () => db.managementRequest.count({ where }),
      (p) =>
        db.managementRequest.findMany({
          where,
          orderBy,
          ...p,
          include: { requestedBy: { select: USER_SUMMARY_SELECT }, entity: { select: { id: true, name: true, code: true } }, planItem: { select: { id: true, planId: true, title: true, status: true } } },
        }),
    );
  }

  async createManagementRequest(dto: CreateManagementRequestDto) {
    const created = await this.prisma.scoped().managementRequest.create({
      data: {
        tenantId: this.ctx.tenantId,
        title: dto.title,
        description: dto.description ?? null,
        requestedById: this.ctx.userId,
        requesterName: dto.requesterName ?? null,
        entityId: dto.entityId ?? null,
        planItemId: dto.planItemId ?? null,
        priority: dto.priority ?? 'MEDIUM',
      },
    });
    await this.audit.record({ action: 'management_request.created', targetType: 'ManagementRequest', targetId: created.id, after: created });
    return created;
  }

  async updateManagementRequest(id: string, dto: UpdateManagementRequestDto) {
    const db = this.prisma.scoped();
    const before = await db.managementRequest.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Management request not found');
    const after = await db.managementRequest.update({
      where: { id },
      data: compact({
        title: dto.title,
        description: dto.description,
        requesterName: dto.requesterName,
        entityId: dto.entityId,
        planItemId: dto.planItemId,
        priority: dto.priority,
        status: dto.status,
        decisionNote: dto.decisionNote,
      }),
    });
    await this.audit.record({ action: 'management_request.updated', targetType: 'ManagementRequest', targetId: id, before, after });
    if (dto.status && dto.status !== before.status && before.requestedById && before.requestedById !== this.ctx.userId) {
      await this.notifications.notify(before.requestedById, {
        type: 'management_request.status_changed',
        title: `Your audit request "${before.title}" is now ${after.status.replace(/_/g, ' ').toLowerCase()}`,
        body: dto.decisionNote,
        link: `/plans/requests/${id}`,
        payload: { managementRequestId: id },
      });
    }
    return after;
  }
}
