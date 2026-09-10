import { z } from 'zod';

export const AI_REVIEW_NOTICE = 'AI-generated output. Auditor review required before inclusion in audit documentation.';
export const AI_ASSISTANT_VERSION = '2.1';
export const EXCEPTION_REGISTER_TITLE = 'Exception Register';
export const EXCEPTION_REGISTER_COLUMNS = ['Exception ID', 'Transaction Reference', 'Supplier/Vendor', 'Amount', 'Control Requirement', 'Evidence Observed', 'Exception Identified', 'Risk Impact', 'Severity', 'Auditor Follow-up'] as const;
export const AI_TARGET_TYPES = ['Entity', 'Process', 'Risk', 'Control', 'Procedure', 'Engagement', 'Workpaper', 'Evidence', 'Finding'] as const;
export type AiTargetType = (typeof AI_TARGET_TYPES)[number];
export type AuditSourceKind = AiTargetType | 'ActionPlan' | 'ReviewNote' | 'ControlTest' | 'Document' | 'Comment' | 'RiskSignal' | 'Metrics' | 'ScoringModel' | 'UserContext';
export const AUDIT_SEARCH_KINDS = ['Engagement', 'Entity', 'Process', 'Risk', 'Control', 'Workpaper', 'Evidence', 'Finding', 'ActionPlan'] as const;
export type AuditSearchKind = (typeof AUDIT_SEARCH_KINDS)[number];
export interface AuditSearchOptions {
  searchScope?: 'universe' | 'engagement';
  searchEngagementId?: string;
  searchKinds?: AuditSearchKind[];
  searchPage?: number;
}

export interface AuditSource {
  id: string;
  kind: AuditSourceKind;
  recordId: string;
  label: string;
  href?: string;
  excerpt: string;
  truncated: boolean;
}

const text = z.string().max(12000);
const refs = z.array(z.string().max(30)).max(100);
export const AuditBasisSchema = z.enum(['fact', 'assessment', 'assumption', 'recommendation', 'missing']);
const statement = z.object({ text, basis: AuditBasisSchema, sourceIds: refs }).strict();
const row = z.object({ cells: z.array(z.string().max(4000)).min(1).max(10), basis: AuditBasisSchema, sourceIds: refs }).strict();
export const AssistantContentSchema = z.object({
  title: z.string().min(1).max(300),
  narrative: text,
  sections: z.array(z.object({ title: z.string().max(160), items: z.array(statement).max(100), columns: z.array(z.string().max(100)).max(10), rows: z.array(row).max(100) }).strict()).max(20),
  exceptions: z.array(z.object({ reference: z.string().max(30), observation: text, risk: text, severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNRATED']), status: z.enum(['recorded', 'potential']), sourceIds: refs }).strict()).max(100),
  reviewerNotes: z.array(z.object({ priority: z.enum(['HIGH', 'MEDIUM', 'LOW']), area: z.string().max(160), comment: text, sourceIds: refs }).strict()).max(100),
  evidenceAssessment: z.object({ status: z.enum(['SUFFICIENT', 'PARTIALLY_SUFFICIENT', 'INSUFFICIENT', 'NOT_ASSESSED']), rationale: text, sourceIds: refs, checks: z.array(z.object({ label: z.string().max(160), result: z.enum(['present', 'missing', 'not_verified']), detail: text, sourceIds: refs }).strict()).max(20) }).strict(),
  ratingProposal: z.object({ impact: z.number().int().min(1).max(5).nullable(), likelihood: z.number().int().min(1).max(5).nullable(), score: z.number().min(1).max(25).nullable(), rating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNRATED']), rationale: text, sourceIds: refs }).strict(),
  suggestions: z.array(text).max(100),
  checklist: z.array(text).max(100),
  caveats: z.array(text).max(100),
}).strict();

export type AssistantContent = z.infer<typeof AssistantContentSchema>;
export type AuditStatement = z.infer<typeof statement>;
export interface AuditSearchSummary {
  interpretation: string;
  terms: string[];
  from?: string;
  to?: string;
  exceptionsOnly: boolean;
  results: { sourceId: string; reason: string }[];
  intelligence?: {
    indexedAt: string;
    coveragePercent: number | null;
    coverageBasis: string;
    sourcesAnalysed: number;
    restrictedKinds: string[];
    incompleteKinds: string[];
    textLimitedRecords: number;
    confidence: 'High' | 'Medium' | 'Low';
    confidenceReason: string;
    totalMatches: number;
    engagementCount: number;
    counts: Partial<Record<AuditSearchKind, number>>;
    page: number;
    pageSize: number;
    emptyReason?: 'no_data' | 'no_match' | 'permissions' | 'incomplete';
    rows: { sourceId: string; kind: AuditSearchKind; engagement: string; severity: string; owner: string; status: string; dueDate: string; detail: string; traceIds: string[] }[];
    query: AuditSearchOptions & { prompt: string };
  };
}
export interface AuditAssistantResponse extends AssistantContent {
  version: string;
  reviewRequired: true;
  reviewNotice: string;
  sourceRegister: AuditSource[];
  contextLinks: { from: string; to: string; relationship: string }[];
  contextWarnings: string[];
  search?: AuditSearchSummary;
}
