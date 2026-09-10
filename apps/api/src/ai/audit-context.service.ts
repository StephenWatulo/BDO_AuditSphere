import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AI_TARGET_TYPES, type AuditSourceKind, type AiTargetType } from '@auditsphere/shared';
import { AuthUser } from '../auth/auth.types';
import { isAuditFunction } from '../collaboration/comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { AiContextSource } from './ai-context.service';
import { AiFeature, CopilotRequestDto } from './ai.dto';
import { AuditContext, AuditRecord, field, recordsOf } from './audit-context.types';
import { interpretAuditSearch, AuditSearchFilters } from './audit-search';

export const AUDIT_READ_PERMISSION: Record<AuditSourceKind, string> = { ActionPlan: 'finding:read', ReviewNote: 'workpaper:read', Entity: 'universe:read', Process: 'universe:read', Risk: 'risk:read', Control: 'control:read', Procedure: 'workpaper:read', Engagement: 'engagement:read', Workpaper: 'workpaper:read', Evidence: 'document:read', Finding: 'finding:read', Document: 'document:read', ControlTest: 'control:read', Comment: 'ai:use', RiskSignal: 'monitoring:read', Metrics: 'finding:read', ScoringModel: 'risk:read', UserContext: 'ai:use' };
const PARENTS: [string, AuditSourceKind][] = [['entityId', 'Entity'], ['processId', 'Process'], ['riskId', 'Risk'], ['controlId', 'Control'], ['engagementId', 'Engagement'], ['programStepId', 'Procedure'], ['workpaperId', 'Workpaper'], ['documentId', 'Document']];
const LIMIT = 80;
const CHARACTER_LIMIT = 140000;
type Filter = { index?: boolean; afterId?: string; ids?: string[]; engagementIds?: string[]; entityIds?: string[]; processIds?: string[]; workpaperIds?: string[]; controlIds?: string[]; riskIds?: string[]; procedureIds?: string[]; findingIds?: string[]; search?: AuditSearchFilters; take?: number };
const inIds = (ids?: string[]) => ids ? { in: ids } : undefined;
const contains = (term: string) => ({ contains: term, mode: 'insensitive' as const });
const textSearch = (fields: string[], search?: AuditSearchFilters) => search?.terms.length ? { AND: search.terms.map((term) => ({ OR: fields.map((key) => ({ [key]: contains(term) })) })) } : {};

export function href(kind: AuditSourceKind, r: Record<string, unknown>): string | undefined {
  const id = String(r.id);
  if (kind === 'Entity') return `/universe?entity=${id}`;
  if (kind === 'Process') return `/universe?entity=${r.entityId}`;
  if (kind === 'Risk') return `/risks?risk=${id}`;
  if (kind === 'Control' || kind === 'ControlTest') return `/controls?control=${kind === 'Control' ? id : r.controlId}`;
  if (kind === 'Engagement') return `/engagements/${id}`;
  if (kind === 'Workpaper') return `/workpapers/${id}`;
  if (kind === 'Finding') return `/findings/${id}`;
  if (kind === 'ActionPlan') return `/findings/${r.findingId}?tab=recommendations`;
  if (kind === 'ReviewNote') return `/workpapers/${r.workpaperId}`;
  if (kind === 'Evidence') return `/engagements/${r.engagementId}?tab=evidence`;
  if (kind === 'Procedure') return `/engagements/${r.engagementId}?tab=programme`;
  if (kind === 'RiskSignal') return '/monitoring';
  return undefined;
}

@Injectable()
export class AuditContextService {
  constructor(private readonly prisma: PrismaService, private readonly ctx: TenantContext) {}

  private has(kind: AuditSourceKind, user: AuthUser) { return user.permissions.includes(AUDIT_READ_PERMISSION[kind]); }

  private documentWhere(user: AuthUser): Prisma.DocumentWhereInput {
    return { deletedAt: null, isQuarantined: false, uploadedAt: { not: null },
      ...(!user.permissions.includes('document:restricted') ? { classification: { not: 'RESTRICTED' } } : {}),
      OR: [{ ownerType: null }, { ownerType: { not: 'AiContext' } }, { ownerType: 'AiContext', ownerId: user.id, uploadedById: user.id }],
    };
  }

  /** All reads use the tenant-scoped client, explicit columns and module permissions. */
  async fetch(kind: AuditSourceKind, f: Filter, user: AuthUser): Promise<Record<string, unknown>[]> {
    if (!this.has(kind, user)) return [];
    const db = this.prisma.scoped();
    const take = Math.min(f.take ?? 30, f.index ? 250 : LIMIT);
    const id = f.ids ? { id: { in: f.ids } } : f.afterId ? { id: { gt: f.afterId } } : {};
    const active = { ...id, deletedAt: null };
    const dates = f.search?.from ? { gte: new Date(f.search.from), ...(f.search.to ? { lt: new Date(f.search.to) } : {}) } : undefined;
    const testFilter: Prisma.ControlTestWhereInput = { ...(dates ? { testedAt: dates } : {}), ...(f.search?.exceptionsOnly ? { exceptions: { gt: 0 } } : {}) };
    switch (kind) {
      case 'Entity': return db.auditEntity.findMany({ where: { ...active, ...textSearch(['name', 'code', 'description'], f.search) }, take, orderBy: f.index ? { id: 'asc' } : { code: 'asc' }, select: { id: true, parentId: true, ownerId: true, type: true, code: true, name: true, description: true, country: true, strategicObjectives: true, regulatoryRequirements: true, riskRating: true, lastAuditDate: true, updatedAt: true } });
      case 'Process': return db.process.findMany({ where: { ...active, entityId: inIds(f.entityIds), ...textSearch(['name', 'code', 'description'], f.search) }, take, orderBy: f.index ? { id: 'asc' } : { code: 'asc' }, select: { id: true, ownerId: true, entityId: true, code: true, name: true, description: true, category: true, isKey: true, updatedAt: true } });
      case 'Engagement': return db.engagement.findMany({ where: { ...active, entityId: inIds(f.entityIds), ...(dates ? { createdAt: dates } : {}), ...textSearch(['title', 'auditNumber', 'scope', 'objectives'], f.search) }, take, orderBy: f.index ? { id: 'asc' } : { createdAt: 'desc' }, select: { id: true, type: true, leadId: true, managerId: true, partnerId: true, actualEnd: true, members: f.index ? { where: { tenantId: this.ctx.tenantId }, select: { userId: true, role: true } } : false, auditNumber: true, title: true, entityId: true, objectives: true, scope: true, outOfScope: true, background: true, periodStart: true, periodEnd: true, stage: true, status: true, opinion: true, executiveSummary: true, reportIssuedAt: true } });
      case 'Risk': return db.risk.findMany({ where: { ...active, entityId: inIds(f.entityIds), processId: inIds(f.processIds), ...textSearch(['title', 'code', 'description'], f.search) }, take, orderBy: f.index ? { id: 'asc' } : { residualScore: 'desc' }, select: { id: true, ownerId: true, code: true, title: true, description: true, entityId: true, processId: true, inherentImpact: true, inherentLikelihood: true, residualImpact: true, residualLikelihood: true, residualScore: true, rating: true, status: true, lastAssessedAt: true, updatedAt: true } });
      case 'Control': {
        const words = f.search?.terms.map((term) => ({ OR: [{ title: contains(term) }, { code: contains(term) }, { description: contains(term) }, ...(this.has('Process', user) ? [{ process: { tenantId: this.ctx.tenantId, deletedAt: null, OR: [{ name: contains(term) }, { description: contains(term) }] } }] : [])] })) ?? [];
        return db.control.findMany({ where: { ...active, processId: inIds(f.processIds), ...(f.riskIds ? { risks: { some: { tenantId: this.ctx.tenantId, riskId: { in: f.riskIds } } } } : {}), ...(words.length ? { AND: words } : {}), ...(dates || f.search?.exceptionsOnly ? { tests: { some: { tenantId: this.ctx.tenantId, ...testFilter } } } : {}) }, take, orderBy: f.index ? { id: 'asc' } : { code: 'asc' }, select: { id: true, ownerId: true, risks: f.index && this.has('Risk', user) ? { where: { tenantId: this.ctx.tenantId, risk: { tenantId: this.ctx.tenantId, deletedAt: null } }, select: { riskId: true } } : false, code: true, title: true, description: true, processId: true, frequency: true, nature: true, type: true, effectiveness: true, designEffective: true, operatingEffective: true, lastTestedAt: true, frameworkReferences: true, isKeyControl: true, isActive: true } });
      }
      case 'Workpaper': return db.workpaper.findMany({ where: { ...active, engagementId: inIds(f.engagementIds), controlId: inIds(f.controlIds), riskId: inIds(f.riskIds), programStepId: inIds(f.procedureIds), engagement: { tenantId: this.ctx.tenantId, deletedAt: null }, ...(dates ? { updatedAt: dates } : {}), ...textSearch(['title', 'reference', 'objective', 'procedure', 'results', 'exceptions', 'conclusion'], f.search) }, take, orderBy: f.index ? { id: 'asc' } : { updatedAt: 'desc' }, select: { id: true, updatedAt: true, createdAt: true, reference: true, title: true, engagementId: true, programStepId: true, riskId: true, controlId: true, objective: true, procedure: true, testPerformed: true, results: true, exceptions: true, conclusion: true, status: true, preparedById: true, reviewedById: true, preparedAt: true, reviewedAt: true } });
      case 'Finding': return db.finding.findMany({ where: { ...active, engagementId: inIds(f.engagementIds), workpaperId: inIds(f.workpaperIds), controlId: inIds(f.controlIds), riskId: inIds(f.riskIds), processId: inIds(f.processIds), engagement: { tenantId: this.ctx.tenantId, deletedAt: null }, ...(dates ? { createdAt: dates } : {}), ...textSearch(['title', 'reference', 'condition', 'criteria', 'cause', 'impact', 'recommendation'], f.search) }, take, orderBy: f.index ? { id: 'asc' } : { createdAt: 'desc' }, select: { id: true, createdAt: true, closedAt: true, agreedAt: true, implementedAt: true, validatedAt: true, reference: true, title: true, engagementId: true, entityId: true, processId: true, workpaperId: true, riskId: true, controlId: true, condition: true, criteria: true, cause: true, impact: true, recommendation: true, managementResponse: true, rootCauseCategory: true, actionOwnerName: true, actionOwnerId: true, dueDate: true, severity: true, status: true, isRepeat: true, repeatOfId: true } });
      case 'Evidence': {
        const documentFilter = { tenantId: this.ctx.tenantId, ...this.documentWhere(user) };
        return db.evidence.findMany({ where: { ...id, engagementId: inIds(f.engagementIds), workpaperId: inIds(f.workpaperIds), engagement: { tenantId: this.ctx.tenantId, deletedAt: null }, AND: [{ OR: [{ documentId: null }, { document: documentFilter }] }, ...(f.search?.terms.map((term) => ({ OR: [{ description: contains(term) }, { reference: contains(term) }, { document: { AND: [documentFilter, { OR: [{ fileName: contains(term) }, { extractedText: contains(term) }] }] } }] })) ?? [])], ...(f.findingIds ? { findings: { some: { tenantId: this.ctx.tenantId, id: { in: f.findingIds }, deletedAt: null } } } : {}), ...(dates ? { obtainedAt: dates } : {}) }, take, orderBy: f.index ? { id: 'asc' } : { createdAt: 'desc' }, select: { id: true, findings: f.index && this.has('Finding', user) ? { where: { tenantId: this.ctx.tenantId, deletedAt: null, engagement: { tenantId: this.ctx.tenantId, deletedAt: null } }, select: { id: true } } : false, reference: true, description: true, engagementId: true, workpaperId: true, documentId: true, type: true, obtainedFrom: true, obtainedAt: true, isSufficient: true } });
      }
      case 'Document': return db.document.findMany({ where: { ...id, ...this.documentWhere(user) }, take, orderBy: f.index ? { id: 'asc' } : { createdAt: 'desc' }, select: { id: true, fileName: true, extractedText: true, checksumSha256: true, currentVersion: true, tags: true, uploadedAt: true, ownerType: true, ownerId: true } });
      case 'Procedure': return (await db.auditProgramStep.findMany({ where: { ...id, ...(f.engagementIds ? { program: { tenantId: this.ctx.tenantId, engagementId: { in: f.engagementIds }, engagement: { tenantId: this.ctx.tenantId, deletedAt: null } } } : { program: { tenantId: this.ctx.tenantId, engagement: { tenantId: this.ctx.tenantId, deletedAt: null } } }), ...textSearch(['reference', 'objective', 'procedure'], f.search) }, take, orderBy: f.index ? { id: 'asc' } : { sortOrder: 'asc' }, select: { id: true, reference: true, objective: true, procedure: true, riskId: true, controlId: true, status: true, program: { select: { engagementId: true } } } })).map(({ program, ...step }) => ({ ...step, engagementId: program.engagementId }));
      case 'ControlTest': return db.controlTest.findMany({ where: { ...id, controlId: inIds(f.controlIds), workpaperId: inIds(f.workpaperIds), engagementId: inIds(f.engagementIds), control: { tenantId: this.ctx.tenantId, deletedAt: null }, AND: [{ OR: [{ engagementId: null }, { engagement: { tenantId: this.ctx.tenantId, deletedAt: null } }] }, { OR: [{ workpaperId: null }, { workpaper: { tenantId: this.ctx.tenantId, deletedAt: null, engagement: { tenantId: this.ctx.tenantId, deletedAt: null } } }] }], ...testFilter }, take, orderBy: f.index ? { id: 'asc' } : { testedAt: 'desc' }, select: { id: true, controlId: true, workpaperId: true, engagementId: true, testType: true, periodStart: true, periodEnd: true, populationSize: true, sampleSize: true, exceptions: true, result: true, procedure: true, conclusion: true, testedAt: true } });
      case 'RiskSignal': return db.riskSignal.findMany({ where: { ...id, ...(f.riskIds ? { riskId: { in: f.riskIds } } : {}), status: { not: 'DISMISSED' } }, take, orderBy: f.index ? { id: 'asc' } : { createdAt: 'desc' }, select: { id: true, title: true, summary: true, source: true, riskId: true, publishedAt: true, status: true } });
      case 'ActionPlan': return db.recommendation.findMany({ where: { ...id, finding: { tenantId: this.ctx.tenantId, deletedAt: null, engagement: { tenantId: this.ctx.tenantId, deletedAt: null } } }, take, orderBy: { id: 'asc' }, select: { id: true, findingId: true, sequence: true, text: true, priority: true, ownerId: true, ownerName: true, dueDate: true, status: true, actionPlan: true, progressNote: true, progressPct: true, completedAt: true, updatedAt: true } });
      case 'ReviewNote': return db.reviewNote.findMany({ where: { ...id, workpaper: { tenantId: this.ctx.tenantId, deletedAt: null, engagement: { tenantId: this.ctx.tenantId, deletedAt: null } } }, take, orderBy: { id: 'asc' }, select: { id: true, workpaperId: true, text: true, response: true, status: true, priority: true, createdAt: true, clearedAt: true } });
      case 'Comment': return db.comment.findMany({ where: { ...active, ...(isAuditFunction(user) ? {} : { isInternal: false }), targetType: { in: AI_TARGET_TYPES.filter((type) => this.has(type, user)) } }, take, orderBy: { id: 'asc' }, select: { id: true, targetId: true, targetType: true, body: true, createdAt: true, isInternal: true } });
      default: return [];
    }
  }

  async targets(kind: string, q: string, user: AuthUser) {
    if (!(AI_TARGET_TYPES as readonly string[]).includes(kind)) throw new BadRequestException('Unsupported audit target');
    if (!this.has(kind as AiTargetType, user)) throw new ForbiddenException('You do not have permission to read this target type');
    const records = await this.fetch(kind as AiTargetType, { search: { terms: q.trim() ? [q.trim()] : [], exceptionsOnly: false, controlsOnly: false }, take: 20 }, user);
    return { items: records.map((r) => ({ id: r.id, label: [r.auditNumber ?? r.reference ?? r.code, r.title ?? r.name ?? r.description ?? r.objective].filter(Boolean).join(' - ') })) };
  }

  async build(dto: CopilotRequestDto, documents: AiContextSource[], user: AuthUser): Promise<AuditContext> {
    const context: AuditContext = { records: [], links: [], warnings: [] };
    const byKey = new Map<string, AuditRecord>();
    let characters = 0;
    const warn = (message: string) => { if (!context.warnings.includes(message)) context.warnings.push(message); };
    const add = (kind: AuditSourceKind, raw: Record<string, unknown>): AuditRecord | undefined => {
      const key = `${kind}:${raw.id}`;
      if (byKey.has(key)) return byKey.get(key);
      if (context.records.length >= LIMIT || characters >= CHARACTER_LIMIT) { warn('Context is bounded to 80 sources and 140,000 characters. Results and relationship coverage may be incomplete.'); return; }
      // Decimal/Date serialization is delegated to their native JSON conversion.
      const fields = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
      let truncated = false;
      for (const [key, value] of Object.entries(fields)) if (typeof value === 'string' && value.length > 12000) { fields[key] = value.slice(0, 12000); truncated = true; }
      truncated ||= Array.isArray(fields.tags) && fields.tags.includes('ai-context:truncated');
      const serialized = JSON.stringify(fields);
      if (characters + serialized.length > CHARACTER_LIMIT) { warn('Context character limit reached; not all linked records were reviewed.'); return; }
      characters += serialized.length;
      const preview = Object.entries(fields).filter(([key, value]) => key !== 'id' && !key.endsWith('Id') && value !== null && value !== '').map(([key, value]) => `${key.replace(/([a-z])([A-Z])/g, '$1 $2')}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}`).join('\n');
      const record: AuditRecord = { fields, source: { id: `S${context.records.length + 1}`, kind, recordId: String(fields.id), label: [fields.auditNumber ?? fields.reference ?? fields.code, fields.title ?? fields.name ?? fields.fileName ?? fields.description ?? fields.objective ?? kind].filter(Boolean).join(' - ').slice(0, 300), href: href(kind, fields), excerpt: preview.slice(0, 1800), truncated } };
      byKey.set(key, record); context.records.push(record);
      if (truncated) warn('Some sources are excerpts. Review their originals before assessing evidence sufficiency.');
      return record;
    };
    const load = async (kind: AuditSourceKind, filter: Filter) => {
      if (!this.has(kind, user)) { warn(`${kind} context omitted because the required read permission is unavailable.`); return []; }
      const rows = await this.fetch(kind, filter, user);
      if (rows.length >= (filter.take ?? 30)) warn(`${kind} retrieval reached its limit; this is not an exhaustive population.`);
      return rows.map((r) => add(kind, r)).filter((r): r is AuditRecord => !!r);
    };
    if (dto.context?.trim()) add('UserContext', { id: 'supplied-context', title: 'Auditor-supplied context (unverified)', text: dto.context.trim() });
    if (dto.impact !== undefined || dto.populationSize !== undefined) add('UserContext', { id: 'draft-parameters', title: 'Auditor-supplied draft parameters (unverified)', impact: dto.impact, likelihood: dto.likelihood, ratingRationale: dto.ratingRationale, populationSize: dto.populationSize });
    for (const doc of documents) add('Document', { id: doc.documentId, fileName: doc.fileName, extractedText: doc.text, tags: doc.truncated ? ['ai-context:truncated'] : [] });
    if (!!dto.targetType !== !!dto.targetId) throw new BadRequestException('targetType and targetId must be supplied together');
    let root: AuditRecord | undefined;
    if (dto.targetType && dto.targetId) {
      if (!(AI_TARGET_TYPES as readonly string[]).includes(dto.targetType)) throw new BadRequestException('Unsupported AI target type');
      if (!this.has(dto.targetType as AiTargetType, user)) throw new ForbiddenException('You do not have permission to read this target');
      [root] = await load(dto.targetType as AiTargetType, { ids: [dto.targetId] });
      if (!root) throw new NotFoundException('Audit target not found or unavailable');
      context.target = root.source.id;
    }
    const addMetrics = async (engagement: AuditRecord) => {
      if (!this.has('Finding', user) || byKey.has(`Metrics:${engagement.source.recordId}`)) return;
      const metrics = await this.prisma.scoped().finding.groupBy({ by: ['severity', 'status'], where: { engagementId: engagement.source.recordId, deletedAt: null }, _count: { _all: true } });
      add('Metrics', { id: engagement.source.recordId, title: 'Complete finding counts for selected audit', engagementId: engagement.source.recordId, counts: metrics.map((m) => ({ severity: m.severity, status: m.status, count: m._count._all })) });
    };
    if (root?.source.kind === 'Engagement') await addMetrics(root);
    if (dto.feature === AiFeature.NaturalLanguageSearch) {
      const search = interpretAuditSearch(dto.prompt);
      const kinds: AuditSourceKind[] = search.controlsOnly ? ['Control'] : ['Finding', 'Workpaper', 'Evidence', 'Engagement', 'Risk', 'Control'];
      const matches: AuditRecord[] = [];
      for (const kind of kinds) matches.push(...await load(kind, { search, take: 10, ...(root?.source.kind === 'Engagement' && ['Finding', 'Workpaper', 'Evidence'].includes(kind) ? { engagementIds: [root.source.recordId] } : {}) }));
      if (!search.controlsOnly && search.terms.length) {
        const comments = await this.prisma.scoped().comment.findMany({ where: { deletedAt: null, ...(isAuditFunction(user) ? {} : { isInternal: false }), ...(search.from ? { createdAt: { gte: new Date(search.from), ...(search.to ? { lt: new Date(search.to) } : {}) } } : {}), ...textSearch(['body'], search) }, take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, body: true, targetId: true, targetType: true, isInternal: true, createdAt: true } });
        for (const comment of comments) {
          if (!(AI_TARGET_TYPES as readonly string[]).includes(comment.targetType) || !this.has(comment.targetType as AiTargetType, user)) continue;
          const [parent] = await load(comment.targetType as AiTargetType, { ids: [comment.targetId] });
          if (!parent) continue;
          const record = add('Comment', { ...comment, title: `Comment on ${parent.source.label}` });
          if (record) { record.source.href = parent.source.href; matches.push(record); context.links.push({ from: parent.source.id, to: record.source.id, relationship: 'comment' }); }
        }
      }
      context.search = { ...search, interpretation: `Read-only keyword and relationship search. ${search.from ? `Date range: ${search.from.slice(0, 10)} to ${search.to?.slice(0, 10)} (end exclusive); last year means the rolling previous 12 months. ` : ''}${search.controlsOnly ? 'Control tests are filtered by tested date and recorded exception count. ' : 'Dates use record creation/update or evidence-obtained dates. '}${root ? 'The selected target adds context; only finding/workpaper/evidence matches are engagement-scoped when an engagement is selected. ' : ''}Matches require all displayed keywords.`, results: matches.map((r) => ({ sourceId: r.source.id, reason: 'Matched explicit search filters' })) };
      warn('Search is a bounded keyword/relationship search, not an exhaustive semantic or OCR search. A missing result is not evidence of absence.');
    } else if (dto.feature === AiFeature.RiskRadar && !root) {
      await load('Risk', { take: 20 }); await load('RiskSignal', { take: 10 });
    }
    const initial = [...context.records];
    for (const r of initial) {
      const ids = [r.source.recordId];
      switch (r.source.kind) {
        case 'Engagement': if (r === root) { await load('Workpaper', { engagementIds: ids, take: 15 }); await load('Finding', { engagementIds: ids, take: 15 }); await load('Evidence', { engagementIds: ids, take: 15 }); await load('Procedure', { engagementIds: ids, take: 10 }); } break;
        case 'Entity': await load('Process', { entityIds: ids, take: 10 }); await load('Risk', { entityIds: ids, take: 15 }); await load('Engagement', { entityIds: ids, take: 5 }); break;
        case 'Process': await load('Risk', { processIds: ids, take: 10 }); await load('Control', { processIds: ids, take: 15 }); break;
        case 'Risk': await load('Control', { riskIds: ids, take: 10 }); await load('Finding', { riskIds: ids, take: 5 }); break;
        case 'Control': await load('ControlTest', { controlIds: ids, search: context.search ? interpretAuditSearch(dto.prompt) : undefined, take: 10 }); await load('Workpaper', { controlIds: ids, take: 10 }); await load('Finding', { controlIds: ids, take: 5 }); break;
        case 'Procedure': await load('Workpaper', { procedureIds: ids, take: 10 }); break;
        case 'Finding': { const linked = await load('Evidence', { findingIds: ids, take: 10 }); for (const e of linked) context.links.push({ from: r.source.id, to: e.source.id, relationship: 'supported by' }); break; }
      }
    }
    // Walk foreign keys upward in batches so a workpaper inherits its audit/risk/control context.
    const expanded = new Set<string>();
    for (let round = 0; round < 6; round++) {
      const pending = context.records.filter((r) => !expanded.has(r.source.id));
      if (!pending.length || context.records.length >= LIMIT) break;
      pending.forEach((r) => expanded.add(r.source.id));
      for (const [key, kind] of PARENTS) {
        const ids = Array.from(new Set(pending.map((r) => field(r, key)).filter((id) => id && !byKey.has(`${kind}:${id}`))));
        if (ids.length) await load(kind, { ids });
      }
      if (dto.feature === AiFeature.RiskRadar || root?.source.kind === 'Entity') {
        const riskIds = pending.filter((r) => r.source.kind === 'Risk').map((r) => r.source.recordId);
        if (riskIds.length) { await load('Control', { riskIds, take: 15 }); await load('Finding', { riskIds, take: 10 }); await load('RiskSignal', { riskIds, take: 10 }); }
        const processIds = pending.filter((r) => r.source.kind === 'Process').map((r) => r.source.recordId);
        if (processIds.length) await load('Control', { processIds, take: 15 });
        const entityIds = pending.filter((r) => r.source.kind === 'Entity').map((r) => r.source.recordId);
        if (entityIds.length) await load('Engagement', { entityIds, take: 5 });
      }
      const controls = pending.filter((r) => r.source.kind === 'Control');
      if (controls.length && this.has('Risk', user)) {
        const links = await this.prisma.scoped().riskControl.findMany({ where: { controlId: { in: controls.map((r) => r.source.recordId) }, risk: { tenantId: this.ctx.tenantId, deletedAt: null } }, select: { riskId: true, controlId: true }, take: 100 });
        if (links.length === 100) warn('Risk-control relationship retrieval was limited to 100 links.');
        await load('Risk', { ids: Array.from(new Set(links.map((l) => l.riskId))) });
        for (const link of links) { const risk = byKey.get(`Risk:${link.riskId}`); const control = byKey.get(`Control:${link.controlId}`); if (risk && control) context.links.push({ from: risk.source.id, to: control.source.id, relationship: 'mitigated by' }); }
      }
      const workpapers = pending.filter((r) => r.source.kind === 'Workpaper').map((r) => r.source.recordId);
      if (workpapers.length) { await load('Evidence', { workpaperIds: workpapers, take: 20 }); await load('Finding', { workpaperIds: workpapers, take: 10 }); await load('ControlTest', { workpaperIds: workpapers, take: 10 }); }
    }
    for (const r of context.records) for (const [key, kind] of PARENTS) {
      const parent = byKey.get(`${kind}:${field(r, key)}`);
      if (parent) context.links.push({ from: parent.source.id, to: r.source.id, relationship: key.replace('Id', '') });
    }
    if (context.records.length < LIMIT && isAuditFunction(user)) {
      const targets = context.records.filter((r) => ['Engagement', 'Workpaper', 'Finding', 'Risk', 'Control'].includes(r.source.kind));
      const comments = targets.length ? await this.prisma.scoped().comment.findMany({ where: { deletedAt: null, OR: targets.map((r) => ({ targetType: r.source.kind, targetId: r.source.recordId })) }, take: 15, orderBy: { createdAt: 'desc' }, select: { id: true, targetType: true, targetId: true, body: true, createdAt: true, isInternal: true } }) : [];
      for (const c of comments) {
        const added = add('Comment', { ...c, title: `Comment on ${c.targetType}` }); const parent = byKey.get(`${c.targetType}:${c.targetId}`);
        if (added && parent) { added.source.href = parent.source.href; context.links.push({ from: parent.source.id, to: added.source.id, relationship: 'comment' }); }
      }
    }
    const engagement = root?.source.kind === 'Engagement' ? root : recordsOf(context, 'Engagement')[0];
    if (engagement) await addMetrics(engagement);
    if (this.has('Risk', user) && recordsOf(context, 'Risk').length) {
      const model = await this.prisma.scoped().scoringModel.findFirst({ where: { isDefault: true }, select: { id: true, name: true, thresholds: true, likelihoodScale: true, impactScale: true } });
      if (model) add('ScoringModel', model);
    }
    if (!root && dto.feature !== AiFeature.NaturalLanguageSearch && dto.feature !== AiFeature.RiskRadar) warn('No audit target selected. Recommendations use only the supplied context; hierarchy and test coverage are not established.');
    if (context.search) for (const r of context.records) if (['Engagement', 'Workpaper', 'Evidence', 'Finding', 'Comment', 'Document'].includes(r.source.kind) && !context.search.results.some((s) => s.sourceId === r.source.id)) context.search.results.push({ sourceId: r.source.id, reason: 'Related context; not independently matched to every search filter' });
    return context;
  }

  async assertSnapshotAccess(context: AuditContext, user: AuthUser) {
    if (context.search?.intelligence) {
      const previousRestricted = context.search.intelligence.restrictedKinds;
      for (const [kind, permission] of Object.entries(AUDIT_READ_PERMISSION)) if (!previousRestricted.includes(kind) && !user.permissions.includes(permission) && !['RiskSignal', 'Metrics', 'ScoringModel', 'UserContext'].includes(kind)) throw new ForbiddenException('Search coverage includes a module you can no longer read. Run a new search.');
    }
    for (const record of context.records) {
      const { kind, recordId } = record.source;
      if (!this.has(kind, user)) throw new ForbiddenException('A source in this interaction is no longer readable with your permissions.');
      if (kind === 'UserContext') continue;
      if (kind === 'Metrics') { if (!(await this.fetch('Engagement', { ids: [recordId] }, user)).length) throw new ForbiddenException('The source engagement is unavailable.'); continue; }
      if (kind === 'ScoringModel') continue;
      if (kind === 'Comment') {
        const comment = await this.prisma.scoped().comment.findFirst({ where: { id: recordId, deletedAt: null, ...(isAuditFunction(user) ? {} : { isInternal: false }) } });
        if (!comment || !(AI_TARGET_TYPES as readonly string[]).includes(comment.targetType) || !(await this.fetch(comment.targetType as AiTargetType, { ids: [comment.targetId] }, user)).length) throw new ForbiddenException('A comment source is unavailable.');
        continue;
      }
      if (!(await this.fetch(kind, { ids: [recordId] }, user)).length) throw new ForbiddenException('A source was deleted, restricted or is no longer available.');
    }
  }
}
