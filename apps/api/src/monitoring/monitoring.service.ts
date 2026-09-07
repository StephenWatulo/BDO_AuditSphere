import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { paginate, parseSort } from '../common/pagination';
import { compact, json, startOfUtcDay, USER_SUMMARY_SELECT } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
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

const RULE_INCLUDE = {
  connector: { select: { id: true, name: true, type: true, lastRunAt: true, lastStatus: true } },
  _count: { select: { alerts: true } },
} satisfies Prisma.MonitoringRuleInclude;

const ALERT_INCLUDE = {
  rule: { select: { id: true, code: true, name: true, ruleType: true, severity: true } },
  assignee: { select: USER_SUMMARY_SELECT },
} satisfies Prisma.MonitoringAlertInclude;

function alertResponse<T extends { amount: Prisma.Decimal | null }>(alert: T) {
  return { ...alert, amount: alert.amount?.toString() ?? null };
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
  ) {}

  async summary(user: AuthUser) {
    const db = this.prisma.scoped();
    const [signalsByStatus, alertsByStatus, alertSeverity, openMine, activeRules, connectors] = await Promise.all([
      db.riskSignal.groupBy({ by: ['status'], _count: { _all: true } }),
      db.monitoringAlert.groupBy({ by: ['status'], _count: { _all: true } }),
      db.monitoringAlert.groupBy({ by: ['ruleId'], where: { status: { in: ['OPEN', 'INVESTIGATING', 'CONFIRMED', 'ESCALATED'] } }, _count: { _all: true } }),
      db.monitoringAlert.count({ where: { assigneeId: user.id, status: { in: ['OPEN', 'INVESTIGATING', 'CONFIRMED', 'ESCALATED'] } } }),
      db.monitoringRule.count({ where: { isActive: true } }),
      db.dataConnector.count({ where: { isActive: true } }),
    ]);
    const rules = alertSeverity.length
      ? await db.monitoringRule.findMany({ where: { id: { in: alertSeverity.map((r) => r.ruleId) } }, select: { id: true, code: true, name: true, severity: true } })
      : [];
    const ruleMeta = new Map(rules.map((r) => [r.id, r]));
    return {
      signalsByStatus: signalsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      alertsByStatus: alertsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      openAssignedToMe: openMine,
      activeRules,
      activeConnectors: connectors,
      openAlertsByRule: alertSeverity.map((r) => ({ ...ruleMeta.get(r.ruleId), ruleId: r.ruleId, count: r._count._all })),
    };
  }

  async listSignals(query: RiskSignalListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.RiskSignalWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.riskId ? { riskId: query.riskId } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { summary: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['publishedAt', 'createdAt', 'relevanceScore', 'status'] as const, { createdAt: 'desc' });
    return paginate(
      query,
      () => db.riskSignal.count({ where }),
      (p) => db.riskSignal.findMany({ where, orderBy, ...p, include: { risk: { select: { id: true, code: true, title: true, rating: true } } } }),
    );
  }

  async updateSignal(id: string, dto: UpdateRiskSignalDto) {
    const db = this.prisma.scoped();
    const before = await db.riskSignal.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Risk signal not found');
    if (dto.riskId) await this.assertRisk(dto.riskId);
    const after = await db.riskSignal.update({ where: { id }, data: compact({ status: dto.status, riskId: dto.riskId }), include: { risk: { select: { id: true, code: true, title: true, rating: true } } } });
    await this.audit.record({ action: 'risk_signal.updated', targetType: 'RiskSignal', targetId: id, before, after });
    return after;
  }

  async listAlerts(query: MonitoringAlertListQueryDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const where: Prisma.MonitoringAlertWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.ruleId ? { ruleId: query.ruleId } : {}),
      ...(query.mine ? { assigneeId: user.id } : {}),
      ...(query.from ? { detectedAt: { gte: startOfUtcDay(new Date(query.from)) } } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    const orderBy = parseSort(query.sort, ['detectedAt', 'status', 'amount'] as const, { detectedAt: 'desc' });
    return paginate(
      query,
      () => db.monitoringAlert.count({ where }),
      async (p) => (await db.monitoringAlert.findMany({ where, orderBy, ...p, include: ALERT_INCLUDE })).map(alertResponse),
    );
  }

  async getAlert(id: string) {
    const alert = await this.prisma.scoped().monitoringAlert.findFirst({
      where: { id },
      include: {
        ...ALERT_INCLUDE,
        rule: { select: { ...ALERT_INCLUDE.rule.select, description: true, connector: RULE_INCLUDE.connector } },
      },
    });
    if (!alert) throw new NotFoundException('Monitoring alert not found');
    return alertResponse(alert);
  }

  async updateAlert(id: string, dto: UpdateMonitoringAlertDto) {
    const db = this.prisma.scoped();
    const before = await db.monitoringAlert.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Monitoring alert not found');
    if (dto.assigneeId) await this.assertUser(dto.assigneeId);
    if (dto.findingId) await this.assertFinding(dto.findingId);
    const after = await db.monitoringAlert.update({
      where: { id },
      data: compact({
        status: dto.status,
        assigneeId: dto.assigneeId,
        findingId: dto.findingId,
        resolvedAt: dto.status && ['FALSE_POSITIVE', 'CONFIRMED'].includes(dto.status) ? new Date() : undefined,
      }),
      include: ALERT_INCLUDE,
    });
    await this.audit.record({ action: 'monitoring_alert.updated', targetType: 'MonitoringAlert', targetId: id, before, after });
    return alertResponse(after);
  }

  async listRules(query: MonitoringRuleListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.MonitoringRuleWhereInput = {
      ...(query.ruleType ? { ruleType: query.ruleType } : {}),
      ...(query.active !== undefined ? { isActive: query.active } : {}),
      ...(query.q ? { OR: [{ code: { contains: query.q, mode: 'insensitive' } }, { name: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['code', 'name', 'severity', 'updatedAt'] as const, { code: 'asc' });
    return paginate(
      query,
      () => db.monitoringRule.count({ where }),
      (p) => db.monitoringRule.findMany({ where, orderBy, ...p, include: RULE_INCLUDE }),
    );
  }

  async createRule(dto: CreateMonitoringRuleDto) {
    if (dto.connectorId) await this.assertConnector(dto.connectorId);
    const created = await this.prisma.scoped().monitoringRule.create({
      data: {
        tenantId: this.ctx.tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        ruleType: dto.ruleType,
        definition: json(dto.definition),
        severity: dto.severity ?? 'MEDIUM',
        connectorId: dto.connectorId ?? null,
      },
      include: RULE_INCLUDE,
    });
    await this.audit.record({ action: 'monitoring_rule.created', targetType: 'MonitoringRule', targetId: created.id, after: created });
    return created;
  }

  async updateRule(id: string, dto: UpdateMonitoringRuleDto) {
    const db = this.prisma.scoped();
    const before = await db.monitoringRule.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Monitoring rule not found');
    if (dto.connectorId) await this.assertConnector(dto.connectorId);
    const after = await db.monitoringRule.update({
      where: { id },
      data: compact({
        code: dto.code,
        name: dto.name,
        description: dto.description,
        ruleType: dto.ruleType,
        definition: dto.definition ? json(dto.definition) : undefined,
        severity: dto.severity,
        connectorId: dto.connectorId,
        isActive: dto.isActive,
      }),
      include: RULE_INCLUDE,
    });
    await this.audit.record({ action: 'monitoring_rule.updated', targetType: 'MonitoringRule', targetId: id, before, after });
    return after;
  }

  async connectors(query: ConnectorListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.DataConnectorWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };
    return paginate(
      query,
      () => db.dataConnector.count({ where }),
      (p) =>
        db.dataConnector.findMany({
          where,
          orderBy: { name: 'asc' },
          ...p,
          select: { id: true, name: true, type: true, schedule: true, lastRunAt: true, lastStatus: true, isActive: true, createdAt: true, updatedAt: true, _count: { select: { rules: true } } },
        }),
    );
  }

  private async assertRisk(id: string) {
    const risk = await this.prisma.scoped().risk.findFirst({ where: { id, deletedAt: null } });
    if (!risk) throw new BadRequestException('Risk not found');
  }

  private async assertUser(id: string) {
    const user = await this.prisma.scoped().user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new BadRequestException('User not found');
  }

  private async assertFinding(id: string) {
    const finding = await this.prisma.scoped().finding.findFirst({ where: { id, deletedAt: null } });
    if (!finding) throw new BadRequestException('Finding not found');
  }

  private async assertConnector(id: string) {
    const connector = await this.prisma.scoped().dataConnector.findFirst({ where: { id } });
    if (!connector) throw new BadRequestException('Connector not found');
  }
}
