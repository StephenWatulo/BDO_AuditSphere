import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable, map } from 'rxjs';

function isDecimalLike(v: unknown): v is { toNumber(): number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { toNumber?: unknown }).toNumber === 'function' &&
    (v as { constructor?: { name?: string } }).constructor?.name === 'Decimal'
  );
}

/**
 * Converts BigInt (e.g. AuditTrail.id, Document.sizeBytes) and Prisma Decimal
 * values into plain numbers so JSON serialisation never throws.
 */
export function toSerializable(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (isDecimalLike(value)) return value.toNumber();
  if (depth > 32) return value;
  if (Array.isArray(value)) return value.map((v) => toSerializable(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = toSerializable(v, depth + 1);
  }
  return out;
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) return data;
        return toSerializable(data);
      }),
    );
  }
}
