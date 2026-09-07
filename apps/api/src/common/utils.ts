import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { Transform } from 'class-transformer';

/** class-transformer helper: turns `true|1|yes` into booleans for query params. */
export function ToBoolean() {
  return Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null || value === '') return undefined;
    const s = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
    return value;
  });
}

/** Trims strings and turns empty strings into undefined. */
export function Trim() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}

export function assertFound<T>(value: T | null | undefined, what = 'Record'): T {
  if (value === null || value === undefined) throw new NotFoundException(`${what} not found`);
  return value;
}

export function json(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

export function jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

/** ISO string -> Date; `null` clears, `undefined` leaves untouched. */
export function toDate(v: string | Date | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return v instanceof Date ? v : new Date(v);
}

export function isBlank(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim().length === 0;
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Removes secret-bearing fields before a record is written to the audit trail. */
const SENSITIVE_KEYS = new Set([
  'passwordHash',
  'mfaSecretEnc',
  'mfaRecoveryCodes',
  'tokenHash',
  'configEnc',
  'password',
  'currentPassword',
  'newPassword',
]);

export function redact<T>(value: T, depth = 0): T {
  if (value === null || value === undefined || typeof value !== 'object' || depth > 8) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'bigint') {
      out[k] = Number(v);
    } else if (v && typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') {
      out[k] = (v as { toNumber(): number }).toNumber();
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out as T;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/** Removes `undefined` values so Prisma does not attempt to set them. */
export function compact<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

export const USER_SUMMARY_SELECT = { id: true, displayName: true, email: true, avatarUrl: true } as const;
