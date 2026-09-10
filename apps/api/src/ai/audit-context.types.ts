import type { AuditSource, AuditSourceKind, AuditSearchSummary } from '@auditsphere/shared';

export interface AuditRecord {
  source: AuditSource;
  fields: Record<string, unknown>;
}
export interface AuditContext {
  target?: string;
  records: AuditRecord[];
  links: { from: string; to: string; relationship: string }[];
  warnings: string[];
  search?: AuditSearchSummary;
}
export const recordsOf = (context: AuditContext, kind: AuditSourceKind) => context.records.filter((r) => r.source.kind === kind);
export const field = (record: AuditRecord | undefined, key: string): string => String(record?.fields[key] ?? '').trim();
export const sourceIds = (...records: (AuditRecord | undefined)[]) => records.filter((r): r is AuditRecord => !!r).map((r) => r.source.id);
