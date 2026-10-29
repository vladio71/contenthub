import { decodeCursor, encodeCursor, InvalidCursorError } from './cursor';
import { buildOffsetPage, toSkipLimit } from './page';

describe('offset pagination helpers', () => {
  it('turns page and pageSize into skip and limit', () => {
    expect(toSkipLimit(1, 20)).toEqual({ skip: 0, limit: 20 });
    expect(toSkipLimit(3, 20)).toEqual({ skip: 40, limit: 20 });
  });

  it('builds a page with the number of pages', () => {
    expect(buildOffsetPage(['a', 'b'], 41, 3, 20)).toEqual({ items: ['a', 'b'], page: 3, pageSize: 20, total: 41, totalPages: 3 });
    expect(buildOffsetPage([], 0, 1, 20).totalPages).toBe(0);
  });
});

describe('cursor', () => {
  const id = '65f1a2b3c4d5e6f7a8b9c0d1';

  it('round trips strings and numbers', () => {
    expect(decodeCursor(encodeCursor({ value: '2026-01-01T00:00:00.000Z', id }))).toEqual({ value: '2026-01-01T00:00:00.000Z', id });
    expect(decodeCursor(encodeCursor({ value: 42, id }))).toEqual({ value: 42, id });
  });

  it('is url safe', () => {
    expect(encodeCursor({ value: 'a/b+c?d', id })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['not base64 json', '%%%'],
    ['json but not an object', Buffer.from('5').toString('base64url')],
    ['missing id', Buffer.from(JSON.stringify({ value: 1 })).toString('base64url')],
    ['id is not an object id', Buffer.from(JSON.stringify({ value: 1, id: 'x' })).toString('base64url')],
    ['value has a bad type', Buffer.from(JSON.stringify({ value: { $gt: '' }, id })).toString('base64url')],
  ])('rejects a cursor that is %s', (_name, raw) => {
    expect(() => decodeCursor(raw)).toThrow(InvalidCursorError);
  });
});
