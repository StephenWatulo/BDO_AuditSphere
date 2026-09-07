import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { TransitionDto } from '../common/dto/transition.dto';
import { CreateFindingDto, CreateRecommendationDto, ExtendFindingDto, FindingListQueryDto, UpdateFindingDto, UpdateRecommendationDto } from './findings.dto';
import { FindingsService } from './findings.service';

@ApiTags('findings')
@ApiCookieAuth('as_access')
@Controller()
export class FindingsController {
  constructor(private readonly findings: FindingsService) {}

  @Get('findings')
  @RequirePermission('finding:read')
  list(@Query() query: FindingListQueryDto, @CurrentUser() user: AuthUser) {
    return this.findings.list(query, user);
  }

  @Get('findings/ageing')
  @RequirePermission('finding:read')
  @ApiOperation({ summary: 'Ageing buckets, severity split and overdue total for open findings' })
  @ApiQuery({ name: 'engagementId', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  ageing(@Query('engagementId') engagementId?: string, @Query('entityId') entityId?: string) {
    return this.findings.ageing(engagementId || undefined, entityId || undefined);
  }

  @Post('findings')
  @RequirePermission('finding:manage')
  @ApiOperation({ summary: 'Raise a finding (reference auto F-01 per engagement)' })
  create(@Body() dto: CreateFindingDto) {
    return this.findings.create(dto);
  }

  @Get('findings/:id')
  @RequirePermission('finding:read')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.findings.get(id, user);
  }

  @Patch('findings/:id')
  @RequirePermission('finding:manage', 'finding:respond')
  @ApiOperation({ summary: 'Edit a finding; business owners may only edit response, action owner and due date' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFindingDto, @CurrentUser() user: AuthUser) {
    return this.findings.update(id, dto, user);
  }

  @Post('findings/:id/transition')
  @RequirePermission('finding:read')
  @ApiOperation({ summary: 'Run a FINDING_WORKFLOW action' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() user: AuthUser) {
    return this.findings.transition(id, dto, user);
  }

  @Post('findings/:id/extend')
  @RequirePermission('finding:manage', 'finding:validate')
  @ApiOperation({ summary: 'Extend the due date (increments extensionCount)' })
  extend(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ExtendFindingDto, @CurrentUser() user: AuthUser) {
    return this.findings.extend(id, dto, user);
  }

  @Post('findings/:id/recommendations')
  @RequirePermission('finding:manage')
  addRecommendation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateRecommendationDto) {
    return this.findings.addRecommendation(id, dto);
  }

  @Patch('recommendations/:id')
  @RequirePermission('finding:manage', 'finding:respond')
  updateRecommendation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecommendationDto, @CurrentUser() user: AuthUser) {
    return this.findings.updateRecommendation(id, dto, user);
  }
}
