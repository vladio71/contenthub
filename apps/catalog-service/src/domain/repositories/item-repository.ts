import { CursorPage, OffsetPage } from '@contenthub/common';
import { Item, ItemStatus } from '../item';

export const ITEM_REPOSITORY = Symbol('ITEM_REPOSITORY');

export type TagMode = 'any' | 'all';
export type ItemSortField = 'createdAt' | 'likes' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface ItemFilters {
  text?: string;
  tags: string[];
  tagMode: TagMode;
  authorId?: string;
  status: ItemStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ItemSort {
  field: ItemSortField;
  order: SortOrder;
}

export interface OffsetListQuery {
  filters: ItemFilters;
  sort: ItemSort;
  page: number;
  pageSize: number;
}

export interface CursorListQuery {
  filters: ItemFilters;
  sort: ItemSort;
  pageSize: number;
  /** Null for the first page. */
  cursor: string | null;
}

export interface ItemRepository {
  nextId(): string;
  insert(item: Item): Promise<void>;
  findById(id: string): Promise<Item | null>;
  /** Writes title, body, tags, status and publishedAt. Never touches stats (those use atomic operators). */
  save(item: Item): Promise<void>;
  delete(id: string): Promise<void>;
  /**
   * Finds a visible item by slug and adds one view in the same atomic operation.
   * Returns null when it does not exist or the viewer may not see it.
   */
  viewBySlug(slug: string, viewerId: string): Promise<Item | null>;
  listOffset(query: OffsetListQuery): Promise<OffsetPage<Item>>;
  listCursor(query: CursorListQuery): Promise<CursorPage<Item>>;
}
