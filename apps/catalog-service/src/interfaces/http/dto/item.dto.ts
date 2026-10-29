import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDate, IsIn, IsOptional, IsString, Length, Max, MaxLength, Min, IsInt } from 'class-validator';
import { PageQueryDto } from '@contenthub/common';
import { ITEM_STATUSES, ItemStatus } from '../../../domain/item';
import { ItemSortField, SortOrder, TagMode } from '../../../domain/repositories/item-repository';

export const SORT_FIELDS: readonly ItemSortField[] = ['createdAt', 'likes', 'title'];
export const SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc'];
export const TAG_MODES: readonly TagMode[] = ['any', 'all'];
export type PaginationMode = 'offset' | 'cursor';
export const PAGINATION_MODES: readonly PaginationMode[] = ['offset', 'cursor'];

export class CreateItemDto {
  @ApiProperty({ example: 'Why keyset pagination beats skip' })
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiProperty({ example: 'Skip gets slower with every page...' })
  @IsString()
  @MaxLength(20000)
  body!: string;

  @ApiPropertyOptional({ example: ['mongodb', 'pagination'], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @ApiPropertyOptional({ maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: ['archived'], description: 'The only status you can set here. Use /publish to publish.' })
  @IsOptional()
  @IsIn(['archived'])
  status?: 'archived';
}

export class ListItemsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Text search (text index over title, body and tags)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ type: String, description: 'Comma separated, for example tags=mongodb,nestjs', example: 'mongodb,nestjs' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag !== '')
      : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: TAG_MODES, default: 'any', description: 'any: has at least one tag. all: has every tag.' })
  @IsOptional()
  @IsIn(TAG_MODES)
  tagMode: TagMode = 'any';

  @ApiPropertyOptional({ description: 'User id of the author' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  authorId?: string;

  @ApiPropertyOptional({ enum: ITEM_STATUSES, default: 'published', description: 'draft and archived only show your own items' })
  @IsOptional()
  @IsIn(ITEM_STATUSES)
  status: ItemStatus = 'published';

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'createdAt >= this (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'createdAt <= this (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort: ItemSortField = 'createdAt';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order: SortOrder = 'desc';

  @ApiPropertyOptional({
    enum: PAGINATION_MODES,
    default: 'offset',
    description: 'offset uses page and pageSize. cursor uses the cursor param and pageSize. Sending a cursor selects cursor mode.',
  })
  @IsOptional()
  @IsIn(PAGINATION_MODES)
  pagination?: PaginationMode;

  @ApiPropertyOptional({ description: 'nextCursor from the previous page. Leave empty for the first page of a cursor listing.' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}

export class StatsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

export class ItemStatsResponseDto {
  @ApiProperty() likes!: number;
  @ApiProperty() views!: number;
}

export class ItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty() authorId!: string;
  @ApiProperty({ enum: ITEM_STATUSES }) status!: ItemStatus;
  @ApiProperty({ type: ItemStatsResponseDto }) stats!: ItemStatsResponseDto;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true, type: String }) publishedAt!: string | null;
}

export class ItemListResponseDto {
  @ApiProperty({ enum: PAGINATION_MODES }) mode!: PaginationMode;
  @ApiProperty({ type: [ItemResponseDto] }) items!: ItemResponseDto[];
  @ApiProperty() pageSize!: number;
  @ApiPropertyOptional({ description: 'Offset mode only' }) page?: number;
  @ApiPropertyOptional({ description: 'Offset mode only' }) total?: number;
  @ApiPropertyOptional({ description: 'Offset mode only' }) totalPages?: number;
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Cursor mode only. Null on the last page.' }) nextCursor?: string | null;
}

export class LikeResponseDto {
  @ApiProperty() itemId!: string;
  @ApiProperty() liked!: boolean;
  @ApiProperty() likes!: number;
}

export class TagStatResponseDto {
  @ApiProperty() tag!: string;
  @ApiProperty() items!: number;
  @ApiProperty() likes!: number;
}

export class AuthorStatResponseDto {
  @ApiProperty() authorId!: string;
  @ApiProperty() items!: number;
  @ApiProperty() likes!: number;
  @ApiProperty() views!: number;
}

export class AuthorTotalsResponseDto {
  @ApiProperty() authors!: number;
  @ApiProperty() items!: number;
  @ApiProperty() likes!: number;
  @ApiProperty() views!: number;
}

export class AuthorStatsResponseDto {
  @ApiProperty({ type: [AuthorStatResponseDto] }) topAuthors!: AuthorStatResponseDto[];
  @ApiProperty({ type: AuthorTotalsResponseDto }) totals!: AuthorTotalsResponseDto;
}
