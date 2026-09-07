import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators';
import { EngagementRegisterReportQueryDto, ExportFormatDto, FindingRegisterReportQueryDto, ReportQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';
import { ReportExportService } from './report-export.service';

@ApiTags('reports')
@ApiCookieAuth('as_access')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService, private readonly exports: ReportExportService) {}

  @Get('executive/export')
  @RequirePermission('report:export')
  @Header('Cache-Control', 'private, no-store')
  exportExecutive(@Query() query: ReportQueryDto) { return this.exports.executive(query); }

  @Get('findings/export')
  @RequirePermission('report:export')
  @Header('Cache-Control', 'private, no-store')
  exportFindings(@Query() query: FindingRegisterReportQueryDto) { return this.exports.findings(query); }

  @Get('engagements/export')
  @RequirePermission('report:export')
  @Header('Cache-Control', 'private, no-store')
  exportEngagements(@Query() query: EngagementRegisterReportQueryDto) { return this.exports.engagements(query); }

  @Get('engagements/:id/export')
  @RequirePermission('report:export')
  @Header('Cache-Control', 'private, no-store')
  exportEngagement(@Param('id', ParseUUIDPipe) id: string, @Query() query: ExportFormatDto) { return this.exports.engagement(id, query.format ?? 'pdf'); }

  @Get('executive')
  @RequirePermission('report:export', 'dashboard:committee', 'dashboard:partner')
  @ApiOperation({ summary: 'Executive audit committee report assembled from dashboard and register data' })
  executive(@Query() query: ReportQueryDto) {
    return this.reports.executive(query);
  }

  @Get('findings')
  @RequirePermission('report:export', 'finding:read')
  findings(@Query() query: FindingRegisterReportQueryDto) {
    return this.reports.findings(query);
  }

  @Get('engagements')
  @RequirePermission('report:export', 'engagement:read')
  engagements(@Query() query: EngagementRegisterReportQueryDto) {
    return this.reports.engagements(query);
  }

  @Get('engagements/:id')
  @RequirePermission('report:export', 'engagement:read')
  engagement(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.engagementReport(id);
  }
}
