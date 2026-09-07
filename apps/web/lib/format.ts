import { format, formatDistanceToNowStrict, isValid, parseISO, differenceInCalendarDays } from 'date-fns';

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function fmtDate(value?: string | Date | null, pattern = 'd MMM yyyy'): string {
  const d = toDate(value);
  return d ? format(d, pattern) : '—';
}

export function fmtDateTime(value?: string | Date | null): string {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy, HH:mm') : '—';
}

export function fmtRelative(value?: string | Date | null): string {
  const d = toDate(value);
  if (!d) return '—';
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function fmtDueIn(value?: string | Date | null): string {
  const d = toDate(value);
  if (!d) return '—';
  const days = differenceInCalendarDays(d, new Date());
  if (days === 0) return 'Due today';
  if (days > 0) return `Due in ${days} day${days === 1 ? '' : 's'}`;
  return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
}

export function isOverdue(value?: string | Date | null): boolean {
  const d = toDate(value);
  return !!d && differenceInCalendarDays(d, new Date()) < 0;
}

export function toInputDate(value?: string | Date | null): string {
  const d = toDate(value);
  return d ? format(d, 'yyyy-MM-dd') : '';
}

export function fmtNumber(value?: number | string | null, dp = 0): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtHours(value?: number | string | null): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${fmtNumber(n, n % 1 === 0 ? 0 : 1)} h`;
}

export function fmtPct(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value)}%`;
}
