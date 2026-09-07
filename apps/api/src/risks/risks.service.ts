import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RiskVelocity, ScoringModel } from '@auditsphere/db';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  ratingFor,
  scoreRisk,
  ScoringWeights,
  ScoringWeightsSchema,
  Thresholds,
  ThresholdsSchema,
} from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { paginate, parseSort } from '../common/pagination';
import { compact, json, USER_SUMMARY_SELECT } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import {
  AssessRiskDto,
  CreateRiskCategoryDto,
  CreateRiskDto,
  CreateScoringModelDto,
  RiskListQueryDto,
  UpdateRiskDto,
  UpdateScoringModelDto,
} from './risks.dto';

const RISK_INCLUDE = {
  category: { select: { id: true, code: true, name: true, colour: true } },
  entity: { select: { id: true, code: true, name: true } },
  process: { select: { id: true, code: true, name: true } },
  owner: { select: USER_SUMMARY_SELECT },
  _count: { select: { controls: true, findings: true } },
} satisfies Prisma.RiskInclude;

export interface ModelParams {
  model: ScoringModel | null;
  weights: ScoringWeights;
  thresholds: Thresholds;
}

/** Parses the JSON columns of a scoring model, falling back to shared defaults. */
export function modelParams(model: ScoringModel | null): ModelParams {
  const weights = ScoringWeightsSchema.safeParse(model?.weights ?? {});
  const thresholds = ThresholdsSchema.safeParse(model?.thresholds ?? {});
  return {
    model,
    weights: weights.success ? weights.data : DEFAULT_WEIGHTS,
    thresholds: thresholds.success ? thresholds.data : DEFAULT_THRESHOLDS,
  };
}

@Injectable()
export class RisksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly audit: AuditTrailService,
  ) {}

  async defaultModel(id?: string): Promise<ModelParams> {
    const db = this.prisma.scoped();
    const model = id
      ? await db.scoringModel.findFirst({ where: { id } })
      : (await db.scoringModel.findFirst({ where: { isDefault: true } })) ?? (await db.scoringModel.findFirst({ orderBy: { createdAt: 'asc' } }));
    if (id && !model) throw new NotFoundException('Scoring model not found');
    return modelParams(model);
  }

  private computeScores(
    input: { inherentLikelihood: number; inherentImpact: number; controlEffectiveness: number; velocity: RiskVelocity; appetiteThreshold?: number | null },
    params: ModelParams,
  ) {
    const r = scoreRisk(
      {
        inherentLikelihood: input.inherentLikelihood,
        inherentImpact: input.inherentImpact,
        controlEffectiveness: input.controlEffectiveness,
        velocity: input.velocity,
        appetiteThreshold: input.appetiteThreshold ?? undefined,
      },
      params.weights,
      params.thresholds,
    );
    return {
      inherentScore: r.inherentScore,
      residualLikelihood: r.residualLikelihood,
      residualImpact: r.residualImpact,
      residualScore: r.residualScore,
      rating: r.rating,
      withinAppetite: r.withinAppetite,
    };
  }

  async list(query: RiskListQueryDto) {
    const db = this.prisma.scoped();
    const where: Prisma.RiskWhereInput = {
      deletedAt: null,
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.processId ? { processId: query.processId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { code: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy = parseSort(query.sort, ['code', 'title', 'rating', 'residualScore', 'inherentScore', 'lastAssessedAt', 'createdAt'] as const, {
      residualScore: 'desc',
    });
    return paginate(
      query,
      () => db.risk.count({ where }),
      (p) => db.risk.findMany({ where, orderBy, ...p, include: RISK_INCLUDE }),
    );
  }

  async get(id: string) {
    const risk = await this.prisma.scoped().risk.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...RISK_INCLUDE,
        assessments: { orderBy: { assessedAt: 'desc' }, take: 10, include: { assessedBy: { select: USER_SUMMARY_SELECT } } },
        controls: { include: { control: { select: { id: true, code: true, title: true, effectiveness: true, isKeyControl: true } } } },
      },
    });
    if (!risk) throw new NotFoundException('Risk not found');
    return risk;
  }

  async create(dto: CreateRiskDto) {
    const params = await this.defaultModel();
    const inputs = {
      inherentLikelihood: dto.inherentLikelihood ?? 3,
      inherentImpact: dto.inherentImpact ?? 3,
      controlEffectiveness: dto.controlEffectiveness ?? 3,
      velocity: dto.velocity ?? 'MODERATE',
      appetiteThreshold: dto.appetiteThreshold ?? null,
    };
    const created = await this.prisma.scoped().risk.create({
      data: {
        tenantId: this.ctx.tenantId,
        code: dto.code,
        title: dto.title,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        entityId: dto.entityId ?? null,
        processId: dto.processId ?? null,
        ownerId: dto.ownerId ?? null,
        source: dto.source ?? null,
        status: dto.status ?? 'ACTIVE',
        tags: dto.tags ?? [],
        ...inputs,
        ...this.computeScores(inputs, params),
      },
      include: RISK_INCLUDE,
    });
    await this.audit.record({ action: 'risk.created', targetType: 'Risk', targetId: created.id, after: created });
    return created;
  }

  async update(id: string, dto: UpdateRiskDto) {
    const db = this.prisma.scoped();
    const before = await db.risk.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('Risk not found');
    const params = await this.defaultModel();
    const inputs = {
      inherentLikelihood: dto.inherentLikelihood ?? before.inherentLikelihood,
      inherentImpact: dto.inherentImpact ?? before.inherentImpact,
      controlEffectiveness: dto.controlEffectiveness ?? before.controlEffectiveness,
      velocity: dto.velocity ?? before.velocity,
      appetiteThreshold: dto.appetiteThreshold === undefined ? (before.appetiteThreshold?.toNumber() ?? null) : dto.appetiteThreshold,
    };
    const after = await db.risk.update({
      where: { id },
      data: {
        ...compact({
          code: dto.code,
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId,
          entityId: dto.entityId,
          processId: dto.processId,
          ownerId: dto.ownerId,
          source: dto.source,
          status: dto.status,
          tags: dto.tags,
        }),
        ...inputs,
        ...this.computeScores(inputs, params),
      },
      include: RISK_INCLUDE,
    });
    await this.audit.record({ action: 'risk.updated', targetType: 'Risk', targetId: id, before, after });
    return after;
  }

  async assess(id: string, dto: AssessRiskDto) {
    const db = this.prisma.scoped();
    const risk = await db.risk.findFirst({ where: { id, deletedAt: null } });
    if (!risk) throw new NotFoundException('Risk not found');
    const params = await this.defaultModel(dto.scoringModelId);
    const inputs = {
      inherentLikelihood: dto.inherentLikelihood,
      inherentImpact: dto.inherentImpact,
      controlEffectiveness: dto.controlEffectiveness,
      velocity: dto.velocity,
      appetiteThreshold: risk.appetiteThreshold?.toNumber() ?? null,
    };
    const scores = this.computeScores(inputs, params);
    const now = new Date();
    const tenantId = this.ctx.tenantId;
    const userId = this.ctx.userId;

    const [assessment, updated] = await this.prisma.transaction(async (tx) => {
      const a = await tx.riskAssessment.create({
        data: {
          tenantId,
          riskId: id,
          scoringModelId: params.model?.id ?? null,
          periodLabel: dto.periodLabel,
          inherentLikelihood: dto.inherentLikelihood,
          inherentImpact: dto.inherentImpact,
          inherentScore: scores.inherentScore,
          controlEffectiveness: dto.controlEffectiveness,
          residualLikelihood: scores.residualLikelihood,
          residualImpact: scores.residualImpact,
          residualScore: scores.residualScore,
          velocity: dto.velocity,
          rating: scores.rating,
          rationale: dto.rationale ?? null,
          assessedById: userId,
          assessedAt: now,
        },
      });
      const r = await tx.risk.update({
        where: { id },
        data: {
          inherentLikelihood: dto.inherentLikelihood,
          inherentImpact: dto.inherentImpact,
          controlEffectiveness: dto.controlEffectiveness,
          velocity: dto.velocity,
          ...scores,
          lastAssessedAt: now,
        },
        include: RISK_INCLUDE,
      });
      return [a, r] as const;
    });
    await this.audit.record({ action: 'risk.assessed', targetType: 'Risk', targetId: id, before: risk, after: updated, metadata: { assessmentId: assessment.id } });
    return { assessment, risk: updated };
  }

  async heatmap(status?: string) {
    const db = this.prisma.scoped();
    const params = await this.defaultModel();
    const groups = await db.risk.groupBy({
      by: ['residualLikelihood', 'residualImpact'],
      where: { deletedAt: null, status: status ? (status as never) : 'ACTIVE' },
      _count: { _all: true },
    });
    const counts = new Map(groups.map((g) => [`${g.residualLikelihood}:${g.residualImpact}`, g._count._all]));
    const cells: { likelihood: number; impact: number; count: number; score: number; rating: string }[] = [];
    for (let l = 1; l <= 5; l++)
      for (let i = 1; i <= 5; i++)
        cells.push({ likelihood: l, impact: i, count: counts.get(`${l}:${i}`) ?? 0, score: l * i, rating: ratingFor(l * i, params.thresholds) });
    return { cells, thresholds: params.thresholds, scoringModelId: params.model?.id ?? null };
  }

  // ---------------------------------------------------------------------------
  // Categories and scoring models
  // ---------------------------------------------------------------------------

  listCategories() {
    return this.prisma.scoped().riskCategory.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { risks: true } } } }).then((items) => ({ items }));
  }

  async createCategory(dto: CreateRiskCategoryDto) {
    const created = await this.prisma.scoped().riskCategory.create({
      data: { tenantId: this.ctx.tenantId, code: dto.code, name: dto.name, description: dto.description ?? null, weight: dto.weight ?? 1, colour: dto.colour ?? null },
    });
    await this.audit.record({ action: 'risk_category.created', targetType: 'RiskCategory', targetId: created.id, after: created });
    return created;
  }

  listScoringModels() {
    return this.prisma.scoped().scoringModel.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }).then((items) => ({ items }));
  }

  async createScoringModel(dto: CreateScoringModelDto) {
    this.validateModelJson(dto);
    const tenantId = this.ctx.tenantId;
    const count = await this.prisma.scoped().scoringModel.count();
    const isDefault = dto.isDefault ?? count === 0;
    const created = await this.prisma.transaction(async (tx) => {
      if (isDefault) await tx.scoringModel.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.scoringModel.create({
        data: {
          tenantId,
          name: dto.name,
          isDefault,
          likelihoodScale: json(dto.likelihoodScale),
          impactScale: json(dto.impactScale),
          weights: json(dto.weights ?? DEFAULT_WEIGHTS),
          thresholds: json(dto.thresholds ?? DEFAULT_THRESHOLDS),
          appetite: json(dto.appetite ?? {}),
        },
      });
    });
    await this.audit.record({ action: 'scoring_model.created', targetType: 'ScoringModel', targetId: created.id, after: created });
    return created;
  }

  async updateScoringModel(id: string, dto: UpdateScoringModelDto) {
    this.validateModelJson(dto);
    const db = this.prisma.scoped();
    const before = await db.scoringModel.findFirst({ where: { id } });
    if (!before) throw new NotFoundException('Scoring model not found');
    const after = await this.prisma.transaction(async (tx) => {
      if (dto.isDefault) await tx.scoringModel.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      return tx.scoringModel.update({
        where: { id },
        data: compact({
          name: dto.name,
          isDefault: dto.isDefault,
          likelihoodScale: dto.likelihoodScale === undefined ? undefined : json(dto.likelihoodScale),
          impactScale: dto.impactScale === undefined ? undefined : json(dto.impactScale),
          weights: dto.weights === undefined ? undefined : json(dto.weights),
          thresholds: dto.thresholds === undefined ? undefined : json(dto.thresholds),
          appetite: dto.appetite === undefined ? undefined : json(dto.appetite),
        }),
      });
    });
    await this.audit.record({ action: 'scoring_model.updated', targetType: 'ScoringModel', targetId: id, before, after });
    return after;
  }

  private validateModelJson(dto: { weights?: Record<string, number>; thresholds?: Record<string, number> }) {
    if (dto.weights && !ScoringWeightsSchema.safeParse(dto.weights).success) throw new BadRequestException('weights must contain non-negative likelihood, impact and velocity');
    if (dto.thresholds && !ThresholdsSchema.safeParse(dto.thresholds).success) throw new BadRequestException('thresholds must contain LOW, MEDIUM, HIGH and CRITICAL numbers');
  }
}
