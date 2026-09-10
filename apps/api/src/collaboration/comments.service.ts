import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AUDIT_FUNCTION_ROLES } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { ObjectAccessService } from '../auth/object-access.service';
import { paginate } from '../common/pagination';
import { USER_SUMMARY_SELECT } from '../common/utils';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CommentListQueryDto, CreateCommentDto } from './collaboration.dto';

const COMMENT_INCLUDE = { author: { select: USER_SUMMARY_SELECT } } satisfies Prisma.CommentInclude;

export function isAuditFunction(user: Pick<AuthUser, 'roles'>): boolean {
  return user.roles.some((r) => AUDIT_FUNCTION_ROLES.includes(r));
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
    private readonly notifications: NotificationService,
    private readonly access: ObjectAccessService,
  ) {}

  async list(query: CommentListQueryDto, user: AuthUser) {
    await this.access.assertCommentTarget(query.targetType, query.targetId);
    const db = this.prisma.scoped();
    const where: Prisma.CommentWhereInput = {
      targetType: query.targetType,
      targetId: query.targetId,
      deletedAt: null,
      ...(isAuditFunction(user) ? {} : { isInternal: false }),
    };
    return paginate(
      query,
      () => db.comment.count({ where }),
      (p) => db.comment.findMany({ where, orderBy: { createdAt: 'asc' }, ...p, include: COMMENT_INCLUDE }),
    );
  }

  async create(dto: CreateCommentDto, user: AuthUser) {
    await this.access.assertCommentTarget(dto.targetType, dto.targetId);
    const db = this.prisma.scoped();
    const internal = isAuditFunction(user) ? (dto.isInternal ?? true) : false;
    if (this.access.isPortalScoped && dto.mentions?.some((id) => id !== user.id)) {
      throw new BadRequestException('Portal comments cannot mention other users');
    }
    if (dto.parentId) {
      const parent = await db.comment.findFirst({ where: { id: dto.parentId, targetType: dto.targetType, targetId: dto.targetId, deletedAt: null } });
      if (!parent) throw new BadRequestException('Parent comment not found on this target');
    }
    const mentions = Array.from(new Set(dto.mentions ?? []));
    if (mentions.length) {
      const found = await db.user.count({ where: { id: { in: mentions }, deletedAt: null } });
      if (found !== mentions.length) throw new BadRequestException('One or more mentioned users were not found');
    }
    const created = await db.comment.create({
      data: {
        tenantId: this.ctx.tenantId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        parentId: dto.parentId ?? null,
        authorId: user.id,
        body: dto.body,
        mentions,
        isInternal: internal,
      },
      include: COMMENT_INCLUDE,
    });
    await this.audit.record({ action: 'comment.created', targetType: dto.targetType, targetId: dto.targetId, after: { commentId: created.id, isInternal: internal } });
    await this.notifications.notifyMany(
      mentions.filter((m) => m !== user.id),
      {
        type: 'comment.mentioned',
        title: `${user.displayName} mentioned you in a comment`,
        body: dto.body.length > 200 ? `${dto.body.slice(0, 197)}...` : dto.body,
        link: `/${dto.targetType.toLowerCase()}s/${dto.targetId}`,
        payload: { commentId: created.id, targetType: dto.targetType, targetId: dto.targetId },
      },
    );
    return created;
  }
}
