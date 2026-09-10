import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AGEING_BUCKETS, ageingBucket } from '@auditsphere/shared';
import { DashboardsService } from '../dashboards/dashboards.service';
import { paginate, parseSort, PaginationDto } from '../common/pagination';
import { startOfUtcDay, USER_SUMMARY_SELECT } from '../common/utils';
import { OPEN_STATUSES } from '../findings/findings.service';
import { PrismaService } from '../prisma/prisma.service';
import { EngagementRegisterReportQueryDto, FindingRegisterReportQueryDto, ReportQueryDto } from './reports.dto';
import { ObjectAccessService } from '../auth/object-access.service';

// Exports bypass screen pagination, with an explicit limit instead of silent truncation.
export async function reportRows<T>(query: PaginationDto, count: () => Promise<number>, find: (p: { skip: number; take: number }) => Promise<T[]>, all: boolean) {
  if (!all) return paginate(query, count, find);
  const total = await count();
  if (total > 10000) throw new BadRequestException('More than 10,000 records match. Narrow the report filters before exporting.');
  return { items: await find({ skip: 0, take: total }), total, page: 1, pageSize: total };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboards: DashboardsService,
    private readonly access: ObjectAccessService,
  ) {}

  async executive(query: ReportQueryDto) {
    if (this.access.isPortalScoped) throw new ForbiddenException('Executive reporting is restricted to the audit function and audit committee');
    const db = this.prisma.scoped();
    const now = new Date();
    const from = query.from ? startOfUtcDay(new Date(query.from)) : undefined;
    const to = query.to ? startOfUtcDay(new Date(query.to)) : undefined;
    const [committee, partner, plans, highRisks, issuedReports, openFindings] = await Promise.all([
      this.dashboards.committee(),
      this.dashboards.partner(),
      db.auditPlan.findMany({ where: { status: { in: ['ACTIVE', 'APPROVED'] } }, orderBy: [{ fiscalYear: 'desc' }, { version: 'desc' }], take: 3, select: { id: true, title: true, fiscalYear: true, status: true, version: true } }),
      db.risk.count({ where: { deletedAt: null, rating: { in: ['HIGH', 'CRITICAL'] } } }),
      db.engagement.count({ where: { deletedAt: null, reportIssuedAt: { not: null, gte: from, lt: to ? new Date(to.getTime() + 86400000) : undefined } } }),
      db.finding.count({ where: { deletedAt: null, status: { in: OPEN_STATUSES } } }),
    ]);
    const completion = committee.planProgress?.completionPct ?? 0;
    return {
      title: 'Executive internal audit report',
      generatedAt: now,
      period: { from: from ?? null, to: to ?? null },
      metrics: {
        activePlans: plans.length,
        planCompletionPct: completion,
        highAndCriticalRisks: highRisks,
        openFindings,
        issuedReports,
        activeEngagements: partner.engagementsByStage.reduce((s, x) => s + x.count, 0),
      },
      sections: [
        {
          heading: 'Overall status',
          body: `Audit plan delivery is ${completion}% complete. There are ${openFindings} open findings and ${highRisks} high or critical risks in the active register.`,
        },
        {
          heading: 'Risk and control focus',
          body: 'Priority attention should remain on high-residual-risk processes, repeat findings and monitoring alerts that indicate control failure trends.',
        },
        {
          heading: 'Delivery and resourcing',
          body: `${partner.overdueMilestones.count} milestones are overdue. Utilisation is tracked over a ${partner.utilisation.periodDays}-day window for active audit-function staff.`,
        },
        {
          heading: 'Committee actions',
          body: 'Review overdue actions, approve plan changes, challenge repeat findings and confirm management accountability for remediation dates.',
        },
      ],
      source: { committee, partner, plans },
    };
  }

  async findings(query: FindingRegisterReportQueryDto, all = false) {
    const db = this.prisma.scoped();
    const now = new Date();
    const where: Prisma.FindingWhereInput = {
      deletedAt: null,
      AND: [this.access.findingScope()],
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { reference: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const [bySeverity, byStatus, rows] = await Promise.all([
      db.finding.groupBy({ by: ['severity'], where, _count: { _all: true } }),
      db.finding.groupBy({ by: ['status'], where, _count: { _all: true } }),
      reportRows(
        query,
        () => db.finding.count({ where }),
        (p) =>
          db.finding.findMany({
            where,
            orderBy: parseSort(query.sort, ['dueDate', 'severity', 'status', 'createdAt'] as const, { dueDate: 'asc' }),
            ...p,
            select: {
              id: true,
              reference: true,
              title: true,
              severity: true,
              status: true,
              dueDate: true,
              isRepeat: true,
              engagement: { select: { id: true, auditNumber: true, title: true } },
              entity: { select: { id: true, name: true } },
              actionOwner: { select: USER_SUMMARY_SELECT },
              actionOwnerName: true,
            },
          }),
        all,
      ),
    ]);
    const buckets = new Map<string, number>(AGEING_BUCKETS.map((b) => [b, 0]));
    for (const item of rows.items) {
      const bucket = ageingBucket(item.dueDate, now);
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
    return {
      generatedAt: now,
      rollups: {
        bySeverity: bySeverity.map((x) => ({ severity: x.severity, count: x._count._all })),
        byStatus: byStatus.map((x) => ({ status: x.status, count: x._count._all })),
        ageing: Array.from(buckets.entries()).map(([bucket, count]) => ({ bucket, count })),
      },
      ...rows,
      items: rows.items.map((item) => ({ ...item, ageingBucket: ageingBucket(item.dueDate, now) })),
    };
  }

  async engagements(query: EngagementRegisterReportQueryDto, all = false) {
    const db = this.prisma.scoped();
    const where: Prisma.EngagementWhereInput = {
      deletedAt: null,
      AND: [this.access.engagementScope()],
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { auditNumber: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const [byStage, byOpinion, page] = await Promise.all([
      db.engagement.groupBy({ by: ['stage'], where, _count: { _all: true } }),
      db.engagement.groupBy({ by: ['opinion'], where, _count: { _all: true } }),
      reportRows(
        query,
        () => db.engagement.count({ where }),
        (p) =>
          db.engagement.findMany({
            where,
            orderBy: parseSort(query.sort, ['auditNumber', 'plannedEnd', 'stage', 'riskRating'] as const, { auditNumber: 'desc' }),
            ...p,
            select: {
              id: true,
              auditNumber: true,
              title: true,
              type: true,
              stage: true,
              status: true,
              riskRating: true,
              opinion: true,
              plannedStart: true,
              plannedEnd: true,
              reportIssuedAt: true,
              entity: { select: { id: true, name: true } },
              lead: { select: USER_SUMMARY_SELECT },
              _count: { select: { workpapers: true, findings: true, requests: true } },
            },
          }),
        all,
      ),
    ]);
    return {
      generatedAt: new Date(),
      rollups: {
        byStage: byStage.map((x) => ({ stage: x.stage, count: x._count._all })),
        byOpinion: byOpinion.map((x) => ({ opinion: x.opinion, count: x._count._all })),
      },
      ...page,
    };
  }

  async engagementReport(id: string) {
    await this.access.assertEngagement(id);
    const db = this.prisma.scoped();
    const hiddenRelation = { id: '00000000-0000-4000-8000-000000000000' };
    const engagement = await db.engagement.findFirst({
      where: { id, deletedAt: null },
      include: {
        entity: { select: { id: true, code: true, name: true, riskRating: true } },
        lead: { select: USER_SUMMARY_SELECT },
        manager: { select: USER_SUMMARY_SELECT },
        partner: { select: USER_SUMMARY_SELECT },
        findings: { where: { deletedAt: null, AND: [this.access.findingScope()] }, orderBy: [{ severity: 'desc' }, { reference: 'asc' }], select: { id: true, reference: true, title: true, severity: true, status: true, criteria: true, condition: true, cause: true, impact: true, recommendation: true, managementResponse: true, dueDate: true, actionOwnerName: true, actionOwner: { select: USER_SUMMARY_SELECT } } },
        workpapers: { where: this.access.isPortalScoped ? hiddenRelation : { deletedAt: null }, select: { id: true, reference: true, title: true, status: true, conclusion: true } },
        evidence: { where: this.access.isPortalScoped ? hiddenRelation : {}, select: { id: true, reference: true, description: true, type: true, isSufficient: true } },
      },
    });
    if (!engagement) throw new NotFoundException('Engagement not found');
    const openFindings = engagement.findings.filter((f) => !['CLOSED', 'RISK_ACCEPTED'].includes(f.status));
    return {
      title: `${engagement.auditNumber} audit report draft`,
      generatedAt: new Date(),
      engagement,
      sections: [
        { heading: 'Executive summary', body: engagement.executiveSummary ?? `${engagement.title} is currently at ${engagement.stage.toLowerCase().replace(/_/g, ' ')} stage with ${openFindings.length} open finding(s).` },
        { heading: 'Scope and objectives', body: [engagement.objectives, engagement.scope].filter(Boolean).join('\n\n') || 'Scope and objectives are not fully documented.' },
        { heading: 'Findings summary', body: openFindings.length ? openFindings.map((f) => `${f.reference} ${f.title} (${f.severity})`).join('\n') : 'No open findings are recorded.' },
        { heading: 'Evidence and quality', body: `${engagement.workpapers.length} workpaper(s) and ${engagement.evidence.length} evidence item(s) are linked to the engagement.` },
      ],
    };
  }
}
