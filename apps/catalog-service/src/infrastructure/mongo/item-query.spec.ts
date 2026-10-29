import { Types } from 'mongoose';
import { encodeCursor, InvalidCursorError } from '@contenthub/common';
import { Item } from '../../domain/item';
import { ItemFilters } from '../../domain/repositories/item-repository';
import { buildItemMatch, buildKeysetCondition, buildSort, cursorFor } from './item-query';

const baseFilters: ItemFilters = { tags: [], tagMode: 'any', status: 'published' };
const ID = '65f1a2b3c4d5e6f7a8b9c0d1';

describe('buildItemMatch', () => {
  it('filters by status only when nothing else is given', () => {
    expect(buildItemMatch(baseFilters)).toEqual({ status: 'published' });
  });

  it('uses $in for tag mode any and $all for tag mode all', () => {
    expect(buildItemMatch({ ...baseFilters, tags: ['a', 'b'] }).tags).toEqual({ $in: ['a', 'b'] });
    expect(buildItemMatch({ ...baseFilters, tags: ['a', 'b'], tagMode: 'all' }).tags).toEqual({ $all: ['a', 'b'] });
  });

  it('combines text, author and a date range', () => {
    const dateFrom = new Date('2026-01-01');
    const dateTo = new Date('2026-02-01');
    expect(buildItemMatch({ ...baseFilters, text: 'mongo', authorId: 'u1', dateFrom, dateTo })).toEqual({
      status: 'published',
      $text: { $search: 'mongo' },
      authorId: 'u1',
      createdAt: { $gte: dateFrom, $lte: dateTo },
    });
    expect(buildItemMatch({ ...baseFilters, dateTo }).createdAt).toEqual({ $lte: dateTo });
  });
});

describe('buildSort', () => {
  it('always adds _id as the tie breaker, in the same direction', () => {
    expect(buildSort({ field: 'likes', order: 'desc' })).toEqual({ 'stats.likes': -1, _id: -1 });
    expect(buildSort({ field: 'title', order: 'asc' })).toEqual({ title: 1, _id: 1 });
  });
});

describe('buildKeysetCondition', () => {
  it('returns null for the first page', () => {
    expect(buildKeysetCondition({ field: 'createdAt', order: 'desc' }, null)).toBeNull();
  });

  it('descending: smaller value, or same value and smaller id', () => {
    const cursor = { value: '2026-02-01T00:00:00.000Z', id: ID };
    expect(buildKeysetCondition({ field: 'createdAt', order: 'desc' }, cursor)).toEqual({
      $or: [
        { createdAt: { $lt: new Date('2026-02-01T00:00:00.000Z') } },
        { createdAt: new Date('2026-02-01T00:00:00.000Z'), _id: { $lt: new Types.ObjectId(ID) } },
      ],
    });
  });

  it('ascending by likes uses $gt on the nested path', () => {
    expect(buildKeysetCondition({ field: 'likes', order: 'asc' }, { value: 7, id: ID })).toEqual({
      $or: [{ 'stats.likes': { $gt: 7 } }, { 'stats.likes': 7, _id: { $gt: new Types.ObjectId(ID) } }],
    });
  });

  it('rejects a cursor whose value does not fit the sort field', () => {
    expect(() => buildKeysetCondition({ field: 'likes', order: 'desc' }, { value: 'x', id: ID })).toThrow(InvalidCursorError);
    expect(() => buildKeysetCondition({ field: 'createdAt', order: 'desc' }, { value: 'not a date', id: ID })).toThrow(InvalidCursorError);
    expect(() => buildKeysetCondition({ field: 'title', order: 'desc' }, { value: 5, id: ID })).toThrow(InvalidCursorError);
  });
});

describe('cursorFor', () => {
  it('stores the value of the sort field and the id', () => {
    const item = Item.create({ id: ID, title: 'Some title', body: 'x', tags: [], authorId: 'a', now: new Date('2026-03-01T00:00:00Z') });
    expect(cursorFor(item, { field: 'createdAt', order: 'desc' })).toBe(encodeCursor({ value: '2026-03-01T00:00:00.000Z', id: ID }));
    expect(cursorFor(item, { field: 'likes', order: 'desc' })).toBe(encodeCursor({ value: 0, id: ID }));
    expect(cursorFor(item, { field: 'title', order: 'asc' })).toBe(encodeCursor({ value: 'Some title', id: ID }));
  });
});
