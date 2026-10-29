import { Types } from 'mongoose';
import { CursorPayload, encodeCursor, InvalidCursorError } from '@contenthub/common';
import { Item } from '../../domain/item';
import { ItemFilters, ItemSort, ItemSortField } from '../../domain/repositories/item-repository';

/** Pure functions that build MongoDB query documents. No database needed to test them. */

export type MongoFilter = Record<string, unknown>;

/** Where each sort field lives in the document. */
export const SORT_PATH: Record<ItemSortField, string> = {
  createdAt: 'createdAt',
  likes: 'stats.likes',
  title: 'title',
};

export function buildItemMatch(filters: ItemFilters): MongoFilter {
  const match: MongoFilter = { status: filters.status };
  if (filters.text) {
    match.$text = { $search: filters.text };
  }
  if (filters.tags.length > 0) {
    match.tags = filters.tagMode === 'all' ? { $all: filters.tags } : { $in: filters.tags };
  }
  if (filters.authorId) {
    match.authorId = filters.authorId;
  }
  if (filters.dateFrom || filters.dateTo) {
    match.createdAt = {
      ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
    };
  }
  return match;
}

/** The sort is always "field, then _id", so the order is total even when many rows share a value. */
export function buildSort(sort: ItemSort): Record<string, 1 | -1> {
  const direction = sort.order === 'asc' ? 1 : -1;
  return { [SORT_PATH[sort.field]]: direction, _id: direction };
}

/**
 * Keyset condition: "rows after the cursor in sort order".
 * For descending order and cursor (v, id):
 *   field < v  OR  (field = v AND _id < id)
 */
export function buildKeysetCondition(sort: ItemSort, cursor: CursorPayload | null): MongoFilter | null {
  if (!cursor) {
    return null;
  }
  const path = SORT_PATH[sort.field];
  const operator = sort.order === 'asc' ? '$gt' : '$lt';
  const value = cursorValue(sort.field, cursor.value);
  const id = new Types.ObjectId(cursor.id);
  return { $or: [{ [path]: { [operator]: value } }, { [path]: value, _id: { [operator]: id } }] };
}

export function cursorFor(item: Item, sort: ItemSort): string {
  const value = sort.field === 'createdAt' ? item.createdAt.toISOString() : sort.field === 'likes' ? item.stats.likes : item.title;
  return encodeCursor({ value, id: item.id });
}

/** A cursor comes from the client, so check that its value fits the sort field. */
function cursorValue(field: ItemSortField, raw: string | number): Date | string | number {
  if (field === 'likes') {
    if (typeof raw !== 'number') {
      throw new InvalidCursorError();
    }
    return raw;
  }
  if (typeof raw !== 'string') {
    throw new InvalidCursorError();
  }
  if (field === 'title') {
    return raw;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidCursorError();
  }
  return date;
}
