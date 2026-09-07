import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@auditsphere/db';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RequirePermission } from '../common/decorators';
import { paginate, PaginationDto, parseSort } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export class AuditTrailQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) targetType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) targetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) action?: string;
  @ApiPropertyOptional({ description: 'ISO date-time lower bound' }) @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional({ description: 'ISO date-time upper bound' }) @IsOptional() @IsISO8601() to?: string;
}

@ApiTags('audit-trail')
@ApiCookieAuth('as_access')
@Controller('audit-trail')
export class AuditTrailController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('audit_trail:read')
  @ApiOperation({ summary: 'Query the append-only audit trail' })
  list(@Query() query: AuditTrailQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.AuditTrailWhereInput = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.from || query.to
        ? { occurredAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
      ...(query.q ? { OR: [{ action: { contains: query.q, mode: 'insensitive' } }, { actorEmail: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['occurredAt', 'action', 'targetType'] as const, { occurredAt: 'desc' });
    return paginate(
      query,
      () => db.auditTrail.count({ where }),
      (p) =>
        db.auditTrail.findMany({
          where,
          orderBy,
          ...p,
          include: { actor: { select: { id: true, displayName: true, email: true } } },
        }),
    );
  }
}
