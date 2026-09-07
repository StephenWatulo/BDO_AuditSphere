import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { addDays } from '../common/utils';
import { ACTIONABLE_STATUSES } from '../findings/findings.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { reminderDecision } from './reminder-schedule';

export interface ReminderRunSummary {
  tenants: number;
  findingReminders: number;
  requestReminders: number;
  milestoneAlerts: number;
  errors: number;
}

/**
 * Daily reminder and escalation job (06:00 UTC). Runs only when the process is
 * started with `--worker` or `RUN_JOBS=true` (JobsModule is imported conditionally).
 */
@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly notifications: NotificationService,
    private readonly audit: AuditTrailService,
  ) {}

  onModuleInit() {
    this.logger.log('Worker mode: daily reminders scheduled at 06:00 UTC');
  }

  @Cron('0 6 * * *', { name: 'daily-reminders', timeZone: 'UTC' })
  async runDaily() {
    const summary = await this.runAll();
    this.logger.log(`Daily reminders: ${JSON.stringify(summary)}`);
  }

  async runAll(now = new Date()): Promise<ReminderRunSummary> {
    if (this.running) {
      this.logger.warn('Reminder run skipped: previous run still in progress');
      return { tenants: 0, findingReminders: 0, requestReminders: 0, milestoneAlerts: 0, errors: 0 };
    }
    this.running = true;
    const summary: ReminderRunSummary = { tenants: 0, findingReminders: 0, requestReminders: 0, milestoneAlerts: 0, errors: 0 };
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { isActive: true }, select: { id: true, slug: true } });
      for (const tenant of tenants) {
        summary.tenants++;
        try {
          const r = await this.ctx.runAs({ tenantId: tenant.id, requestId: `job-reminders-${now.toISOString().slice(0, 10)}` }, () => this.runForTenant(tenant.id, now));
          summary.findingReminders += r.findingReminders;
          summary.requestReminders += r.requestReminders;
          summary.milestoneAlerts += r.milestoneAlerts;
        } catch (err) {
          summary.errors++;
          this.logger.error(`Reminder run failed for tenant ${tenant.slug}: ${(err as Error).message}`, (err as Error).stack);
        }
      }
    } finally {
      this.running = false;
    }
    return summary;
  }

  async runForTenant(tenantId: string, now: Date) {
    const db = this.prisma.forTenant(tenantId);
    const escalationContacts = await db.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { key: { in: ['CHIEF_AUDIT_EXECUTIVE'] } } } } },
      select: { id: true },
    });
    const caeIds = escalationContacts.map((u) => u.id);
    const partnerIds = (
      await db.user.findMany({ where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { key: 'AUDIT_PARTNER' } } } }, select: { id: true } })
    ).map((u) => u.id);

    // ---- Findings ----------------------------------------------------------
    let findingReminders = 0;
    const findings = await db.finding.findMany({
      where: { deletedAt: null, status: { in: ACTIONABLE_STATUSES }, dueDate: { not: null } },
      include: { engagement: { select: { id: true, auditNumber: true, managerId: true, leadId: true } } },
    });
    for (const f of findings) {
      if (!f.dueDate) continue;
      const d = reminderDecision(f.dueDate, f.lastReminderAt, now);
      if (!d.remind) continue;
      const recipients = new Set<string | null>([f.actionOwnerId]);
      if (d.escalationLevel >= 1) recipients.add(f.engagement.managerId ?? f.engagement.leadId);
      if (d.escalationLevel >= 2) caeIds.forEach((id) => recipients.add(id));
      if (d.escalationLevel >= 3) partnerIds.forEach((id) => recipients.add(id));
      const title =
        d.reason === 'before_due'
          ? `${f.reference} ${f.title} is due in ${d.daysUntilDue} day(s)`
          : `${f.reference} ${f.title} is ${d.daysOverdue} day(s) overdue${d.escalationLevel >= 2 ? ' (escalated)' : ''}`;
      await this.notifications.notifyMany(Array.from(recipients), {
        tenantId,
        type: d.reason === 'before_due' ? 'finding.reminder' : 'finding.overdue',
        title,
        body: `Engagement ${f.engagement.auditNumber}. Due ${f.dueDate.toISOString().slice(0, 10)}. Escalation level ${d.escalationLevel}.`,
        link: `/findings/${f.id}`,
        payload: { findingId: f.id, escalationLevel: d.escalationLevel, daysOverdue: d.daysOverdue },
      });
      await db.finding.update({
        where: { id: f.id },
        data: { reminderCount: { increment: 1 }, lastReminderAt: now, escalationLevel: Math.max(f.escalationLevel, d.escalationLevel) },
      });
      await this.audit.record({
        tenantId,
        actorId: null,
        actorEmail: 'system',
        action: d.escalationLevel > f.escalationLevel ? 'finding.escalated' : 'finding.reminder_sent',
        targetType: 'Finding',
        targetId: f.id,
        metadata: { escalationLevel: d.escalationLevel, daysOverdue: d.daysOverdue, recipients: Array.from(recipients).filter(Boolean) },
      });
      findingReminders++;
    }

    // ---- Document requests -------------------------------------------------
    let requestReminders = 0;
    const requests = await db.documentRequest.findMany({
      where: { status: { in: ['OPEN', 'RETURNED'] } },
      include: { engagement: { select: { id: true, auditNumber: true, managerId: true, leadId: true } } },
    });
    for (const r of requests) {
      const d = reminderDecision(r.dueDate, r.lastReminderAt, now);
      if (!d.remind) continue;
      const recipients = new Set<string | null>([r.assigneeId]);
      if (d.escalationLevel >= 1) recipients.add(r.requestedById);
      if (d.escalationLevel >= 2) recipients.add(r.engagement.managerId ?? r.engagement.leadId);
      await this.notifications.notifyMany(Array.from(recipients), {
        tenantId,
        type: d.reason === 'before_due' ? 'request.reminder' : 'request.overdue',
        title: d.reason === 'before_due' ? `Request ${r.reference} ${r.title} is due in ${d.daysUntilDue} day(s)` : `Request ${r.reference} ${r.title} is ${d.daysOverdue} day(s) overdue`,
        body: `Engagement ${r.engagement.auditNumber}. Due ${r.dueDate.toISOString().slice(0, 10)}.`,
        link: `/requests/${r.id}`,
        payload: { requestId: r.id, escalationLevel: d.escalationLevel },
      });
      await db.documentRequest.update({ where: { id: r.id }, data: { reminderCount: { increment: 1 }, lastReminderAt: now } });
      await this.audit.record({ tenantId, actorId: null, actorEmail: 'system', action: 'request.reminder_sent', targetType: 'DocumentRequest', targetId: r.id, metadata: { escalationLevel: d.escalationLevel } });
      requestReminders++;
    }

    // ---- Engagement milestones ----------------------------------------------
    let milestoneAlerts = 0;
    const milestones = await db.engagementMilestone.findMany({
      where: { completedAt: null, dueDate: { lt: now }, engagement: { deletedAt: null, status: 'ACTIVE' } },
      include: { engagement: { select: { id: true, auditNumber: true, title: true, leadId: true, managerId: true } } },
    });
    for (const m of milestones) {
      const recent = await db.notification.count({
        where: { type: 'milestone.overdue', createdAt: { gte: addDays(now, -7) }, payload: { path: ['milestoneId'], equals: m.id } },
      });
      if (recent > 0) continue;
      const daysOver = Math.floor((now.getTime() - m.dueDate.getTime()) / 86_400_000);
      await this.notifications.notifyMany([m.engagement.leadId, m.engagement.managerId], {
        tenantId,
        type: 'milestone.overdue',
        title: `Milestone "${m.name}" on ${m.engagement.auditNumber} is ${daysOver} day(s) overdue`,
        link: `/engagements/${m.engagement.id}`,
        payload: { milestoneId: m.id, engagementId: m.engagement.id, daysOverdue: daysOver },
      });
      milestoneAlerts++;
    }

    return { findingReminders, requestReminders, milestoneAlerts };
  }
}
