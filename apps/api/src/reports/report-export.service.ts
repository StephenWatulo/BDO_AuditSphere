import { Injectable, StreamableFile } from '@nestjs/common';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { EngagementRegisterReportQueryDto, FindingRegisterReportQueryDto, ReportFormat, ReportQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';
import { renderReport, REPORT_MIME, ReportDocument } from './report-renderer';

const label = (value: string | null | undefined) => value ? value.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Not recorded';
const date = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : 'Not recorded';
const filters = (query: object) => Object.entries(query).filter(([k, v]) => !['page', 'pageSize', 'format'].includes(k) && v !== undefined && v !== '').map(([k, v]) => `${label(k)}: ${v}`).join('; ') || 'All records';

@Injectable()
export class ReportExportService {
  constructor(private readonly reports: ReportsService, private readonly audit: AuditTrailService) {}

  private async file(report: ReportDocument, format: ReportFormat, name: string, targetId?: string) {
    const buffer = await renderReport(report, format);
    const fileName = `bdo-${name.replace(/[^a-z0-9_-]/gi, '-')}-${report.generatedAt.toISOString().slice(0, 10)}.${format}`;
    await this.audit.record({ action: 'report.exported', targetType: targetId ? 'Engagement' : 'Report', targetId, metadata: { fileName, format, selection: report.subtitle, rows: report.table?.rows.length } });
    return new StreamableFile(buffer, { type: REPORT_MIME[format], disposition: `attachment; filename="${fileName}"`, length: buffer.length });
  }

  async executive(query: ReportQueryDto) {
    const report = await this.reports.executive(query);
    return this.file({
      title: report.title, generatedAt: report.generatedAt, subtitle: 'Management and audit committee reporting',
      sections: [{ heading: 'Key metrics', body: Object.entries(report.metrics).map(([key, value]) => `${label(key.replace(/([A-Z])/g, ' $1'))}: ${value}`).join('\n') }, ...report.sections],
    }, query.format ?? 'pdf', 'executive-report');
  }

  async findings(query: FindingRegisterReportQueryDto) {
    const report = await this.reports.findings(query, true);
    return this.file({
      title: 'Findings register', generatedAt: report.generatedAt, subtitle: `${report.total} records | ${filters(query)}`, sections: [],
      table: {
        columns: ['Reference', 'Finding', 'Audit', 'Entity', 'Severity', 'Status', 'Due date', 'Action owner'],
        rows: report.items.map((f) => [f.reference, f.title, f.engagement?.auditNumber ?? '', f.entity?.name ?? '', label(f.severity), label(f.status), date(f.dueDate), f.actionOwner?.displayName ?? f.actionOwnerName ?? '']),
      },
    }, query.format ?? 'pdf', 'findings-register');
  }

  async engagements(query: EngagementRegisterReportQueryDto) {
    const report = await this.reports.engagements(query, true);
    return this.file({
      title: 'Engagements register', generatedAt: report.generatedAt, subtitle: `${report.total} records | ${filters(query)}`, sections: [],
      table: {
        columns: ['Audit', 'Engagement', 'Entity', 'Stage', 'Status', 'Risk', 'Planned end', 'Lead'],
        rows: report.items.map((e) => [e.auditNumber, e.title, e.entity?.name ?? '', label(e.stage), label(e.status), label(e.riskRating), date(e.plannedEnd), e.lead?.displayName ?? '']),
      },
    }, query.format ?? 'pdf', 'engagements-register');
  }

  async engagement(id: string, format: ReportFormat) {
    const report = await this.reports.engagementReport(id);
    const e = report.engagement;
    const sections = [
      { heading: 'Engagement details', body: [`Audit: ${e.auditNumber}`, `Entity: ${e.entity?.name ?? 'Not recorded'}`, `Stage: ${label(e.stage)}`, `Opinion: ${label(e.opinion)}`, `Lead: ${e.lead?.displayName ?? 'Not assigned'}`, `Manager: ${e.manager?.displayName ?? 'Not assigned'}`, `Partner: ${e.partner?.displayName ?? 'Not assigned'}`, `Audit period: ${date(e.periodStart)} to ${date(e.periodEnd)}`, `Report issued: ${date(e.reportIssuedAt)}`].join('\n') },
      ...report.sections,
      { heading: 'Background', body: e.background ?? 'Not recorded' },
      { heading: 'Out of scope', body: e.outOfScope ?? 'Not recorded' },
      ...e.findings.flatMap((f) => [
        { heading: `${f.reference}: ${f.title}`, body: `Severity: ${label(f.severity)} | Status: ${label(f.status)}\nAction owner: ${f.actionOwner?.displayName ?? f.actionOwnerName ?? 'Not assigned'}\nDue date: ${date(f.dueDate)}` },
        ...[{ heading: 'Criteria', body: f.criteria }, { heading: 'Condition', body: f.condition }, { heading: 'Cause', body: f.cause }, { heading: 'Impact', body: f.impact }, { heading: 'Recommendation', body: f.recommendation }, { heading: 'Management response', body: f.managementResponse }].map((s) => ({ ...s, body: s.body ?? 'Not recorded' })),
      ]),
    ];
    return this.file({ title: `${e.auditNumber} - ${e.title}`, generatedAt: report.generatedAt, subtitle: 'Current audit report draft', sections }, format, `${e.auditNumber}-audit-report-draft`, id);
  }
}
