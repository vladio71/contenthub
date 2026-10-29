import { buildOffsetPage, CursorPage, decodeCursor, encodeCursor, OffsetPage } from '@contenthub/common';
import { Clock } from '../application/ports';
import { Collection } from '../domain/collection';
import { AlreadyLikedError, CollectionNotFoundError, ItemNotFoundError, LikeNotFoundError } from '../domain/errors';
import { Item } from '../domain/item';
import { CollectionRepository, CollectionWithItems } from '../domain/repositories/collection-repository';
import { CursorListQuery, ItemFilters, ItemRepository, ItemSort, OffsetListQuery } from '../domain/repositories/item-repository';
import { LikeRepository } from '../domain/repositories/like-repository';
import { AuthorStatsReport, StatsRepository, TagStat } from '../domain/repositories/stats-repository';

/**
 * In-memory versions of the repositories. They keep the same contract as the Mongo ones,
 * so use cases and controllers can be tested without a database.
 * They hand out copies, like a database does.
 */
export const TEST_SECRET = 'test-secret-test-secret-test-secret-1234';

export class FixedClock implements Clock {
  constructor(private current = new Date('2026-03-01T10:00:00Z')) {}
  now(): Date {
    return this.current;
  }
  set(date: Date): void {
    this.current = date;
  }
}

function copy(item: Item): Item {
  return Item.restore(item.snapshot());
}

function withStats(item: Item, change: Partial<{ likes: number; views: number }>): Item {
  const props = item.snapshot();
  return Item.restore({ ...props, stats: { ...props.stats, ...change } });
}

interface SortKey {
  value: string | number;
  id: string;
}

function sortKeyOf(item: Item, sort: ItemSort): SortKey {
  const value = sort.field === 'createdAt' ? item.createdAt.getTime() : sort.field === 'likes' ? item.stats.likes : item.title;
  return { value, id: item.id };
}

function compareKeys(a: SortKey, b: SortKey, sort: ItemSort): number {
  const ascending = a.value < b.value ? -1 : a.value > b.value ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return sort.order === 'asc' ? ascending : -ascending;
}

function matches(item: Item, filters: ItemFilters): boolean {
  const text = filters.text?.toLowerCase();
  const hasText = !text || `${item.title} ${item.body} ${item.tags.join(' ')}`.toLowerCase().includes(text);
  const hasTags =
    filters.tags.length === 0 ||
    (filters.tagMode === 'all' ? filters.tags.every((tag) => item.tags.includes(tag)) : filters.tags.some((tag) => item.tags.includes(tag)));
  return (
    item.status === filters.status &&
    hasText &&
    hasTags &&
    (filters.authorId === undefined || item.authorId === filters.authorId) &&
    (filters.dateFrom === undefined || item.createdAt >= filters.dateFrom) &&
    (filters.dateTo === undefined || item.createdAt <= filters.dateTo)
  );
}

export class InMemoryItemRepository implements ItemRepository {
  readonly items = new Map<string, Item>();
  private counter = 0;

  nextId(): string {
    this.counter += 1;
    return this.counter.toString(16).padStart(24, '0');
  }

  async insert(item: Item): Promise<void> {
    this.items.set(item.id, copy(item));
  }

  async findById(id: string): Promise<Item | null> {
    const item = this.items.get(id);
    return item ? copy(item) : null;
  }

  async save(item: Item): Promise<void> {
    const stored = this.items.get(item.id);
    if (stored) {
      // Like the Mongo repository: keep the stored counters, take the rest from the domain object.
      this.items.set(item.id, withStats(item, stored.stats));
    }
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async viewBySlug(slug: string, viewerId: string): Promise<Item | null> {
    const found = [...this.items.values()].find((item) => item.slug === slug && item.isVisibleTo(viewerId));
    if (!found) {
      return null;
    }
    const updated = withStats(found, { views: found.stats.views + 1 });
    this.items.set(found.id, updated);
    return copy(updated);
  }

  async listOffset(query: OffsetListQuery): Promise<OffsetPage<Item>> {
    const sorted = this.sortedMatches(query.filters, query.sort);
    const start = (query.page - 1) * query.pageSize;
    return buildOffsetPage(sorted.slice(start, start + query.pageSize).map(copy), sorted.length, query.page, query.pageSize);
  }

  async listCursor(query: CursorListQuery): Promise<CursorPage<Item>> {
    let rows = this.sortedMatches(query.filters, query.sort);
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      const after: SortKey = { value: query.sort.field === 'createdAt' ? Date.parse(String(decoded.value)) : decoded.value, id: decoded.id };
      rows = rows.filter((item) => compareKeys(sortKeyOf(item, query.sort), after, query.sort) > 0);
    }
    const page = rows.slice(0, query.pageSize);
    const last = page[page.length - 1];
    const hasMore = rows.length > query.pageSize;
    const cursorValue = last && (query.sort.field === 'createdAt' ? last.createdAt.toISOString() : sortKeyOf(last, query.sort).value);
    return {
      items: page.map(copy),
      pageSize: query.pageSize,
      nextCursor: hasMore && last && cursorValue !== undefined ? encodeCursor({ value: cursorValue, id: last.id }) : null,
    };
  }

  /** Test helper: changes counters the way $inc does. */
  addLikes(itemId: string, delta: number): number {
    const item = this.items.get(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    const likes = item.stats.likes + delta;
    this.items.set(itemId, withStats(item, { likes }));
    return likes;
  }

  private sortedMatches(filters: ItemFilters, sort: ItemSort): Item[] {
    return [...this.items.values()]
      .filter((item) => matches(item, filters))
      .sort((a, b) => compareKeys(sortKeyOf(a, sort), sortKeyOf(b, sort), sort));
  }
}

export class InMemoryLikeRepository implements LikeRepository {
  private readonly likes = new Set<string>();

  constructor(private readonly items: InMemoryItemRepository) {}

  async add(itemId: string, userId: string): Promise<number> {
    const key = `${itemId}:${userId}`;
    if (this.likes.has(key)) {
      throw new AlreadyLikedError();
    }
    const count = this.items.addLikes(itemId, 1);
    this.likes.add(key);
    return count;
  }

  async remove(itemId: string, userId: string): Promise<number> {
    const key = `${itemId}:${userId}`;
    if (!this.likes.has(key)) {
      throw new LikeNotFoundError();
    }
    this.likes.delete(key);
    return this.items.addLikes(itemId, -1);
  }
}

export class InMemoryStatsRepository implements StatsRepository {
  constructor(private readonly items: InMemoryItemRepository) {}

  async topTags(limit: number): Promise<TagStat[]> {
    const byTag = new Map<string, TagStat>();
    for (const item of this.published()) {
      for (const tag of item.tags) {
        const stat = byTag.get(tag) ?? { tag, items: 0, likes: 0 };
        byTag.set(tag, { tag, items: stat.items + 1, likes: stat.likes + item.stats.likes });
      }
    }
    return [...byTag.values()].sort((a, b) => b.items - a.items || b.likes - a.likes || a.tag.localeCompare(b.tag)).slice(0, limit);
  }

  async authorStats(limit: number): Promise<AuthorStatsReport> {
    const byAuthor = new Map<string, { authorId: string; items: number; likes: number; views: number }>();
    for (const item of this.published()) {
      const stat = byAuthor.get(item.authorId) ?? { authorId: item.authorId, items: 0, likes: 0, views: 0 };
      byAuthor.set(item.authorId, {
        authorId: item.authorId,
        items: stat.items + 1,
        likes: stat.likes + item.stats.likes,
        views: stat.views + item.stats.views,
      });
    }
    const all = [...byAuthor.values()];
    return {
      topAuthors: [...all].sort((a, b) => b.likes - a.likes || b.items - a.items || a.authorId.localeCompare(b.authorId)).slice(0, limit),
      totals: {
        authors: all.length,
        items: all.reduce((sum, row) => sum + row.items, 0),
        likes: all.reduce((sum, row) => sum + row.likes, 0),
        views: all.reduce((sum, row) => sum + row.views, 0),
      },
    };
  }

  private published(): Item[] {
    return [...this.items.items.values()].filter((item) => item.status === 'published');
  }
}

export class InMemoryCollectionRepository implements CollectionRepository {
  readonly collections = new Map<string, Collection>();
  private counter = 1000;

  constructor(private readonly items: InMemoryItemRepository) {}

  nextId(): string {
    this.counter += 1;
    return this.counter.toString(16).padStart(24, '0');
  }

  async insert(collection: Collection): Promise<void> {
    this.collections.set(collection.id, Collection.restore(collection.toProps()));
  }

  async findById(id: string): Promise<Collection | null> {
    const found = this.collections.get(id);
    return found ? Collection.restore(found.toProps()) : null;
  }

  async listByOwner(ownerId: string, page: number, pageSize: number): Promise<OffsetPage<Collection>> {
    const mine = [...this.collections.values()].filter((collection) => collection.ownerId === ownerId);
    const start = (page - 1) * pageSize;
    return buildOffsetPage(mine.slice(start, start + pageSize), mine.length, page, pageSize);
  }

  async addItems(collectionId: string, ownerId: string, itemIds: string[]): Promise<Collection> {
    const stored = this.collections.get(collectionId);
    if (!stored || stored.ownerId !== ownerId) {
      throw new CollectionNotFoundError(collectionId);
    }
    const unique = [...new Set(itemIds)];
    const visible = unique.filter((id) => this.items.items.get(id)?.isVisibleTo(ownerId));
    if (visible.length !== unique.length) {
      throw new ItemNotFoundError('one or more of the items do not exist');
    }
    // All or nothing: work on a copy and store it only when every rule passed.
    const draft = Collection.restore(stored.toProps());
    draft.addItems(unique);
    this.collections.set(collectionId, draft);
    return Collection.restore(draft.toProps());
  }

  async findWithItems(collectionId: string, viewerId: string): Promise<CollectionWithItems | null> {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      return null;
    }
    const items = collection.itemIds
      .map((id) => this.items.items.get(id))
      .filter((item): item is Item => item !== undefined && item.isVisibleTo(viewerId))
      .map(copy);
    return { collection: Collection.restore(collection.toProps()), items };
  }
}

