import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { redact } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';

export interface AuditRecordInput {
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  /** Overrides for pre-authentication events (login) and background jobs. */
  tenantId?: string;
  actorId?: string | null;
  actorEmail?: string | null;
}

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    const tenantId = input.tenantId ?? this.ctx.tenantIdOrNull;
    if (!tenantId) {
      this.logger.warn(`Audit event ${input.action} dropped: no tenant in context`);
      return;
    }
    const actorId = input.actorId === undefined ? this.ctx.userIdOrNull : input.actorId;
    const actorEmail = input.actorEmail === undefined ? this.ctx.email : input.actorEmail;

    await this.prisma.auditTrail.create({
      data: {
        tenantId,
        actorId,
        actorEmail,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        before: input.before === undefined ? Prisma.JsonNull : (redact(input.before) as Prisma.InputJsonValue),
        after: input.after === undefined ? Prisma.JsonNull : (redact(input.after) as Prisma.InputJsonValue),
        metadata: (redact(input.metadata ?? {}) as Prisma.InputJsonValue) ?? {},
        ipAddress: this.ctx.ip,
        userAgent: this.ctx.userAgent,
        requestId: this.ctx.requestId,
      },
    });
  }
}
