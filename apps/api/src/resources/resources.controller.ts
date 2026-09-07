import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import {
  AvailabilityListQueryDto,
  CreateAvailabilityDto,
  CreateTimeEntryDto,
  CurrentTimesheetDto,
  RejectTimesheetDto,
  TimesheetListQueryDto,
  UpdateAvailabilityDto,
  UpdateTimeEntryDto,
} from './resources.dto';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@ApiCookieAuth('as_access')
@Controller()
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get('resources/summary')
  @RequirePermission('time:own', 'resource:read')
  @ApiOperation({ summary: 'My current timesheet, utilisation, charge codes and upcoming availability' })
  summary(@CurrentUser() user: AuthUser) {
    return this.resources.summary(user);
  }

  @Get('charge-codes')
  @RequirePermission('time:own', 'resource:read')
  chargeCodes() {
    return this.resources.chargeCodes();
  }

  @Get('timesheets')
  @RequirePermission('time:own', 'time:approve', 'resource:read')
  listTimesheets(@Query() query: TimesheetListQueryDto, @CurrentUser() user: AuthUser) {
    return this.resources.listTimesheets(query, user);
  }

  @Post('timesheets/current')
  @RequirePermission('time:own')
  current(@Body() dto: CurrentTimesheetDto, @CurrentUser() user: AuthUser) {
    return this.resources.current(dto, user);
  }

  @Post('timesheets/:id/entries')
  @RequirePermission('time:own')
  createEntry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTimeEntryDto, @CurrentUser() user: AuthUser) {
    return this.resources.createEntry(id, dto, user);
  }

  @Patch('time-entries/:id')
  @RequirePermission('time:own')
  updateEntry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTimeEntryDto, @CurrentUser() user: AuthUser) {
    return this.resources.updateEntry(id, dto, user);
  }

  @Delete('time-entries/:id')
  @HttpCode(204)
  @RequirePermission('time:own')
  deleteEntry(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.resources.deleteEntry(id, user);
  }

  @Post('timesheets/:id/submit')
  @RequirePermission('time:own')
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.resources.submit(id, user);
  }

  @Post('timesheets/:id/approve')
  @RequirePermission('time:approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.resources.approve(id, user);
  }

  @Post('timesheets/:id/reject')
  @RequirePermission('time:approve')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectTimesheetDto, @CurrentUser() user: AuthUser) {
    return this.resources.reject(id, dto, user);
  }

  @Get('resources/availability')
  @RequirePermission('resource:read', 'resource:manage')
  listAvailability(@Query() query: AvailabilityListQueryDto) {
    return this.resources.listAvailability(query);
  }

  @Post('resources/availability')
  @RequirePermission('resource:manage')
  createAvailability(@Body() dto: CreateAvailabilityDto) {
    return this.resources.createAvailability(dto);
  }

  @Patch('resources/availability/:id')
  @RequirePermission('resource:manage')
  updateAvailability(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAvailabilityDto) {
    return this.resources.updateAvailability(id, dto);
  }
}
