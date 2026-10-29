import { CursorPage } from '@contenthub/common';
import { AlreadyLikedError, InvalidItemStateError, ItemNotFoundError, LikeNotFoundError, NotItemOwnerError } from '../domain/errors';
import { Item } from '../domain/item';
import { ItemFilters } from '../domain/repositories/item-repository';
import { FixedClock, InMemoryItemRepository, InMemoryLikeRepository } from '../testing/in-memory-repositories';
import { CreateItemUseCase } from './create-item.use-case';
import { DeleteItemUseCase } from './delete-item.use-case';
import { GetItemBySlugUseCase } from './get-item-by-slug.use-case';
import { LikeItemUseCase } from './like-item.use-case';
import { ListItemsUseCase } from './list-items.use-case';
import { PublishItemUseCase } from './publish-item.use-case';
import { UnlikeItemUseCase } from './unlike-item.use-case';
import { UpdateItemUseCase } from './update-item.use-case';

function setup() {
  const items = new InMemoryItemRepository();
  const likes = new InMemoryLikeRepository(items);
  const clock = new FixedClock();
  return {
    items,
    clock,
    create: new CreateItemUseCase(items, clock),
    publish: new PublishItemUseCase(items, clock),
    update: new UpdateItemUseCase(items),
    remove: new DeleteItemUseCase(items),
    bySlug: new GetItemBySlugUseCase(items),
    like: new LikeItemUseCase(items, likes),
    unlike: new UnlikeItemUseCase(likes),
    list: new ListItemsUseCase(items),
  };
}

type Ctx = ReturnType<typeof setup>;

async function publishedItem(ctx: Ctx, title: string, authorId = 'author', tags: string[] = []): Promise<Item> {
  const item = await ctx.create.execute({ authorId, title, body: `Body of ${title}`, tags });
  return ctx.publish.execute(item.id, authorId);
}

const published: ItemFilters = { tags: [], tagMode: 'any', status: 'published' };

describe('item lifecycle', () => {
  it('creates a draft, publishes it, and only the owner can change or delete it', async () => {
    const ctx = setup();
    const draft = await ctx.create.execute({ authorId: 'author', title: 'My first post', body: 'text', tags: ['a'] });
    expect(draft.status).toBe('draft');

    await expect(ctx.publish.execute(draft.id, 'intruder')).rejects.toBeInstanceOf(NotItemOwnerError);
    await expect(ctx.update.execute(draft.id, 'intruder', { title: 'Hacked title' })).rejects.toBeInstanceOf(NotItemOwnerError);
    await expect(ctx.remove.execute(draft.id, 'intruder')).rejects.toBeInstanceOf(NotItemOwnerError);

    const live = await ctx.publish.execute(draft.id, 'author');
    expect(live.status).toBe('published');
    await expect(ctx.publish.execute(draft.id, 'author')).rejects.toBeInstanceOf(InvalidItemStateError);

    const archived = await ctx.update.execute(draft.id, 'author', { archive: true });
    expect(archived.status).toBe('archived');

    await ctx.remove.execute(draft.id, 'author');
    await expect(ctx.remove.execute(draft.id, 'author')).rejects.toBeInstanceOf(ItemNotFoundError);
  });

  it('counts a view on every read and hides drafts from other users', async () => {
    const ctx = setup();
    const live = await publishedItem(ctx, 'Public post');
    const draft = await ctx.create.execute({ authorId: 'author', title: 'Secret draft', body: 'x', tags: [] });

    await ctx.bySlug.execute(live.slug, 'reader');
    const second = await ctx.bySlug.execute(live.slug, 'reader');
    expect(second.stats.views).toBe(2);

    await expect(ctx.bySlug.execute(draft.slug, 'reader')).rejects.toBeInstanceOf(ItemNotFoundError);
    await expect(ctx.bySlug.execute(draft.slug, 'author')).resolves.toBeDefined();
  });
});

describe('likes', () => {
  it('likes once, rejects a second like and keeps the counter right', async () => {
    const ctx = setup();
    const item = await publishedItem(ctx, 'Likeable post');

    await expect(ctx.like.execute(item.id, 'u1')).resolves.toEqual({ itemId: item.id, liked: true, likes: 1 });
    await expect(ctx.like.execute(item.id, 'u2')).resolves.toMatchObject({ likes: 2 });
    await expect(ctx.like.execute(item.id, 'u1')).rejects.toBeInstanceOf(AlreadyLikedError);
    expect((await ctx.items.findById(item.id))?.stats.likes).toBe(2);

    await expect(ctx.unlike.execute(item.id, 'u1')).resolves.toMatchObject({ liked: false, likes: 1 });
    await expect(ctx.unlike.execute(item.id, 'u1')).rejects.toBeInstanceOf(LikeNotFoundError);
  });

  it('does not allow liking drafts, or items the user cannot see', async () => {
    const ctx = setup();
    const draft = await ctx.create.execute({ authorId: 'author', title: 'Unfinished post', body: 'x', tags: [] });
    await expect(ctx.like.execute(draft.id, 'author')).rejects.toBeInstanceOf(InvalidItemStateError);
    await expect(ctx.like.execute(draft.id, 'other')).rejects.toBeInstanceOf(ItemNotFoundError);
    await expect(ctx.like.execute('f'.repeat(24), 'other')).rejects.toBeInstanceOf(ItemNotFoundError);
  });
});

describe('ListItemsUseCase', () => {
  it('only lets users list their own drafts', async () => {
    const ctx = setup();
    await ctx.create.execute({ authorId: 'author', title: 'Draft number one', body: 'x', tags: [] });
    await publishedItem(ctx, 'Published one', 'author');

    const mine = await ctx.list.execute({
      viewerId: 'author',
      filters: { ...published, status: 'draft' },
      sort: { field: 'createdAt', order: 'desc' },
      pagination: { mode: 'offset', page: 1, pageSize: 10 },
    });
    expect(mine.page.items).toHaveLength(1);

    const theirs = ctx.list.execute({
      viewerId: 'reader',
      filters: { ...published, status: 'draft', authorId: 'author' },
      sort: { field: 'createdAt', order: 'desc' },
      pagination: { mode: 'offset', page: 1, pageSize: 10 },
    });
    await expect(theirs).rejects.toBeInstanceOf(NotItemOwnerError);

    // Without an authorId the filter is forced to the viewer, so a reader sees no drafts at all.
    const none = await ctx.list.execute({
      viewerId: 'reader',
      filters: { ...published, status: 'draft' },
      sort: { field: 'createdAt', order: 'desc' },
      pagination: { mode: 'offset', page: 1, pageSize: 10 },
    });
    expect(none.page.items).toHaveLength(0);
  });

  it('filters by tags in any and all mode', async () => {
    const ctx = setup();
    await publishedItem(ctx, 'Only mongo', 'a', ['mongodb']);
    await publishedItem(ctx, 'Mongo and node', 'a', ['mongodb', 'node']);
    await publishedItem(ctx, 'Only node', 'a', ['node']);
    const run = (tagMode: 'any' | 'all') =>
      ctx.list.execute({
        viewerId: 'r',
        filters: { ...published, tags: ['mongodb', 'node'], tagMode },
        sort: { field: 'title', order: 'asc' },
        pagination: { mode: 'offset', page: 1, pageSize: 10 },
      });
    expect((await run('any')).page.items.map((item) => item.title)).toEqual(['Mongo and node', 'Only mongo', 'Only node']);
    expect((await run('all')).page.items.map((item) => item.title)).toEqual(['Mongo and node']);
  });

  it('walks every item exactly once with cursors, even when many share the same sort value', async () => {
    const ctx = setup();
    // 7 items with the same likes count and 5 with another one: ties are the hard case for keyset pagination.
    for (let index = 0; index < 12; index++) {
      const item = await publishedItem(ctx, `Post number ${index}`);
      ctx.items.addLikes(item.id, index < 7 ? 3 : 5);
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const result = await ctx.list.execute({
        viewerId: 'r',
        filters: published,
        sort: { field: 'likes', order: 'desc' },
        pagination: { mode: 'cursor', cursor, pageSize: 5 },
      });
      const page = result.page as CursorPage<Item>;
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
    const likes = seen.map((id) => ctx.items.items.get(id)?.stats.likes);
    expect(likes).toEqual([...likes].sort((a, b) => (b as number) - (a as number)));
  });
});
