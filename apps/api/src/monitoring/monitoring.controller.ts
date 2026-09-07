import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import {
  ConnectorListQueryDto,
  CreateMonitoringRuleDto,
  MonitoringAlertListQueryDto,
  MonitoringRuleListQueryDto,
  RiskSignalListQueryDto,
  UpdateMonitoringAlertDto,
  UpdateMonitoringRuleDto,
  UpdateRiskSignalDto,
} from './monitoring.dto';
import { MonitoringService } from './monitoring.service';

@ApiTags('monitoring')
@ApiCookieAuth('as_access')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get('summary')
  @RequirePermission('monitoring:read')
  @ApiOperation({ summary: 'Risk radar and continuous monitoring roll-ups' })
  summary(@CurrentUser() user: AuthUser) {
    return this.monitoring.summary(user);
  }

  @Get('signals')
  @RequirePermission('monitoring:read')
  signals(@Query() query: RiskSignalListQueryDto) {
    return this.monitoring.listSignals(query);
  }

  @Patch('signals/:id')
  @RequirePermission('monitoring:manage')
  updateSignal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRiskSignalDto) {
    return this.monitoring.updateSignal(id, dto);
  }

  @Get('alerts')
  @RequirePermission('monitoring:read')
  alerts(@Query() query: MonitoringAlertListQueryDto, @CurrentUser() user: AuthUser) {
    return this.monitoring.listAlerts(query, user);
  }

  @Get('alerts/:id')
  @RequirePermission('monitoring:read')
  @ApiOperation({ summary: 'Open a monitoring alert with transaction details and its triggering rule' })
  alert(@Param('id', ParseUUIDPipe) id: string) {
    return this.monitoring.getAlert(id);
  }

  @Patch('alerts/:id')
  @RequirePermission('monitoring:manage')
  updateAlert(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMonitoringAlertDto) {
    return this.monitoring.updateAlert(id, dto);
  }

  @Get('rules')
  @RequirePermission('monitoring:read')
  rules(@Query() query: MonitoringRuleListQueryDto) {
    return this.monitoring.listRules(query);
  }

  @Post('rules')
  @RequirePermission('monitoring:manage')
  createRule(@Body() dto: CreateMonitoringRuleDto) {
    return this.monitoring.createRule(dto);
  }

  @Patch('rules/:id')
  @RequirePermission('monitoring:manage')
  updateRule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMonitoringRuleDto) {
    return this.monitoring.updateRule(id, dto);
  }

  @Get('connectors')
  @RequirePermission('monitoring:read')
  connectors(@Query() query: ConnectorListQueryDto) {
    return this.monitoring.connectors(query);
  }
}
