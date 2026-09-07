import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@auditsphere/db';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength, IsOptional } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Search text (min 2 chars)' }) @IsString() @MinLength(2) @MaxLength(120) q: string;
  @ApiPropertyOptional({ default: 5, maximum: 5 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) limit?: number;
}

const MODE = 'insensitive' as const;

@ApiTags('search')
@ApiCookieAuth('as_access')
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Global search (ILIKE) across engagements, findings, workpapers, entities, risks and controls; max 5 per group' })
  async search(@Query() query: SearchQueryDto, @CurrentUser() user: AuthUser) {
    const db = this.prisma.scoped();
    const take = Math.min(query.limit ?? 5, 5);
    const q = query.q.trim();
    const has = (p: string) => user.permissions.includes(p);
    const contains = (): Prisma.StringFilter => ({ contains: q, mode: MODE });

    const [engagements, findings, workpapers, entities, risks, controls] = await Promise.all([
      has('engagement:read')
        ? db.engagement.findMany({ where: { deletedAt: null, OR: [{ title: contains() }, { auditNumber: contains() }] }, take, orderBy: { updatedAt: 'desc' }, select: { id: true, auditNumber: true, title: true, stage: true, status: true } })
        : [],
      has('finding:read')
        ? db.finding.findMany({ where: { deletedAt: null, OR: [{ title: contains() }, { reference: contains() }, { condition: contains() }] }, take, orderBy: { updatedAt: 'desc' }, select: { id: true, reference: true, title: true, severity: true, status: true, engagementId: true } })
        : [],
      has('workpaper:read')
        ? db.workpaper.findMany({ where: { deletedAt: null, OR: [{ title: contains() }, { reference: contains() }, { objective: contains() }] }, take, orderBy: { updatedAt: 'desc' }, select: { id: true, reference: true, title: true, status: true, engagementId: true } })
        : [],
      has('universe:read')
        ? db.auditEntity.findMany({ where: { deletedAt: null, OR: [{ name: contains() }, { code: contains() }] }, take, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, type: true, riskRating: true } })
        : [],
      has('risk:read')
        ? db.risk.findMany({ where: { deletedAt: null, OR: [{ title: contains() }, { code: contains() }] }, take, orderBy: { residualScore: 'desc' }, select: { id: true, code: true, title: true, rating: true, status: true } })
        : [],
      has('control:read')
        ? db.control.findMany({ where: { deletedAt: null, OR: [{ title: contains() }, { code: contains() }] }, take, orderBy: { code: 'asc' }, select: { id: true, code: true, title: true, effectiveness: true, isKeyControl: true } })
        : [],
    ]);
    return { q, engagements, findings, workpapers, entities, risks, controls };
  }
}
