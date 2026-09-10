import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AI_ASSISTANT_VERSION, AI_REVIEW_NOTICE, AssistantContentSchema, type AssistantContent } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuthUser } from '../auth/auth.types';
import { AppConfigService } from '../config/app-config.service';
import { json } from '../common/utils';
import { paginate, parseSort } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { AiFeature, AiInteractionListQueryDto, CopilotRequestDto, UpdateAiInteractionDto } from './ai.dto';
import { AuditUniverseIndexService } from './audit-universe-index.service';
import { searchAuditIntelligence } from './audit-intelligence.engine';
import { AiContextService } from './ai-context.service';
import { AuditContextService } from './audit-context.service';
import { AuditContext } from './audit-context.types';
import { reviewAudit } from './audit-review.engine';
import { AUDIT_SYSTEM_PROMPT, validateProviderDraft } from './audit-provider';

function estimateTokens(value: unknown): number { return Math.max(1, Math.ceil(JSON.stringify(value).length / 4)); }
const LOCAL_MODEL = 'audit-review-rulepack-v2';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly config: AppConfigService,
    private readonly audit: AuditTrailService,
    private readonly contextDocuments: AiContextService,
    private readonly auditContext: AuditContextService,
    private readonly universeIndex: AuditUniverseIndexService,
  ) {}

  status() {
    const remote = !!(this.config.ai.enabled && this.config.ai.baseUrl && this.config.ai.apiKey);
    return { version: AI_ASSISTANT_VERSION, intelligenceSearch: true, provider: remote ? 'openai-compatible' : 'local-rulepack', model: remote ? this.config.ai.model : LOCAL_MODEL, reviewNotice: AI_REVIEW_NOTICE };
  }

  async complete(dto: CopilotRequestDto, user: AuthUser) {
    const started = Date.now();
    if ((dto.impact === undefined) !== (dto.likelihood === undefined)) throw new BadRequestException('Supply impact and likelihood together for a rating proposal.');
    const documents = await this.contextDocuments.resolve(dto.documentIds);
    const intelligence = dto.feature === AiFeature.NaturalLanguageSearch ? searchAuditIntelligence(dto, await this.universeIndex.build(user)) : undefined;
    const auditContext = intelligence?.context ?? await this.auditContext.build(dto, documents, user);
    const request = { ...dto, version: AI_ASSISTANT_VERSION, context: dto.context ?? null, target: auditContext.records.find((r) => r.source.id === auditContext.target)?.fields ?? null, documents, auditContext };
    const baseline = AssistantContentSchema.parse(intelligence?.draft ?? await reviewAudit(dto, auditContext));
    let draft = baseline;
    let provider: 'openai-compatible' | 'local-rulepack' | 'local-fallback' = 'local-rulepack';
    if (!intelligence && this.status().provider === 'openai-compatible') {
      try { draft = await this.callProvider(request, baseline, auditContext); provider = 'openai-compatible'; }
      catch { provider = 'local-fallback'; draft = { ...baseline, caveats: [...baseline.caveats, 'The model provider was unavailable or its response failed audit-format/grounding checks. A local rule-based review is shown instead.'] }; }
    }
    const model = intelligence ? 'audit-intelligence-index-v1' : provider === 'openai-compatible' ? this.config.ai.model : LOCAL_MODEL;
    const response = {
      ...draft, provider, version: AI_ASSISTANT_VERSION, reviewRequired: true as const, reviewNotice: AI_REVIEW_NOTICE,
      sources: documents.map(({ documentId, fileName, text, truncated }) => ({ documentId, fileName, characters: text.length, truncated })),
      sourceRegister: auditContext.records.map((r) => r.source), contextLinks: auditContext.links, contextWarnings: auditContext.warnings, search: auditContext.search,
    };
    const created = await this.prisma.scoped().aiInteraction.create({ data: {
      tenantId: this.ctx.tenantId, userId: user.id, feature: dto.feature, targetType: dto.targetType ?? null, targetId: dto.targetId ?? null, model,
      promptTokens: estimateTokens(request), outputTokens: estimateTokens(response), latencyMs: Date.now() - started, request: json(request), response: json(response),
    } });
    await this.audit.record({ action: 'ai.interaction_created', targetType: 'AiInteraction', targetId: created.id, after: { feature: dto.feature, model, provider, version: AI_ASSISTANT_VERSION }, metadata: { sourceIds: auditContext.records.map((r) => `${r.source.kind}:${r.source.recordId}`), reviewRequired: true } });
    return { id: created.id, createdAt: created.createdAt, model, ...response };
  }

  async list(query: AiInteractionListQueryDto, user: AuthUser) {
    // History metadata is requester-only; full snapshots undergo a new access check when opened.
    const db = this.prisma.scoped();
    const where = { userId: user.id, ...(query.feature ? { feature: query.feature } : {}) };
    const orderBy = parseSort(query.sort, ['createdAt', 'feature', 'model', 'rating'] as const, { createdAt: 'desc' });
    return paginate(query, () => db.aiInteraction.count({ where }), (p) => db.aiInteraction.findMany({ where, orderBy, ...p, select: {
      id: true, feature: true, targetType: true, targetId: true, model: true, promptTokens: true, outputTokens: true, latencyMs: true, accepted: true, rating: true, createdAt: true,
    } }));
  }

  async get(id: string, user: AuthUser) {
    const interaction = await this.prisma.scoped().aiInteraction.findFirst({ where: { id, userId: user.id } });
    if (!interaction) throw new NotFoundException('AI interaction not found');
    const request = interaction.request as unknown as CopilotRequestDto & { auditContext?: AuditContext; documents?: { documentId: string }[] };
    if (request.auditContext) {
      await this.auditContext.assertSnapshotAccess(request.auditContext, user);
      if (request.documents?.length) await this.contextDocuments.resolve(request.documents.map((d) => d.documentId));
    }
    else { const docs = await this.contextDocuments.resolve(request.documentIds ?? request.documents?.map((d) => d.documentId)); await this.auditContext.build(request, docs, user); }
    await this.audit.record({ action: 'ai.interaction_viewed', targetType: 'AiInteraction', targetId: id });
    return { ...(interaction.response as Record<string, unknown>), id: interaction.id, createdAt: interaction.createdAt, model: interaction.model, prompt: request.prompt, reviewRequired: true, reviewNotice: AI_REVIEW_NOTICE };
  }

  async feedback(id: string, dto: UpdateAiInteractionDto, user: AuthUser) {
    const db = this.prisma.scoped();
    const before = await db.aiInteraction.findFirst({ where: { id, userId: user.id } });
    if (!before) throw new NotFoundException('AI interaction not found');
    const after = await db.aiInteraction.update({ where: { id }, data: { accepted: dto.accepted, rating: dto.rating }, select: { id: true, accepted: true, rating: true } });
    await this.audit.record({ action: 'ai.feedback_recorded', targetType: 'AiInteraction', targetId: id, before: { accepted: before.accepted, rating: before.rating }, after });
    return after;
  }

  private async callProvider(request: Record<string, unknown>, baseline: AssistantContent, context: AuditContext): Promise<AssistantContent> {
    const res = await fetch(`${this.config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${this.config.ai.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.ai.model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({ ...request, outputTemplate: baseline }) },
      ] }),
    });
    if (!res.ok || !res.body) throw new Error('AI provider unavailable');
    const reader = res.body.getReader(); const decoder = new TextDecoder(); let body = ''; let size = 0;
    try {
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 512000) throw new Error('AI response exceeded size limit'); body += decoder.decode(chunk.value, { stream: true }); }
      body += decoder.decode();
    } finally { await reader.cancel(); }
    const payload = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI provider returned no content');
    return validateProviderDraft(JSON.parse(content), baseline, context);
  }
}
