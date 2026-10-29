import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Query params for offset pagination. Extend it in DTOs that need more filters. */
export class PageQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}

export interface OffsetPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CursorPage<T> {
  items: T[];
  pageSize: number;
  nextCursor: string | null;
}

export interface SkipLimit {
  skip: number;
  limit: number;
}

export function toSkipLimit(page: number, pageSize: number): SkipLimit {
  return { skip: (page - 1) * pageSize, limit: pageSize };
}

export function buildOffsetPage<T>(items: T[], total: number, page: number, pageSize: number): OffsetPage<T> {
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
