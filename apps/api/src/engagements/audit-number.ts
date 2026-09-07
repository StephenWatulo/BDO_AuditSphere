import { pad } from '../common/utils';

const AUDIT_NUMBER_RE = /^IA-(\d{4})-(\d{3,})$/;

/** `IA-2026-007` */
export function formatAuditNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error(`Invalid year ${year}`);
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`Invalid sequence ${seq}`);
  return `IA-${year}-${pad(seq, 3)}`;
}

export function parseAuditNumber(value: string): { year: number; seq: number } | null {
  const m = AUDIT_NUMBER_RE.exec(value.trim());
  if (!m) return null;
  return { year: Number(m[1]), seq: Number(m[2]) };
}

/** Given the highest existing number for `year` (or null), returns the next one. */
export function nextAuditNumber(year: number, latest: string | null | undefined): string {
  const parsed = latest ? parseAuditNumber(latest) : null;
  const seq = parsed && parsed.year === year ? parsed.seq + 1 : 1;
  return formatAuditNumber(year, seq);
}

export function auditNumberPrefix(year: number): string {
  return `IA-${year}-`;
}
