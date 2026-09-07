import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ControlEffectiveness, ControlTestResult, ControlTestType, Prisma } from '@auditsphere/db';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { paginate, parseSort } from '../common/pagination';
import { compact, json, toDate, USER_SUMMARY_SELECT } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { ControlListQueryDto, CreateControlDto, CreateControlTestDto, SetControlRisksDto, UpdateControlDto, UpdateControlTestDto } from './controls.dto';

const CONTROL_INCLUDE = {
  process: { select: { id: true, code: true, name: true, entityId: true } },
  owner: { select: USER_SUMMARY_SELECT },
  risks: { include: { risk: { select: { id: true, code: true, title: true, rating: true } } } },
  _count: { select: { tests: true, findings: true } },
} satisfies Prisma.ControlInclude;

/** Maps a test outcome onto the control-level effectiveness field. */
export function effectivenessFor(result: ControlTestResult): ControlEffectiveness | null {
  switch (result) {
    case 'PASS':
      return 'EFFECTIVE';
    case 'PASS_WITH_EXCEPTIONS':
      return 'PARTIALLY_EFFECTIVE';
    case 'FAIL':
      return 'INEFFECTIVE';
    default:
      return null;
  }
}

@Injectable()
export class ControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
  ) {}

  async list(query: ControlListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.ControlWhereInput = {
      deletedAt: null,
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.riskId ? { risks: { some: { riskId: query.riskId } } } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.nature ? { nature: query.nature } : {}),
      ...(query.effectiveness ? { effectiveness: query.effectiveness } : {}),
      ...(query.isKeyControl !== undefined ? { isKeyControl: query.isKeyControl } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['code', 'title', 'effectiveness', 'frequency', 'lastTestedAt', 'createdAt'] as const, { code: 'asc' });
    return paginate(
      query,
      () => db.control.count({ where }),
      (p) => db.control.findMany({ where, orderBy, ...p, include: CONTROL_INCLUDE }),
    );
  }

  async get(id: string) {
    const control = await this.prisma.scoped().control.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...CONTROL_INCLUDE,
        tests: { orderBy: { createdAt: 'desc' }, take: 20, include: { testedBy: { select: USER_SUMMARY_SELECT }, engagement: { select: { id: true, auditNumber: true, title: true } } } },
      },
    });
    if (!control) throw new NotFoundException('Control not found');
    return control;
  }

  async create(dto: CreateControlDto) {
    const tenantId = this.ctx.tenantId;
    if (dto.riskIds?.length) await this.assertRisks(dto.riskIds);
    const created = await this.prisma.scoped().control.create({
      data: {
        tenantId,
        code: dto.code,
        title: dto.title,
        description: dto.description ?? null,
        processId: dto.processId ?? null,
        ownerId: dto.ownerId ?? null,
        frequency: dto.frequency ?? 'MONTHLY',
        type: dto.type ?? 'PREVENTIVE',
        nature: dto.nature ?? 'MANUAL',
        isKeyControl: dto.isKeyControl ?? false,
        frameworkReferences: json(dto.frameworkReferences ?? []),
        risks: dto.riskIds?.length ? { create: dto.riskIds.map((riskId) => ({ tenantId, riskId })) } : undefined,
      },
      include: CONTROL_INCLUDE,
    });
    await this.audit.record({ action: 'control.created', targetType: 'Control', targetId: created.id, after: created });
    return created;
  }

  async update(id: string, dto: UpdateControlDto) {
    const db = this.prisma.scoped();
    const before = await db.control.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Control not found');
    const after = await db.control.update({
      where: { id },
      data: compact({
        code: dto.code,
        title: dto.title,
        description: dto.description,
        processId: dto.processId,
        ownerId: dto.ownerId,
        frequency: dto.frequency,
        type: dto.type,
        nature: dto.nature,
        isKeyControl: dto.isKeyControl,
        isActive: dto.isActive,
        effectiveness: dto.effectiveness,
        frameworkReferences: dto.frameworkReferences === undefined ? undefined : json(dto.frameworkReferences),
      }),
      include: CONTROL_INCLUDE,
    });
    if (dto.riskIds) await this.setRisks(id, { riskIds: dto.riskIds });
    await this.audit.record({ action: 'control.updated', targetType: 'Control', targetId: id, before, after });
    return after;
  }

  async setRisks(id: string, dto: SetControlRisksDto) {
    const db = this.prisma.scoped();
    const control = await db.control.findFirst({ where: { id, deletedAt: null }, include: { risks: true } });
    if (!control) throw new NotFoundException('Control not found');
    const riskIds = Array.from(new Set(dto.riskIds));
    await this.assertRisks(riskIds);
    const tenantId = this.ctx.tenantId;
    await this.prisma.transaction(async (tx) => {
      await tx.riskControl.deleteMany({ where: { controlId: id } });
      if (riskIds.length) await tx.riskControl.createMany({ data: riskIds.map((riskId) => ({ tenantId, riskId, controlId: id })) });
    });
    await this.audit.record({
      action: 'control.risks_set',
      targetType: 'Control',
      targetId: id,
      before: { riskIds: control.risks.map((r) => r.riskId) },
      after: { riskIds },
    });
    return this.get(id);
  }

  private async assertRisks(riskIds: string[]) {
    if (!riskIds.length) return;
    const found = await this.prisma.scoped().risk.count({ where: { id: { in: riskIds }, deletedAt: null } });
    if (found !== new Set(riskIds).size) throw new BadRequestException('One or more risks were not found');
  }

  // ---------------------------------------------------------------------------
  // Tests
  // ---------------------------------------------------------------------------

  async createTest(controlId: string, dto: CreateControlTestDto) {
    const db = this.prisma.scoped();
    const control = await db.control.findFirst({ where: { id: controlId, deletedAt: null } });
    if (!control) throw new NotFoundException('Control not found');
    const created = await db.controlTest.create({
      data: {
        tenantId: this.ctx.tenantId,
        controlId,
        engagementId: dto.engagementId ?? null,
        workpaperId: dto.workpaperId ?? null,
        testType: dto.testType,
        periodStart: toDate(dto.periodStart) ?? null,
        periodEnd: toDate(dto.periodEnd) ?? null,
        populationSize: dto.populationSize ?? null,
        sampleSize: dto.sampleSize ?? null,
        exceptions: dto.exceptions ?? 0,
        result: dto.result ?? 'NOT_STARTED',
        procedure: dto.procedure ?? null,
        conclusion: dto.conclusion ?? null,
        remediation: dto.remediation ?? null,
        testedById: this.ctx.userId,
        testedAt: toDate(dto.testedAt) ?? (dto.result && dto.result !== 'NOT_STARTED' && dto.result !== 'IN_PROGRESS' ? new Date() : null),
      },
    });
    await this.applyTestOutcome(controlId, created.testType, created.result, created.testedAt);
    await this.audit.record({ action: 'control_test.created', targetType: 'ControlTest', targetId: created.id, after: created });
    return created;
  }

  async updateTest(id: string, dto: UpdateControlTestDto) {
    const db = this.prisma.scoped();
    const before = await db.controlTest.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Control test not found');
    const after = await db.controlTest.update({
      where: { id },
      data: compact({
        engagementId: dto.engagementId,
        workpaperId: dto.workpaperId,
        testType: dto.testType,
        periodStart: toDate(dto.periodStart),
        periodEnd: toDate(dto.periodEnd),
        populationSize: dto.populationSize,
        sampleSize: dto.sampleSize,
        exceptions: dto.exceptions,
        result: dto.result,
        procedure: dto.procedure,
        conclusion: dto.conclusion,
        remediation: dto.remediation,
        testedAt: toDate(dto.testedAt) ?? (dto.result && dto.result !== before.result && !before.testedAt ? new Date() : undefined),
        testedById: dto.result && dto.result !== before.result ? this.ctx.userId : undefined,
      }),
    });
    if (after.result !== before.result) await this.applyTestOutcome(after.controlId, after.testType, after.result, after.testedAt);
    await this.audit.record({ action: 'control_test.updated', targetType: 'ControlTest', targetId: id, before, after });
    return after;
  }

  private async applyTestOutcome(controlId: string, testType: ControlTestType, result: ControlTestResult, testedAt: Date | null) {
    const effectiveness = effectivenessFor(result);
    if (!effectiveness) return;
    const passed = result === 'PASS';
    await this.prisma.scoped().control.update({
      where: { id: controlId },
      data: {
        effectiveness,
        lastTestedAt: testedAt ?? new Date(),
        ...(testType === 'DESIGN' ? { designEffective: passed } : { operatingEffective: passed }),
      },
    });
  }
}
