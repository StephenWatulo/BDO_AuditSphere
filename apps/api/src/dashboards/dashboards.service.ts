import { Injectable } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AGEING_BUCKETS, ageingBucket, AUDIT_FUNCTION_ROLES, ENGAGEMENT_STAGES } from '@auditsphere/shared';
import { AuthUser } from '../auth/auth.types';
import { addDays, USER_SUMMARY_SELECT } from '../common/utils';
import { ACTIONABLE_STATUSES, OPEN_STATUSES } from '../findings/findings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RisksService } from '../risks/risks.service';

const TOP = 5;

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risks: RisksService,
  ) {}

  async auditor(user: AuthUser) {
    const db = this.prisma.scoped();
    const now = new Date();
    const me = user.id;
    const myEngagements: Prisma.EngagementWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      OR: [{ leadId: me }, { managerId: me }, { partnerId: me }, { members: { some: { userId: me } } }],
    };
    const stepWhere: Prisma.AuditProgramStepWhereInput = { assigneeId: me, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] }, program: { engagement: { deletedAt: null, status: 'ACTIVE' } } };
    const noteWhere: Prisma.ReviewNoteWhereInput = { assignedToId: me, status: 'OPEN' };
    const reviewWhere: Prisma.WorkpaperWhereInput = {
      deletedAt: null,
      status: { in: ['PREPARED', 'IN_REVIEW'] },
      preparedById: { not: me },
      OR: [{ reviewedById: me }, { engagement: { OR: [{ managerId: me }, { leadId: me }] } }],
    };
    const deadlineWhere: Prisma.EngagementMilestoneWhereInput = { completedAt: null, dueDate: { lte: addDays(now, 14) }, engagement: myEngagements };
    const myFindingsWhere: Prisma.FindingWhereInput = { deletedAt: null, status: { in: OPEN_STATUSES }, OR: [{ raisedById: me }, { actionOwnerId: me }] };
    const myRequestsWhere: Prisma.DocumentRequestWhereInput = { status: { in: ['OPEN', 'SUBMITTED', 'RETURNED'] }, OR: [{ requestedById: me }, { assigneeId: me }] };

    const [stepCount, steps, noteCount, notes, reviewCount, reviews, deadlineCount, deadlines, findingCount, findings, requestCount, requests] = await Promise.all([
      db.auditProgramStep.count({ where: stepWhere }),
      db.auditProgramStep.findMany({ where: stepWhere, take: TOP, orderBy: { updatedAt: 'desc' }, include: { program: { select: { id: true, title: true, engagement: { select: { id: true, auditNumber: true, title: true } } } } } }),
      db.reviewNote.count({ where: noteWhere }),
      db.reviewNote.findMany({ where: noteWhere, take: TOP, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], include: { raisedBy: { select: USER_SUMMARY_SELECT }, workpaper: { select: { id: true, reference: true, title: true, engagementId: true } } } }),
      db.workpaper.count({ where: reviewWhere }),
      db.workpaper.findMany({ where: reviewWhere, take: TOP, orderBy: { preparedAt: 'asc' }, select: { id: true, reference: true, title: true, status: true, preparedAt: true, engagementId: true, preparedBy: { select: USER_SUMMARY_SELECT } } }),
      db.engagementMilestone.count({ where: deadlineWhere }),
      db.engagementMilestone.findMany({ where: deadlineWhere, take: TOP, orderBy: { dueDate: 'asc' }, include: { engagement: { select: { id: true, auditNumber: true, title: true } } } }),
      db.finding.count({ where: myFindingsWhere }),
      db.finding.findMany({ where: myFindingsWhere, take: TOP, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }], select: { id: true, reference: true, title: true, severity: true, status: true, dueDate: true, engagement: { select: { id: true, auditNumber: true } } } }),
      db.documentRequest.count({ where: myRequestsWhere }),
      db.documentRequest.findMany({ where: myRequestsWhere, take: TOP, orderBy: { dueDate: 'asc' }, select: { id: true, reference: true, title: true, status: true, dueDate: true, engagement: { select: { id: true, auditNumber: true } } } }),
    ]);

    return {
      assignedSteps: { count: stepCount, items: steps },
      openReviewNotes: { count: noteCount, items: notes },
      pendingReviews: { count: reviewCount, items: reviews },
      deadlines: { count: deadlineCount, items: deadlines.map((d) => ({ ...d, isOverdue: d.dueDate < now })) },
      myFindings: { count: findingCount, items: findings.map((f) => ({ ...f, ageingBucket: ageingBucket(f.dueDate, now) })) },
      myRequests: { count: requestCount, items: requests.map((r) => ({ ...r, isOverdue: r.dueDate < now && r.status !== 'SUBMITTED' })) },
    };
  }

  async partner() {
    const db = this.prisma.scoped();
    const now = new Date();
    const fourWeeksAgo = addDays(now, -28);
    const active: Prisma.EngagementWhereInput = { deletedAt: null, status: { in: ['ACTIVE', 'ON_HOLD'] } };

    const [byStage, engagements, hoursByEngagement, staff, hoursByUser, overdueMilestoneCount, overdueMilestones, opinions] = await Promise.all([
      db.engagement.groupBy({ by: ['stage'], where: active, _count: { _all: true } }),
      db.engagement.findMany({
        where: { ...active, budgetHours: { not: null } },
        select: { id: true, auditNumber: true, title: true, stage: true, budgetHours: true, plannedEnd: true, lead: { select: USER_SUMMARY_SELECT } },
        orderBy: { plannedEnd: 'asc' },
        take: 15,
      }),
      db.timeEntry.groupBy({ by: ['engagementId'], where: { engagementId: { not: null } }, _sum: { hours: true } }),
      db.user.findMany({
        where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { key: { in: AUDIT_FUNCTION_ROLES } } } } },
        select: { id: true, displayName: true, jobTitle: true, weeklyCapacity: true },
        orderBy: { displayName: 'asc' },
        take: 50,
      }),
      db.timeEntry.groupBy({ by: ['timesheetId'], where: { date: { gte: fourWeeksAgo } }, _sum: { hours: true } }),
      db.engagementMilestone.count({ where: { completedAt: null, dueDate: { lt: now }, engagement: active } }),
      db.engagementMilestone.findMany({
        where: { completedAt: null, dueDate: { lt: now }, engagement: active },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: { engagement: { select: { id: true, auditNumber: true, title: true, lead: { select: USER_SUMMARY_SELECT } } } },
      }),
      db.engagement.groupBy({ by: ['opinion'], where: { deletedAt: null, reportIssuedAt: { gte: addDays(now, -365) } }, _count: { _all: true } }),
    ]);

    const stageCounts = new Map(byStage.map((s) => [s.stage, s._count._all]));
    const actualByEngagement = new Map(hoursByEngagement.map((h) => [h.engagementId, h._sum.hours?.toNumber() ?? 0]));

    // Utilisation: hours in the last 4 weeks vs capacity, resolved through timesheets.
    const sheetOwners = await db.timesheet.findMany({ where: { id: { in: hoursByUser.map((h) => h.timesheetId) } }, select: { id: true, userId: true } });
    const ownerBySheet = new Map(sheetOwners.map((s) => [s.id, s.userId]));
    const hoursPerUser = new Map<string, number>();
    for (const h of hoursByUser) {
      const uid = ownerBySheet.get(h.timesheetId);
      if (uid) hoursPerUser.set(uid, (hoursPerUser.get(uid) ?? 0) + (h._sum.hours?.toNumber() ?? 0));
    }

    return {
      engagementsByStage: ENGAGEMENT_STAGES.map((stage) => ({ stage, count: stageCounts.get(stage) ?? 0 })),
      budgetVsActual: engagements.map((e) => {
        const budget = e.budgetHours?.toNumber() ?? 0;
        const actual = actualByEngagement.get(e.id) ?? 0;
        return { engagementId: e.id, auditNumber: e.auditNumber, title: e.title, stage: e.stage, lead: e.lead, plannedEnd: e.plannedEnd, budgetHours: budget, actualHours: actual, variancePct: budget > 0 ? Math.round(((actual - budget) / budget) * 100) : null };
      }),
      utilisation: {
        periodDays: 28,
        items: staff.map((u) => {
          const capacity = u.weeklyCapacity.toNumber() * 4;
          const hours = hoursPerUser.get(u.id) ?? 0;
          return { userId: u.id, displayName: u.displayName, jobTitle: u.jobTitle, capacityHours: capacity, recordedHours: hours, utilisationPct: capacity > 0 ? Math.round((hours / capacity) * 100) : null };
        }),
      },
      overdueMilestones: { count: overdueMilestoneCount, items: overdueMilestones.map((m) => ({ ...m, daysOverdue: Math.floor((now.getTime() - m.dueDate.getTime()) / 86_400_000) })) },
      opinionsLast12Months: opinions.map((o) => ({ opinion: o.opinion, count: o._count._all })),
    };
  }

  async committee() {
    const db = this.prisma.scoped();
    const now = new Date();
    const [heatmap, activePlan, keyFindings, keyFindingsCount, repeatCount, repeatFindings, overdueRows, assessments, bySeverity] = await Promise.all([
      this.risks.heatmap(),
      db.auditPlan.findFirst({ where: { status: { in: ['ACTIVE', 'APPROVED'] } }, orderBy: [{ fiscalYear: 'desc' }, { version: 'desc' }], include: { items: { select: { status: true, budgetHours: true, riskRating: true } } } }),
      db.finding.findMany({
        where: { deletedAt: null, severity: { in: ['HIGH', 'CRITICAL'] }, status: { in: OPEN_STATUSES } },
        orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }],
        take: 10,
        select: { id: true, reference: true, title: true, severity: true, status: true, dueDate: true, isRepeat: true, engagement: { select: { id: true, auditNumber: true, title: true } }, entity: { select: { id: true, name: true } } },
      }),
      db.finding.count({ where: { deletedAt: null, severity: { in: ['HIGH', 'CRITICAL'] }, status: { in: OPEN_STATUSES } } }),
      db.finding.count({ where: { deletedAt: null, isRepeat: true, status: { in: OPEN_STATUSES } } }),
      db.finding.findMany({
        where: { deletedAt: null, isRepeat: true, status: { in: OPEN_STATUSES } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, reference: true, title: true, severity: true, status: true, engagement: { select: { id: true, auditNumber: true } }, entity: { select: { id: true, name: true } } },
      }),
      db.finding.findMany({ where: { deletedAt: null, status: { in: ACTIONABLE_STATUSES } }, select: { dueDate: true, severity: true } }),
      db.riskAssessment.groupBy({ by: ['periodLabel'], _avg: { residualScore: true, inherentScore: true }, _count: { _all: true }, _max: { assessedAt: true }, orderBy: { _max: { assessedAt: 'asc' } }, take: 8 }),
      db.finding.groupBy({ by: ['severity'], where: { deletedAt: null, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    ]);

    const buckets = new Map<string, number>(AGEING_BUCKETS.map((b) => [b, 0]));
    for (const f of overdueRows) buckets.set(ageingBucket(f.dueDate, now), (buckets.get(ageingBucket(f.dueDate, now)) ?? 0) + 1);

    const planItems = activePlan?.items ?? [];
    const byStatus = new Map<string, number>();
    for (const i of planItems) byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
    const completed = byStatus.get('COMPLETED') ?? 0;
    const inProgress = byStatus.get('IN_PROGRESS') ?? 0;
    const total = planItems.filter((i) => i.status !== 'CANCELLED').length;

    return {
      riskProfile: { cells: heatmap.cells, thresholds: heatmap.thresholds, totalActiveRisks: heatmap.cells.reduce((s, c) => s + c.count, 0) },
      planProgress: activePlan
        ? { planId: activePlan.id, title: activePlan.title, fiscalYear: activePlan.fiscalYear, status: activePlan.status, total, completed, inProgress, completionPct: total ? Math.round((completed / total) * 100) : 0, byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })) }
        : null,
      keyFindings: { count: keyFindingsCount, items: keyFindings.map((f) => ({ ...f, ageingBucket: ageingBucket(f.dueDate, now) })) },
      repeatFindings: { count: repeatCount, items: repeatFindings },
      overdueActions: { buckets: AGEING_BUCKETS.filter((b) => b !== 'NOT_DUE').map((bucket) => ({ bucket, count: buckets.get(bucket) ?? 0 })), total: overdueRows.filter((f) => ageingBucket(f.dueDate, now) !== 'NOT_DUE').length },
      openFindingsBySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count._all })),
      riskTrend: assessments.map((a) => ({ period: a.periodLabel, assessments: a._count._all, avgResidualScore: Number(a._avg.residualScore ?? 0), avgInherentScore: Number(a._avg.inherentScore ?? 0), lastAssessedAt: a._max.assessedAt })),
    };
  }
}
