import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { paginate, parseSort } from '../common/pagination';
import { compact, toDate, USER_SUMMARY_SELECT } from '../common/utils';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './collaboration.dto';

const TASK_INCLUDE = {
  assignee: { select: USER_SUMMARY_SELECT },
  createdBy: { select: USER_SUMMARY_SELECT },
  engagement: { select: { id: true, auditNumber: true, title: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly notifications: NotificationService,
  ) {}

  async list(query: TaskListQueryDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const where: Prisma.TaskWhereInput = {
      ...(query.mine ? { OR: [{ assigneeId: user.id }, { createdById: user.id, assigneeId: null }] } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.engagementId ? { engagementId: query.engagementId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const orderBy = parseSort(query.sort, ['dueDate', 'priority', 'status', 'createdAt', 'title'] as const, { dueDate: 'asc' });
    return paginate(
      query,
      () => db.task.count({ where }),
      (p) => db.task.findMany({ where, orderBy: [orderBy, { createdAt: 'desc' }], ...p, include: TASK_INCLUDE }),
    );
  }

  async create(dto: CreateTaskDto) {
    const db = this.prisma.scoped();
    if (dto.engagementId) {
      const e = await db.engagement.findFirst({ where: { id: dto.engagementId, deletedAt: null } });
      if (!e) throw new BadRequestException('Engagement not found');
    }
    if (dto.assigneeId) {
      const u = await db.user.findFirst({ where: { id: dto.assigneeId, deletedAt: null } });
      if (!u) throw new BadRequestException('Assignee not found');
    }
    const created = await db.task.create({
      data: {
        tenantId: this.ctx.tenantId,
        engagementId: dto.engagementId ?? null,
        targetType: dto.targetType ?? null,
        targetId: dto.targetId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        assigneeId: dto.assigneeId ?? null,
        createdById: this.ctx.userId,
        dueDate: toDate(dto.dueDate) ?? null,
        priority: dto.priority ?? 'MEDIUM',
      },
      include: TASK_INCLUDE,
    });
    await this.audit.record({ action: 'task.created', targetType: 'Task', targetId: created.id, after: created });
    if (created.assigneeId && created.assigneeId !== this.ctx.userId) {
      await this.notifications.notify(created.assigneeId, {
        type: 'task.assigned',
        title: `Task assigned: ${created.title}`,
        body: created.dueDate ? `Due ${created.dueDate.toISOString().slice(0, 10)}` : undefined,
        link: `/tasks/${created.id}`,
        payload: { taskId: created.id },
      });
    }
    return created;
  }

  async update(id: string, dto: UpdateTaskDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await db.task.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Task not found');
    const isParty = before.assigneeId === user.id || before.createdById === user.id;
    if (!isParty && !user.permissions.includes('engagement:manage')) throw new ForbiddenException('Only the assignee, creator or an engagement manager can edit this task');
    const done = dto.status === 'DONE';
    const after = await db.task.update({
      where: { id },
      data: compact({
        engagementId: dto.engagementId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        dueDate: toDate(dto.dueDate),
        priority: dto.priority,
        status: dto.status,
        completedAt: done ? (before.completedAt ?? new Date()) : dto.status ? null : undefined,
      }),
      include: TASK_INCLUDE,
    });
    await this.audit.record({ action: 'task.updated', targetType: 'Task', targetId: id, before, after });
    if (dto.assigneeId && dto.assigneeId !== before.assigneeId && dto.assigneeId !== user.id) {
      await this.notifications.notify(dto.assigneeId, { type: 'task.assigned', title: `Task assigned: ${after.title}`, link: `/tasks/${id}`, payload: { taskId: id } });
    } else if (done && before.createdById !== user.id) {
      await this.notifications.notify(before.createdById, { type: 'task.completed', title: `Task completed: ${after.title}`, link: `/tasks/${id}`, payload: { taskId: id } });
    }
    return after;
  }
}
