import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentRequest, Prisma, RequestStatus } from '@auditsphere/db';
import { REQUEST_WORKFLOW } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { ObjectAccessService } from '../auth/object-access.service';
import { TransitionDto } from '../common/dto/transition.dto';
import { paginate, parseSort } from '../common/pagination';
import { compact, isBlank, pad, USER_SUMMARY_SELECT } from '../common/utils';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { GuardContext, GuardRegistry } from '../workflow/guard-registry';
import { WorkflowService } from '../workflow/workflow.service';
import { CreateRequestDto, LinkDocumentDto, RequestListQueryDto, UpdateRequestDto } from './requests.dto';

const REQUEST_INCLUDE = {
  engagement: { select: { id: true, auditNumber: true, title: true } },
  requestedBy: { select: USER_SUMMARY_SELECT },
  assignee: { select: USER_SUMMARY_SELECT },
  _count: { select: { documents: { where: { deletedAt: null } } } },
} satisfies Prisma.DocumentRequestInclude;

export function nextRequestReference(latest: string | null | undefined): string {
  const m = latest ? /^DR-(\d+)$/.exec(latest) : null;
  const seq = m ? Number(m[1]) + 1 : 1;
  return `DR-${pad(seq, 2)}`;
}

/** `mine=true` matches by assignee id, and by assignee email when the actor's email is known. */
export type ListActor = string | { id: string; email?: string | null };

export function buildRequestWhere(query: RequestListQueryDto, actor: ListActor, now = new Date()): Prisma.DocumentRequestWhereInput {
  const where: Prisma.DocumentRequestWhereInput = {};
  const me = typeof actor === 'string' ? { id: actor } : actor;
  if (query.engagementId) where.engagementId = query.engagementId;
  if (query.status) where.status = query.status;
  if (query.mine) {
    // Auditors may type an address instead of picking the account, so a provisioned
    // business owner also sees requests addressed to their email.
    if (me.email) where.AND = [{ OR: [{ assigneeId: me.id }, { assigneeEmail: { equals: me.email, mode: 'insensitive' } }] }];
    else where.assigneeId = me.id;
  }
  if (query.overdue) {
    where.dueDate = { lt: now };
    where.status = query.status ?? { in: ['OPEN', 'RETURNED'] };
  }
  if (query.q) where.OR = [{ title: { contains: query.q, mode: 'insensitive' } }, { reference: { contains: query.q, mode: 'insensitive' } }];
  return where;
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly workflow: WorkflowService,
    private readonly notifications: NotificationService,
    private readonly access: ObjectAccessService,
    registry: GuardRegistry,
  ) {
    registry.register<DocumentRequest>(REQUEST_WORKFLOW.name, 'has_attachment_or_response', async ({ entity }: GuardContext<DocumentRequest>) => {
      if (!isBlank(entity.responseNote)) return true;
      const docs = await this.prisma.scoped().document.count({ where: { requests: { some: { id: entity.id } }, deletedAt: null, uploadedAt: { not: null } } });
      return { ok: docs > 0, message: 'Attach at least one document or write a response note' };
    });
  }

  async list(query: RequestListQueryDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const where: Prisma.DocumentRequestWhereInput = {
      AND: [buildRequestWhere(query, user), this.access.requestScope()],
    };
    const orderBy = parseSort(query.sort, ['dueDate', 'reference', 'title', 'status', 'createdAt'] as const, { dueDate: 'asc' });
    const page = await paginate(
      query,
      () => db.documentRequest.count({ where }),
      (p) => db.documentRequest.findMany({ where, orderBy, ...p, include: REQUEST_INCLUDE }),
    );
    return { ...page, items: page.items.map(({ _count, ...r }) => ({ ...r, documentCount: _count.documents })) };
  }

  async get(id: string, user: AuthUser) {
    await this.access.assertRequest(id);
    const documentScope = await this.access.documentScope();
    const r = await this.prisma.scoped().documentRequest.findFirst({
      where: { id },
      include: {
        ...REQUEST_INCLUDE,
        documents: {
          where: {
            deletedAt: null,
            ...(this.ctx.hasPermission('document:restricted') ? {} : { classification: { not: 'RESTRICTED' as const } }),
            AND: [documentScope],
          },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            classification: true,
            uploadedAt: true,
            checksumSha256: true,
            uploadedBy: { select: USER_SUMMARY_SELECT },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Request not found');
    const availableActions = await this.workflow.availableActions(REQUEST_WORKFLOW, r.status, { userId: user.id, permissions: user.permissions }, r);
    const { _count, ...rest } = r;
    return { ...rest, documentCount: _count.documents, availableActions };
  }

  async assertRequest(id: string) {
    await this.access.assertRequest(id);
    const r = await this.prisma.scoped().documentRequest.findFirst({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    return r;
  }

  async create(dto: CreateRequestDto) {
    const db = this.prisma.scoped();
    const engagement = await db.engagement.findFirst({ where: { id: dto.engagementId, deletedAt: null } });
    if (!engagement) throw new NotFoundException('Engagement not found');
    if (dto.assigneeId) {
      const u = await db.user.findFirst({ where: { id: dto.assigneeId, deletedAt: null } });
      if (!u) throw new BadRequestException('Assignee not found');
    }
    let created: DocumentRequest | undefined;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const latest = await db.documentRequest.findFirst({ where: { engagementId: dto.engagementId, reference: { startsWith: 'DR-' } }, orderBy: { reference: 'desc' }, select: { reference: true } });
      try {
        created = await db.documentRequest.create({
          data: {
            tenantId: this.ctx.tenantId,
            engagementId: dto.engagementId,
            reference: nextRequestReference(latest?.reference),
            title: dto.title,
            description: dto.description ?? null,
            requestedById: this.ctx.userId,
            assigneeId: dto.assigneeId ?? null,
            assigneeEmail: dto.assigneeEmail ?? null,
            dueDate: new Date(dto.dueDate),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 4) continue;
        throw err;
      }
    }
    if (!created) throw new ConflictException('Could not allocate a request reference');
    await this.audit.record({ action: 'request.created', targetType: 'DocumentRequest', targetId: created.id, after: created });
    await this.notifications.notify(created.assigneeId, {
      type: 'request.assigned',
      title: `Document request ${created.reference}: ${created.title}`,
      body: `Due ${created.dueDate.toISOString().slice(0, 10)} for ${engagement.auditNumber}`,
      link: `/requests/${created.id}`,
      payload: { requestId: created.id, engagementId: engagement.id },
    });
    return db.documentRequest.findFirstOrThrow({ where: { id: created.id }, include: REQUEST_INCLUDE });
  }

  async update(id: string, dto: UpdateRequestDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await this.assertRequest(id);
    const canManage = user.permissions.includes('request:manage');
    if (!canManage) {
      const disallowed = Object.keys(compact(dto)).filter((k) => k !== 'responseNote');
      if (disallowed.length) throw new ForbiddenException('Responders may only edit responseNote');
      if (before.assigneeId && before.assigneeId !== user.id) throw new ForbiddenException('This request is assigned to someone else');
    }
    if (before.status === 'ACCEPTED' || before.status === 'CANCELLED') throw new ConflictException('Closed requests cannot be edited');
    const after = await db.documentRequest.update({
      where: { id },
      data: compact({
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        assigneeEmail: dto.assigneeEmail,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        responseNote: dto.responseNote,
      }),
      include: REQUEST_INCLUDE,
    });
    await this.audit.record({ action: 'request.updated', targetType: 'DocumentRequest', targetId: id, before, after });
    if (dto.assigneeId && dto.assigneeId !== before.assigneeId && dto.assigneeId !== user.id) {
      await this.notifications.notify(dto.assigneeId, {
        type: 'request.assigned',
        title: `Document request ${after.reference}: ${after.title}`,
        link: `/requests/${id}`,
        payload: { requestId: id },
      });
    }
    return after;
  }

  async transition(id: string, dto: TransitionDto, user: AuthUser) {
    const request = await this.assertRequest(id);
    if (request.status === 'OPEN' || request.status === 'RETURNED') {
      if (dto.action === 'submit' || dto.action === 'resubmit') {
        if (request.assigneeId && request.assigneeId !== user.id && !user.permissions.includes('request:manage')) {
          throw new ForbiddenException('This request is assigned to someone else');
        }
      }
    }
    const transition = await this.workflow.transition({
      machine: REQUEST_WORKFLOW,
      entityType: 'DocumentRequest',
      current: request.status,
      action: dto.action,
      actor: { userId: user.id, permissions: user.permissions },
      guardContext: request,
      comment: dto.comment,
    });
    const now = new Date();
    const data: Prisma.DocumentRequestUncheckedUpdateInput = { status: transition.to as RequestStatus };
    if (transition.action === 'submit' || transition.action === 'resubmit') data.submittedAt = now;
    if (transition.action === 'accept') data.acceptedAt = now;
    if (transition.action === 'return') {
      if (isBlank(dto.comment)) throw new BadRequestException('A comment explaining why the request is returned is required');
      data.returnReason = dto.comment;
    }
    const updated = await this.prisma.scoped().documentRequest.update({ where: { id }, data, include: REQUEST_INCLUDE });
    await this.audit.record({
      action: 'request.status_changed',
      targetType: 'DocumentRequest',
      targetId: id,
      before: { status: request.status },
      after: { status: updated.status },
      metadata: { action: transition.action, comment: dto.comment ?? null },
    });
    const recipient = transition.action === 'submit' || transition.action === 'resubmit' ? request.requestedById : request.assigneeId;
    if (recipient && recipient !== user.id) {
      await this.notifications.notify(recipient, {
        type: 'request.status_changed',
        title: `Request ${updated.reference} ${updated.title}: ${transition.label.toLowerCase()}`,
        body: dto.comment,
        link: `/requests/${id}`,
        payload: { requestId: id, action: transition.action },
      });
    }
    return this.get(id, user);
  }

  async linkDocument(id: string, dto: LinkDocumentDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const request = await this.assertRequest(id);
    if (request.status === 'ACCEPTED' || request.status === 'CANCELLED') throw new ConflictException('Closed requests cannot receive documents');
    if (!user.permissions.includes('request:manage') && request.assigneeId && request.assigneeId !== user.id) {
      throw new ForbiddenException('This request is assigned to someone else');
    }
    await this.access.assertDocument(dto.documentId);
    const doc = await db.document.findFirst({ where: { id: dto.documentId, deletedAt: null } });
    if (!doc) throw new BadRequestException('Document not found');
    if (doc.ownerType === 'AiContext') throw new BadRequestException('Private AI context cannot be linked to a shared request. Upload the document to the request separately.');
    await db.documentRequest.update({ where: { id }, data: { documents: { connect: { id: doc.id } } } });
    if (!doc.ownerType || doc.ownerType === 'DocumentRequest') {
      await db.document.update({ where: { id: doc.id }, data: { ownerType: 'DocumentRequest', ownerId: id } });
    }
    await this.audit.record({ action: 'request.document_linked', targetType: 'DocumentRequest', targetId: id, metadata: { documentId: doc.id, fileName: doc.fileName } });
    return this.get(id, user);
  }
}
