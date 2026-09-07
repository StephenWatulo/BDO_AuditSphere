import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { TransitionDto } from '../common/dto/transition.dto';
import {
  CreateManagementRequestDto,
  CreatePlanDto,
  CreatePlanItemDto,
  ManagementRequestListQueryDto,
  PlanListQueryDto,
  UpdateManagementRequestDto,
  UpdatePlanDto,
  UpdatePlanItemDto,
} from './plans.dto';
import { PlansService } from './plans.service';

@ApiTags('plans')
@ApiCookieAuth('as_access')
@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('plans')
  @RequirePermission('plan:read')
  list(@Query() query: PlanListQueryDto) {
    return this.plans.list(query);
  }

  @Post('plans')
  @RequirePermission('plan:manage')
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Get('plans/:id')
  @RequirePermission('plan:read')
  @ApiOperation({ summary: 'Plan with items, roll-ups and availableActions' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.plans.get(id, user);
  }

  @Patch('plans/:id')
  @RequirePermission('plan:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Post('plans/:id/transition')
  @RequirePermission('plan:read')
  @ApiOperation({ summary: 'Run a PLAN_WORKFLOW action' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() user: AuthUser) {
    return this.plans.transition(id, dto, user);
  }

  @Post('plans/:id/items')
  @RequirePermission('plan:manage')
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePlanItemDto) {
    return this.plans.addItem(id, dto);
  }

  @Patch('plans/:id/items/:itemId')
  @RequirePermission('plan:manage')
  updateItem(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdatePlanItemDto) {
    return this.plans.updateItem(id, itemId, dto);
  }

  @Delete('plans/:id/items/:itemId')
  @HttpCode(204)
  @RequirePermission('plan:manage')
  deleteItem(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.plans.deleteItem(id, itemId);
  }

  @Post('plans/:id/items/:itemId/create-engagement')
  @RequirePermission('engagement:create')
  @ApiOperation({ summary: 'Create the engagement for a plan item' })
  createEngagement(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.plans.createEngagementFromItem(id, itemId);
  }

  @Get('management-requests')
  @RequirePermission('plan:read')
  listManagementRequests(@Query() query: ManagementRequestListQueryDto) {
    return this.plans.listManagementRequests(query);
  }

  @Post('management-requests')
  @RequirePermission('plan:read', 'engagement:read')
  createManagementRequest(@Body() dto: CreateManagementRequestDto) {
    return this.plans.createManagementRequest(dto);
  }

  @Patch('management-requests/:id')
  @RequirePermission('plan:manage')
  updateManagementRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateManagementRequestDto) {
    return this.plans.updateManagementRequest(id, dto);
  }
}
