import { CollectionFullError, CollectionNotFoundError, InvalidCollectionError, ItemNotFoundError } from '../domain/errors';
import { Item } from '../domain/item';
import { FixedClock, InMemoryCollectionRepository, InMemoryItemRepository } from '../testing/in-memory-repositories';
import { AddItemsToCollectionUseCase } from './add-items-to-collection.use-case';
import { CreateCollectionUseCase } from './create-collection.use-case';
import { CreateItemUseCase } from './create-item.use-case';
import { GetCollectionUseCase } from './get-collection.use-case';
import { ListCollectionsUseCase } from './list-collections.use-case';
import { PublishItemUseCase } from './publish-item.use-case';

function setup() {
  const items = new InMemoryItemRepository();
  const collections = new InMemoryCollectionRepository(items);
  const clock = new FixedClock();
  const createItem = new CreateItemUseCase(items, clock);
  const publish = new PublishItemUseCase(items, clock);
  return {
    items,
    createItem,
    publish,
    create: new CreateCollectionUseCase(collections, clock),
    list: new ListCollectionsUseCase(collections),
    add: new AddItemsToCollectionUseCase(collections),
    get: new GetCollectionUseCase(collections),
  };
}

async function publishedItems(ctx: ReturnType<typeof setup>, count: number, authorId = 'author'): Promise<Item[]> {
  const result: Item[] = [];
  for (let index = 0; index < count; index++) {
    const draft = await ctx.createItem.execute({ authorId, title: `Item number ${index}`, body: 'text', tags: [] });
    result.push(await ctx.publish.execute(draft.id, authorId));
  }
  return result;
}

describe('collections', () => {
  it('adds items in one call, ignores repeats and returns them in the stored order', async () => {
    const ctx = setup();
    const [a, b, c] = await publishedItems(ctx, 3);
    const collection = await ctx.create.execute('owner', 'Reading list');

    await ctx.add.execute(collection.id, 'owner', [c.id, a.id]);
    const updated = await ctx.add.execute(collection.id, 'owner', [a.id, b.id]);
    expect(updated.itemIds).toEqual([c.id, a.id, b.id]);

    const detail = await ctx.get.execute(collection.id, 'owner');
    expect(detail.items.map((item) => item.id)).toEqual([c.id, a.id, b.id]);
  });

  it('is all or nothing when one id does not exist', async () => {
    const ctx = setup();
    const [a] = await publishedItems(ctx, 1);
    const collection = await ctx.create.execute('owner', 'List');
    await expect(ctx.add.execute(collection.id, 'owner', [a.id, 'f'.repeat(24)])).rejects.toBeInstanceOf(ItemNotFoundError);
    expect((await ctx.get.execute(collection.id, 'owner')).items).toHaveLength(0);
  });

  it('keeps collections private to their owner', async () => {
    const ctx = setup();
    const [a] = await publishedItems(ctx, 1);
    const collection = await ctx.create.execute('owner', 'List');
    await expect(ctx.add.execute(collection.id, 'intruder', [a.id])).rejects.toBeInstanceOf(CollectionNotFoundError);
    await expect(ctx.get.execute(collection.id, 'intruder')).rejects.toBeInstanceOf(CollectionNotFoundError);
    expect((await ctx.list.execute('intruder', 1, 10)).total).toBe(0);
    expect((await ctx.list.execute('owner', 1, 10)).total).toBe(1);
  });

  it("does not show other people's drafts inside a collection", async () => {
    const ctx = setup();
    const draft = await ctx.createItem.execute({ authorId: 'author', title: 'Hidden draft', body: 'x', tags: [] });
    const collection = await ctx.create.execute('owner', 'List');
    await expect(ctx.add.execute(collection.id, 'owner', [draft.id])).rejects.toBeInstanceOf(ItemNotFoundError);
  });

  it('enforces the request cap and the collection cap', async () => {
    const ctx = setup();
    const collection = await ctx.create.execute('owner', 'Big');
    const many = await publishedItems(ctx, 51, 'owner');
    await expect(ctx.add.execute(collection.id, 'owner', many.map((item) => item.id))).rejects.toBeInstanceOf(InvalidCollectionError);

    const more = await publishedItems(ctx, 160, 'owner');
    const all = [...many, ...more].map((item) => item.id);
    for (let start = 0; start < 200; start += 50) {
      await ctx.add.execute(collection.id, 'owner', all.slice(start, start + 50));
    }
    const extra = (await publishedItems(ctx, 1, 'owner'))[0];
    await expect(ctx.add.execute(collection.id, 'owner', [extra.id])).rejects.toBeInstanceOf(CollectionFullError);
  });
});
