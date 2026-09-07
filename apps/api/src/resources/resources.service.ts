import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { paginate, parseSort } from '../common/pagination';
import { addDays, compact, startOfUtcDay, toDate, USER_SUMMARY_SELECT } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
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

const TIMESHEET_INCLUDE = {
  user: { select: { ...USER_SUMMARY_SELECT, jobTitle: true, weeklyCapacity: true } },
  approvedBy: { select: USER_SUMMARY_SELECT },
  entries: {
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: {
      chargeCode: { select: { id: true, code: true, name: true, isBillable: true } },
      engagement: { select: { id: true, auditNumber: true, title: true } },
    },
  },
} satisfies Prisma.TimesheetInclude;

function weekStart(value?: string | Date | null): Date {
  const d = startOfUtcDay(toDate(value) ?? new Date());
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function isWithinWeek(date: Date, start: Date): boolean {
  return date >= start && date < addDays(start, 7);
}

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
  ) {}

  async summary(user: AuthUser) {
    const db = this.prisma.scoped();
    const start = weekStart();
    const fourWeeksAgo = addDays(new Date(), -28);
    const [current, pendingApproval, chargeCodes, recentHours, availability, profile] = await Promise.all([
      db.timesheet.findFirst({ where: { userId: user.id, weekStart: start }, include: TIMESHEET_INCLUDE }),
      user.permissions.includes('time:approve') ? db.timesheet.count({ where: { status: 'SUBMITTED' } }) : Promise.resolve(0),
      db.chargeCode.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
      db.timeEntry.aggregate({ where: { timesheet: { userId: user.id }, date: { gte: fourWeeksAgo } }, _sum: { hours: true } }),
      db.staffAvailability.findMany({ where: { startDate: { lte: addDays(new Date(), 60) }, endDate: { gte: new Date() } }, take: 10, orderBy: { startDate: 'asc' }, include: { user: { select: USER_SUMMARY_SELECT } } }),
      db.user.findFirst({ where: { id: user.id }, select: { weeklyCapacity: true } }),
    ]);
    const capacity = (profile?.weeklyCapacity.toNumber() ?? 40) * 4;
    const recorded = recentHours._sum.hours?.toNumber() ?? 0;
    return {
      currentWeekStart: start,
      currentTimesheet: current,
      pendingApproval,
      chargeCodes,
      utilisation: { periodDays: 28, capacityHours: capacity, recordedHours: recorded, utilisationPct: capacity > 0 ? Math.round((recorded / capacity) * 100) : null },
      upcomingAvailability: availability,
    };
  }

  async chargeCodes() {
    return this.prisma.scoped().chargeCode.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
  }

  async listTimesheets(query: TimesheetListQueryDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const canSeeAll = user.permissions.includes('time:approve') || user.permissions.includes('resource:read');
    const where: Prisma.TimesheetWhereInput = {
      ...(!canSeeAll || query.mine ? { userId: user.id } : {}),
      ...(canSeeAll && query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.weekStart ? { weekStart: weekStart(query.weekStart) } : {}),
      ...(query.q ? { user: { OR: [{ displayName: { contains: query.q, mode: 'insensitive' } }, { email: { contains: query.q, mode: 'insensitive' } }] } } : {}),
    };
    const orderBy = parseSort(query.sort, ['weekStart', 'status', 'totalHours', 'submittedAt', 'updatedAt'] as const, { weekStart: 'desc' });
    return paginate(
      query,
      () => db.timesheet.count({ where }),
      (p) => db.timesheet.findMany({ where, orderBy, ...p, include: TIMESHEET_INCLUDE }),
    );
  }

  async current(dto: CurrentTimesheetDto, user: AuthUser) {
    const start = weekStart(dto.weekStart);
    const db = this.prisma.scoped();
    const sheet = await db.timesheet.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart: start } },
      update: {},
      create: { tenantId: this.ctx.tenantId, userId: user.id, weekStart: start, status: 'OPEN', totalHours: 0 },
      include: TIMESHEET_INCLUDE,
    });
    await this.audit.record({ action: 'timesheet.opened', targetType: 'Timesheet', targetId: sheet.id, after: { userId: sheet.userId, weekStart: sheet.weekStart } });
    return sheet;
  }

  async createEntry(timesheetId: string, dto: CreateTimeEntryDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const sheet = await this.assertTimesheet(timesheetId);
    this.assertCanEditOwn(sheet, user);
    const date = startOfUtcDay(new Date(dto.date));
    if (!isWithinWeek(date, sheet.weekStart)) throw new BadRequestException('Entry date must fall within the timesheet week');
    await this.assertChargeCode(dto.chargeCodeId);
    if (dto.engagementId) await this.assertEngagement(dto.engagementId);
    const entry = await this.prisma.transaction(async (tx) => {
      const created = await tx.timeEntry.create({
        data: {
          tenantId: this.ctx.tenantId,
          timesheetId,
          date,
          chargeCodeId: dto.chargeCodeId,
          engagementId: dto.engagementId ?? null,
          hours: dto.hours,
          notes: dto.notes ?? null,
        },
      });
      await this.recalculateTotal(tx, timesheetId);
      return created;
    });
    const after = await db.timeEntry.findFirst({ where: { id: entry.id }, include: { chargeCode: true, engagement: { select: { id: true, auditNumber: true, title: true } } } });
    await this.audit.record({ action: 'time_entry.created', targetType: 'TimeEntry', targetId: entry.id, after });
    return after;
  }

  async updateEntry(id: string, dto: UpdateTimeEntryDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await db.timeEntry.findFirst({ where: { id }, include: { timesheet: true } });
    if (!before) throw new NotFoundException('Time entry not found');
    this.assertCanEditOwn(before.timesheet, user);
    const date = dto.date ? startOfUtcDay(new Date(dto.date)) : undefined;
    if (date && !isWithinWeek(date, before.timesheet.weekStart)) throw new BadRequestException('Entry date must fall within the timesheet week');
    if (dto.chargeCodeId) await this.assertChargeCode(dto.chargeCodeId);
    if (dto.engagementId) await this.assertEngagement(dto.engagementId);
    const updated = await this.prisma.transaction(async (tx) => {
      const entry = await tx.timeEntry.update({
        where: { id },
        data: compact({
          date,
          chargeCodeId: dto.chargeCodeId,
          engagementId: dto.engagementId,
          hours: dto.hours,
          notes: dto.notes,
        }),
      });
      await this.recalculateTotal(tx, before.timesheetId);
      return entry;
    });
    await this.audit.record({ action: 'time_entry.updated', targetType: 'TimeEntry', targetId: id, before, after: updated });
    return db.timeEntry.findFirst({ where: { id }, include: { chargeCode: true, engagement: { select: { id: true, auditNumber: true, title: true } } } });
  }

  async deleteEntry(id: string, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await db.timeEntry.findFirst({ where: { id }, include: { timesheet: true } });
    if (!before) throw new NotFoundException('Time entry not found');
    this.assertCanEditOwn(before.timesheet, user);
    await this.prisma.transaction(async (tx) => {
      await tx.timeEntry.delete({ where: { id } });
      await this.recalculateTotal(tx, before.timesheetId);
    });
    await this.audit.record({ action: 'time_entry.deleted', targetType: 'TimeEntry', targetId: id, before });
  }

  async submit(id: string, user: AuthUser) {
    const before = await this.assertTimesheet(id);
    if (before.userId !== user.id) throw new ForbiddenException('Only the timesheet owner can submit it');
    if (!['OPEN', 'REJECTED'].includes(before.status)) throw new ConflictException(`Timesheet in status ${before.status} cannot be submitted`);
    if (before.totalHours.toNumber() <= 0) throw new BadRequestException('Timesheet has no time entries');
    const after = await this.prisma.scoped().timesheet.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date(), rejectReason: null }, include: TIMESHEET_INCLUDE });
    await this.audit.record({ action: 'timesheet.submitted', targetType: 'Timesheet', targetId: id, before, after });
    return after;
  }

  async approve(id: string, user: AuthUser) {
    if (!user.permissions.includes('time:approve')) throw new ForbiddenException('Missing time approval permission');
    const before = await this.assertTimesheet(id);
    if (before.userId === user.id) throw new ForbiddenException('You cannot approve your own timesheet');
    if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted timesheets can be approved');
    const after = await this.prisma.scoped().timesheet.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date(), rejectReason: null }, include: TIMESHEET_INCLUDE });
    await this.audit.record({ action: 'timesheet.approved', targetType: 'Timesheet', targetId: id, before, after });
    return after;
  }

  async reject(id: string, dto: RejectTimesheetDto, user: AuthUser) {
    if (!user.permissions.includes('time:approve')) throw new ForbiddenException('Missing time approval permission');
    const before = await this.assertTimesheet(id);
    if (before.userId === user.id) throw new ForbiddenException('You cannot reject your own timesheet');
    if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted timesheets can be rejected');
    const after = await this.prisma.scoped().timesheet.update({ where: { id }, data: { status: 'REJECTED', rejectReason: dto.reason, approvedById: null, approvedAt: null }, include: TIMESHEET_INCLUDE });
    await this.audit.record({ action: 'timesheet.rejected', targetType: 'Timesheet', targetId: id, before, after: { status: after.status, rejectReason: after.rejectReason } });
    return after;
  }

  async listAvailability(query: AvailabilityListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.StaffAvailabilityWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? { AND: [{ endDate: { gte: query.from ? startOfUtcDay(new Date(query.from)) : undefined } }, { startDate: { lte: query.to ? startOfUtcDay(new Date(query.to)) : undefined } }] }
        : {}),
      ...(query.q ? { user: { displayName: { contains: query.q, mode: 'insensitive' } } } : {}),
    };
    const orderBy = parseSort(query.sort, ['startDate', 'endDate', 'type'] as const, { startDate: 'asc' });
    return paginate(
      query,
      () => db.staffAvailability.count({ where }),
      (p) => db.staffAvailability.findMany({ where, orderBy, ...p, include: { user: { select: USER_SUMMARY_SELECT } } }),
    );
  }

  async createAvailability(dto: CreateAvailabilityDto) {
    const startDate = startOfUtcDay(new Date(dto.startDate));
    const endDate = startOfUtcDay(new Date(dto.endDate));
    if (endDate < startDate) throw new BadRequestException('endDate must be on or after startDate');
    await this.assertUser(dto.userId);
    const created = await this.prisma.scoped().staffAvailability.create({
      data: { tenantId: this.ctx.tenantId, userId: dto.userId, type: dto.type, startDate, endDate, hoursPerDay: dto.hoursPerDay ?? 8, note: dto.note ?? null },
      include: { user: { select: USER_SUMMARY_SELECT } },
    });
    await this.audit.record({ action: 'staff_availability.created', targetType: 'StaffAvailability', targetId: created.id, after: created });
    return created;
  }

  async updateAvailability(id: string, dto: UpdateAvailabilityDto) {
    const db = this.prisma.scoped();
    const before = await db.staffAvailability.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Availability record not found');
    if (dto.userId) await this.assertUser(dto.userId);
    const startDate = dto.startDate ? startOfUtcDay(new Date(dto.startDate)) : undefined;
    const endDate = dto.endDate ? startOfUtcDay(new Date(dto.endDate)) : undefined;
    const nextStartDate = startDate ?? before.startDate;
    const nextEndDate = endDate ?? before.endDate;
    if (nextEndDate < nextStartDate) throw new BadRequestException('endDate must be on or after startDate');
    const after = await db.staffAvailability.update({
      where: { id },
      data: compact({
        userId: dto.userId,
        type: dto.type,
        startDate,
        endDate,
        hoursPerDay: dto.hoursPerDay,
        note: dto.note,
      }),
      include: { user: { select: USER_SUMMARY_SELECT } },
    });
    await this.audit.record({ action: 'staff_availability.updated', targetType: 'StaffAvailability', targetId: id, before, after });
    return after;
  }

  private async assertTimesheet(id: string) {
    const sheet = await this.prisma.scoped().timesheet.findFirst({ where: { id } });
    if (!sheet) throw new NotFoundException('Timesheet not found');
    return sheet;
  }

  private assertCanEditOwn(sheet: { userId: string; status: string }, user: AuthUser) {
    if (sheet.userId !== user.id) throw new ForbiddenException('Only the timesheet owner can edit entries');
    if (!['OPEN', 'REJECTED'].includes(sheet.status)) throw new ConflictException(`Timesheet in status ${sheet.status} cannot be edited`);
  }

  private async assertChargeCode(id: string) {
    const code = await this.prisma.scoped().chargeCode.findFirst({ where: { id, isActive: true } });
    if (!code) throw new BadRequestException('Charge code not found');
  }

  private async assertEngagement(id: string) {
    const engagement = await this.prisma.scoped().engagement.findFirst({ where: { id, deletedAt: null } });
    if (!engagement) throw new BadRequestException('Engagement not found');
  }

  private async assertUser(id: string) {
    const user = await this.prisma.scoped().user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new BadRequestException('User not found');
  }

  private async recalculateTotal(tx: any, timesheetId: string) {
    const total = await tx.timeEntry.aggregate({ where: { timesheetId }, _sum: { hours: true } });
    await tx.timesheet.update({ where: { id: timesheetId }, data: { totalHours: total._sum.hours ?? 0 } });
  }
}
