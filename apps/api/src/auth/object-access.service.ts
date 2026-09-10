import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AUDIT_FUNCTION_ROLES } from '@auditsphere/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';

/**
 * Record-level authorization for non-audit users.
 *
 * RBAC answers whether a user may use a feature. This service answers whether
 * that user may access the particular record supplied to the API. Audit
 * function and committee users retain tenant-wide read access granted by their
 * roles; Business Owners and Management Reviewers are explicitly scoped.
 */
@Injectable()
export class ObjectAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  get isPortalScoped(): boolean {
    const roles = this.ctx.roles;
    const isAuditFunction = roles.some((role) => (AUDIT_FUNCTION_ROLES as readonly string[]).includes(role));
    const isCommittee = roles.includes('AUDIT_COMMITTEE_VIEWER');
    const isManagementUser = roles.includes('BUSINESS_OWNER') || roles.includes('MANAGEMENT_REVIEWER');
    return isManagementUser && !isAuditFunction && !isCommittee;
  }

  engagementScope(): Prisma.EngagementWhereInput {
    if (!this.isPortalScoped) return {};
    return {
      OR: [
        ...(this.directEngagementScope().OR ?? []),
        { requests: { some: this.requestScope() } },
        { findings: { some: this.directFindingOwnerScope() } },
      ],
    };
  }

  private directEngagementScope(): Prisma.EngagementWhereInput {
    const userId = this.ctx.userId;
    const email = this.ctx.email;
    const byEmail = email ? { equals: email, mode: Prisma.QueryMode.insensitive } : undefined;
    return {
      OR: [
        { leadId: userId },
        { managerId: userId },
        { partnerId: userId },
        { members: { some: { userId } } },
        { stakeholders: { some: { OR: [{ userId }, ...(byEmail ? [{ email: byEmail }] : [])] } } },
      ],
    };
  }

  private directFindingOwnerScope(): Prisma.FindingWhereInput {
    const userId = this.ctx.userId;
    const email = this.ctx.email;
    return email
      ? { OR: [{ actionOwnerId: userId }, { actionOwnerEmail: { equals: email, mode: Prisma.QueryMode.insensitive } }] }
      : { actionOwnerId: userId };
  }

  findingScope(): Prisma.FindingWhereInput {
    if (!this.isPortalScoped) return {};
    return { OR: [this.directFindingOwnerScope(), { engagement: this.directEngagementScope() }] };
  }

  requestScope(): Prisma.DocumentRequestWhereInput {
    if (!this.isPortalScoped) return {};
    const userId = this.ctx.userId;
    const email = this.ctx.email;
    return email
      ? { OR: [{ assigneeId: userId }, { assigneeEmail: { equals: email, mode: Prisma.QueryMode.insensitive } }] }
      : { assigneeId: userId };
  }

  taskScope(): Prisma.TaskWhereInput {
    if (!this.isPortalScoped) return {};
    return { OR: [{ assigneeId: this.ctx.userId }, { createdById: this.ctx.userId }] };
  }

  async documentScope(): Promise<Prisma.DocumentWhereInput> {
    if (!this.isPortalScoped) {
      return {
        OR: [
          { ownerType: null },
          { ownerType: { not: 'AiContext' } },
          { ownerType: 'AiContext', ownerId: this.ctx.userId, uploadedById: this.ctx.userId },
        ],
      };
    }

    const db = this.prisma.scoped();
    const [findings, requests] = await Promise.all([
      db.finding.findMany({ where: { deletedAt: null, AND: [this.findingScope()] }, select: { id: true } }),
      db.documentRequest.findMany({ where: this.requestScope(), select: { id: true } }),
    ]);
    const findingIds = findings.map(({ id }) => id);
    const requestIds = requests.map(({ id }) => id);
    const recommendationIds = findingIds.length
      ? (await db.recommendation.findMany({ where: { findingId: { in: findingIds } }, select: { id: true } })).map(({ id }) => id)
      : [];

    return {
      OR: [
        { ownerType: 'AiContext', ownerId: this.ctx.userId, uploadedById: this.ctx.userId },
        { ownerType: 'Finding', ownerId: { in: findingIds } },
        { ownerType: 'Recommendation', ownerId: { in: recommendationIds } },
        { ownerType: 'DocumentRequest', ownerId: { in: requestIds } },
        { requests: { some: this.requestScope() } },
      ],
    };
  }

  async assertEngagement(id: string): Promise<void> {
    const found = await this.prisma.scoped().engagement.count({
      where: { id, deletedAt: null, AND: [this.engagementScope()] },
    });
    if (!found) throw new NotFoundException('Engagement not found');
  }

  async assertFinding(id: string): Promise<void> {
    const found = await this.prisma.scoped().finding.count({
      where: { id, deletedAt: null, AND: [this.findingScope()] },
    });
    if (!found) throw new NotFoundException('Finding not found');
  }

  async assertRequest(id: string): Promise<void> {
    const found = await this.prisma.scoped().documentRequest.count({
      where: { id, AND: [this.requestScope()] },
    });
    if (!found) throw new NotFoundException('Request not found');
  }

  async assertDocument(id: string): Promise<void> {
    const scope = await this.documentScope();
    const found = await this.prisma.scoped().document.count({
      where: { id, deletedAt: null, AND: [scope] },
    });
    if (!found) throw new NotFoundException('Document not found');
  }

  async assertUploadOwner(ownerType: string, ownerId: string): Promise<void> {
    if (ownerType === 'AiContext') {
      if (ownerId !== this.ctx.userId || !this.ctx.hasPermission('ai:use')) {
        throw new ForbiddenException('AI context uploads must belong to the current user');
      }
      return;
    }

    if (this.isPortalScoped) {
      if (ownerType === 'DocumentRequest') return this.assertRequest(ownerId);
      if (ownerType === 'Finding') return this.assertFinding(ownerId);
      if (ownerType === 'Recommendation') {
        const record = await this.prisma.scoped().recommendation.findFirst({
          where: { id: ownerId, finding: { deletedAt: null, AND: [this.findingScope()] } },
          select: { id: true },
        });
        if (!record) throw new NotFoundException('Recommendation not found');
        return;
      }
      throw new ForbiddenException('Portal users may upload only to an assigned request, accessible finding, recommendation, or their private AI context');
    }

    const db = this.prisma.scoped();
    const permissionByOwner: Record<string, string> = {
      Engagement: 'engagement:read',
      Workpaper: 'workpaper:read',
      Finding: 'finding:read',
      Recommendation: 'finding:read',
      DocumentRequest: 'request:read',
      Evidence: 'workpaper:read',
      LibraryItem: 'library:read',
    };
    this.assertFeaturePermission(permissionByOwner[ownerType] ?? 'document:upload');
    const exists = await (async () => {
      switch (ownerType) {
        case 'Engagement': return db.engagement.count({ where: { id: ownerId, deletedAt: null } });
        case 'Workpaper': return db.workpaper.count({ where: { id: ownerId, deletedAt: null } });
        case 'Finding': return db.finding.count({ where: { id: ownerId, deletedAt: null } });
        case 'Recommendation': return db.recommendation.count({ where: { id: ownerId } });
        case 'DocumentRequest': return db.documentRequest.count({ where: { id: ownerId } });
        case 'Evidence': return db.evidence.count({ where: { id: ownerId } });
        case 'LibraryItem': return db.libraryItem.count({ where: { id: ownerId } });
        default: return 0;
      }
    })();
    if (!exists) throw new NotFoundException(`${ownerType} not found`);
  }

  async assertCommentTarget(targetType: string, targetId: string): Promise<void> {
    switch (targetType) {
      case 'Engagement':
        this.assertFeaturePermission('engagement:read');
        return this.assertEngagement(targetId);
      case 'Finding':
        this.assertFeaturePermission('finding:read');
        return this.assertFinding(targetId);
      case 'DocumentRequest':
        this.assertFeaturePermission('request:read');
        return this.assertRequest(targetId);
      case 'Workpaper': {
        this.assertFeaturePermission('workpaper:read');
        const found = await this.prisma.scoped().workpaper.count({ where: { id: targetId, deletedAt: null } });
        if (!found) throw new NotFoundException('Workpaper not found');
        return;
      }
      default:
        throw new ForbiddenException('Comments are supported only for engagements, findings, requests, and workpapers');
    }
  }

  private assertFeaturePermission(permission: string) {
    if (!this.ctx.hasPermission(permission)) throw new ForbiddenException(`Missing permission: ${permission}`);
  }
}
