import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { TransitionDto } from '../common/dto/transition.dto';
import {
  AddMemberDto,
  CreateEngagementDto,
  CreateMilestoneDto,
  CreateStakeholderDto,
  EngagementListQueryDto,
  UpdateEngagementDto,
  UpdateMilestoneDto,
} from './engagements.dto';
import { EngagementsService } from './engagements.service';

@ApiTags('engagements')
@ApiCookieAuth('as_access')
@Controller('engagements')
export class EngagementsController {
  constructor(private readonly engagements: EngagementsService) {}

  @Get()
  @RequirePermission('engagement:read')
  list(@Query() query: EngagementListQueryDto, @CurrentUser() user: AuthUser) {
    return this.engagements.list(query, user);
  }

  @Post()
  @RequirePermission('engagement:create')
  @ApiOperation({ summary: 'Create an engagement; auditNumber is generated as IA-<year>-<seq>' })
  create(@Body() dto: CreateEngagementDto) {
    return this.engagements.create(dto);
  }

  @Get(':id')
  @RequirePermission('engagement:read')
  @ApiOperation({ summary: 'Engagement with team, milestones, stage history and availableActions' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.engagements.get(id, user);
  }

  @Patch(':id')
  @RequirePermission('engagement:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEngagementDto) {
    return this.engagements.update(id, dto);
  }

  @Post(':id/transition')
  @RequirePermission('engagement:read')
  @ApiOperation({ summary: 'Run an ENGAGEMENT_WORKFLOW action (permission checked per transition)' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() user: AuthUser) {
    return this.engagements.transition(id, dto, user);
  }

  @Post(':id/members')
  @RequirePermission('engagement:manage')
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMemberDto) {
    return this.engagements.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @RequirePermission('engagement:manage')
  removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.engagements.removeMember(id, userId);
  }

  @Post(':id/stakeholders')
  @RequirePermission('engagement:manage')
  addStakeholder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateStakeholderDto) {
    return this.engagements.addStakeholder(id, dto);
  }

  @Delete(':id/stakeholders/:stakeholderId')
  @HttpCode(204)
  @RequirePermission('engagement:manage')
  removeStakeholder(@Param('id', ParseUUIDPipe) id: string, @Param('stakeholderId', ParseUUIDPipe) stakeholderId: string) {
    return this.engagements.removeStakeholder(id, stakeholderId);
  }

  @Post(':id/milestones')
  @RequirePermission('engagement:manage')
  addMilestone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMilestoneDto) {
    return this.engagements.addMilestone(id, dto);
  }

  @Patch(':id/milestones/:milestoneId')
  @RequirePermission('engagement:manage')
  updateMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.engagements.updateMilestone(id, milestoneId, dto);
  }

  @Delete(':id/milestones/:milestoneId')
  @HttpCode(204)
  @RequirePermission('engagement:manage')
  deleteMilestone(@Param('id', ParseUUIDPipe) id: string, @Param('milestoneId', ParseUUIDPipe) milestoneId: string) {
    return this.engagements.deleteMilestone(id, milestoneId);
  }
}
