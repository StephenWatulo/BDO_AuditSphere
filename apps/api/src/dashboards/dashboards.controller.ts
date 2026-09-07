import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { DashboardsService } from './dashboards.service';

@ApiTags('dashboards')
@ApiCookieAuth('as_access')
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('auditor')
  @RequirePermission('dashboard:auditor')
  @ApiOperation({ summary: 'My steps, review notes, pending reviews, deadlines, findings and requests' })
  auditor(@CurrentUser() user: AuthUser) {
    return this.dashboards.auditor(user);
  }

  @Get('partner')
  @RequirePermission('dashboard:partner')
  @ApiOperation({ summary: 'Engagements by stage, budget vs actual, utilisation, overdue milestones' })
  partner() {
    return this.dashboards.partner();
  }

  @Get('committee')
  @RequirePermission('dashboard:committee')
  @ApiOperation({ summary: 'Risk profile, plan progress, key and repeat findings, overdue actions, risk trend' })
  committee() {
    return this.dashboards.committee();
  }
}
