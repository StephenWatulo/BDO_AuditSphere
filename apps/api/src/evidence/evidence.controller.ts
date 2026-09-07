import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators';
import { CreateEvidenceDto, EvidenceListQueryDto, UpdateEvidenceDto } from './evidence.dto';
import { EvidenceService } from './evidence.service';

@ApiTags('evidence')
@ApiCookieAuth('as_access')
@Controller()
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get('engagements/:id/evidence')
  @RequirePermission('workpaper:read', 'document:read')
  list(@Param('id', ParseUUIDPipe) id: string, @Query() query: EvidenceListQueryDto) {
    return this.evidence.listForEngagement(id, query);
  }

  @Post('evidence')
  @RequirePermission('workpaper:prepare', 'document:upload')
  @ApiOperation({ summary: 'Register evidence (reference auto E-001)' })
  create(@Body() dto: CreateEvidenceDto) {
    return this.evidence.create(dto);
  }

  @Patch('evidence/:id')
  @RequirePermission('workpaper:prepare')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEvidenceDto) {
    return this.evidence.update(id, dto);
  }
}
