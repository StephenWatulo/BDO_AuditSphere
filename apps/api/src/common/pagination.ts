import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 25;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Sort as `field:asc|desc`', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sort?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageArgs {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

export function pageArgs(dto: Pick<PaginationDto, 'page' | 'pageSize'>): PageArgs {
  const page = Math.max(1, dto.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, dto.pageSize ?? 25));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

/**
 * Runs the count and the find in parallel and returns the contract list shape.
 */
export async function paginate<T>(
  dto: Pick<PaginationDto, 'page' | 'pageSize'>,
  count: () => Promise<number>,
  find: (args: { skip: number; take: number }) => Promise<T[]>,
): Promise<Page<T>> {
  const { skip, take, page, pageSize } = pageArgs(dto);
  const [total, items] = await Promise.all([count(), find({ skip, take })]);
  return { items, total, page, pageSize };
}

export type SortOrder = 'asc' | 'desc';

/**
 * Parses `field:asc|desc` against an allow-list. Unknown fields fall back to the
 * default ordering so callers can never sort by arbitrary columns.
 */
export function parseSort<F extends string>(
  sort: string | undefined,
  allowed: readonly F[],
  fallback: Partial<Record<F, SortOrder>>,
): Partial<Record<F, SortOrder>> {
  if (!sort) return fallback;
  const [field, dirRaw] = sort.split(':');
  const dir: SortOrder = dirRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';
  if (!allowed.includes(field as F)) return fallback;
  return { [field]: dir } as Partial<Record<F, SortOrder>>;
}
