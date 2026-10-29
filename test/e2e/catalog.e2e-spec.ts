import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../apps/catalog-service/src/app.module';
import { configureApp } from '../../apps/catalog-service/src/setup';
import { ALICE, BOB, bearerFor, connectionOf, createApp, dropDatabaseAndClose, useE2eEnvironment } from './helpers';

interface ItemBody {
  id: string;
  slug: string;
  title: string;
  stats: { likes: number; views: number };
}

describe('catalog-service (real MongoDB, transactions need the replica set)', () => {
  let app: INestApplication;
  const alice = bearerFor(ALICE.id, ALICE.login);
  const bob = bearerFor(BOB.id, BOB.login);
  const http = () => app.getHttpServer();
  const api = (path: string) => `/api/catalog${path}`;

  async function createItem(auth: string, title: string, tags: string[], publish = true): Promise<ItemBody> {
    const created = await request(http()).post(api('/items')).set('Authorization', auth).send({ title, body: `Body about ${title}`, tags });
    expect(created.status).toBe(201);
    if (!publish) {
      return created.body;
    }
    const published = await request(http()).post(api(`/items/${created.body.id}/publish`)).set('Authorization', auth);
    expect(published.status).toBe(200);
    return published.body;
  }

  async function listAll(query: Record<string, string | number>, auth = alice): Promise<ItemBody[]> {
    const response = await request(http()).get(api('/items')).set('Authorization', auth).query({ pageSize: 100, ...query });
    expect(response.status).toBe(200);
    return response.body.items;
  }

  beforeAll(async () => {
    useE2eEnvironment('catalog');
    app = await createApp(AppModule, configureApp);
  });

  afterAll(async () => {
    await dropDatabaseAndClose(app);
  });

  describe('items', () => {
    it('creates a draft, publishes it and counts views atomically', async () => {
      const item = await createItem(alice, 'Concurrent views post', ['views']);
      const reads = await Promise.all(Array.from({ length: 20 }, () => request(http()).get(api(`/items/${item.slug}`)).set('Authorization', bob)));
      expect(reads.every((response) => response.status === 200)).toBe(true);

      const final = await request(http()).get(api(`/items/${item.slug}`)).set('Authorization', bob);
      expect(final.body.stats.views).toBe(21);
    });

    it('keeps drafts private and enforces ownership', async () => {
      const draft = await createItem(alice, 'Private draft', ['secret'], false);
      expect((await request(http()).get(api(`/items/${draft.slug}`)).set('Authorization', bob)).status).toBe(404);
      expect((await request(http()).patch(api(`/items/${draft.id}`)).set('Authorization', bob).send({ title: 'Stolen title' })).status).toBe(403);
      expect((await request(http()).delete(api(`/items/${draft.id}`)).set('Authorization', bob)).status).toBe(403);
      expect((await request(http()).get(api('/items')).set('Authorization', bob).query({ status: 'draft', authorId: ALICE.id })).status).toBe(403);
    });
  });

  describe('likes (multi-document transactions)', () => {
    it('likes, rejects a duplicate with 409 and changes nothing, then unlikes', async () => {
      const item = await createItem(alice, 'Transaction post', ['tx']);
      const first = await request(http()).post(api(`/items/${item.id}/like`)).set('Authorization', bob);
      expect(first.status).toBe(201);
      expect(first.body.likes).toBe(1);

      const duplicate = await request(http()).post(api(`/items/${item.id}/like`)).set('Authorization', bob);
      expect(duplicate.status).toBe(409);

      const db = connectionOf(app).db!;
      expect(await db.collection('likes').countDocuments({ itemId: new Types.ObjectId(item.id) })).toBe(1);
      const stored = await db.collection('items').findOne({ slug: item.slug });
      expect(stored?.stats.likes).toBe(1);

      const unliked = await request(http()).delete(api(`/items/${item.id}/like`)).set('Authorization', bob);
      expect(unliked.body.likes).toBe(0);
      expect((await request(http()).delete(api(`/items/${item.id}/like`)).set('Authorization', bob)).status).toBe(404);
    });

    it('keeps the counter equal to the number of like documents under parallel requests', async () => {
      const item = await createItem(alice, 'Parallel likes post', ['tx']);
      const users = Array.from({ length: 10 }, (_, index) => bearerFor(index.toString(16).padStart(24, '0'), `user${index}`));

      // 10 different users at once, plus 5 repeated requests from the first user
      const requests = [...users, ...Array(5).fill(users[0])].map((auth) => request(http()).post(api(`/items/${item.id}/like`)).set('Authorization', auth));
      const responses = await Promise.all(requests);

      const created = responses.filter((response) => response.status === 201).length;
      const conflicts = responses.filter((response) => response.status === 409).length;
      expect(created).toBe(10);
      expect(conflicts).toBe(5);

      const db = connectionOf(app).db!;
      const stored = await db.collection('items').findOne({ slug: item.slug });
      expect(stored?.stats.likes).toBe(10);
      expect(await db.collection('likes').countDocuments({ itemId: new Types.ObjectId(item.id) })).toBe(10);
    });

    it('deletes the likes together with the item', async () => {
      const item = await createItem(alice, 'Deleted with likes', ['tx']);
      await request(http()).post(api(`/items/${item.id}/like`)).set('Authorization', bob);
      expect((await request(http()).delete(api(`/items/${item.id}`)).set('Authorization', alice)).status).toBe(204);
      const db = connectionOf(app).db!;
      expect(await db.collection('likes').countDocuments({ itemId: new Types.ObjectId(item.id) })).toBe(0);
      expect(await db.collection('items').countDocuments({ slug: item.slug })).toBe(0);
      expect((await request(http()).post(api(`/items/${item.id}/like`)).set('Authorization', bob)).status).toBe(404);
    });
  });

  describe('listing', () => {
    beforeAll(async () => {
      // 30 items created quickly, so many share the same createdAt millisecond: that tests the _id tie breaker.
      for (let index = 0; index < 30; index++) {
        const tags = ['listing', index % 2 === 0 ? 'even' : 'odd', index % 3 === 0 ? 'three' : 'other'];
        const item = await createItem(index % 2 === 0 ? alice : bob, `Listing item ${String(index).padStart(2, '0')}`, tags);
        for (let like = 0; like < index % 4; like++) {
          await request(http()).post(api(`/items/${item.id}/like`)).set('Authorization', bearerFor(like.toString(16).padStart(24, '1'), `liker${like}`));
        }
      }
    });

    it('filters by tags in any and all mode', async () => {
      const any = await listAll({ tags: 'even,three', pageSize: 100 });
      const all = await listAll({ tags: 'even,three', tagMode: 'all', pageSize: 100 });
      expect(all.length).toBe(5);
      expect(any.length).toBeGreaterThan(all.length);
      expect((await listAll({ tags: 'listing' })).filter((item) => item.title.startsWith('Listing item'))).toHaveLength(30);
    });

    it('filters by text (text index), author and date range', async () => {
      const text = await listAll({ q: 'Listing item 07' });
      expect(text.map((item) => item.title)).toContain('Listing item 07');

      const mine = await listAll({ authorId: BOB.id, tags: 'listing' });
      expect(mine).toHaveLength(15);

      const future = await listAll({ dateFrom: new Date(Date.now() + 86_400_000).toISOString() });
      expect(future).toHaveLength(0);
      const everything = await listAll({ dateFrom: new Date(Date.now() - 86_400_000).toISOString(), dateTo: new Date(Date.now() + 86_400_000).toISOString() });
      expect(everything.length).toBeGreaterThanOrEqual(30);
    });

    it.each([
      ['createdAt', 'desc'],
      ['createdAt', 'asc'],
      ['likes', 'desc'],
      ['likes', 'asc'],
      ['title', 'asc'],
      ['title', 'desc'],
    ])('cursor pagination gives the same order as offset pagination (sort %s %s)', async (sort, order) => {
      const query = { tags: 'listing', sort, order };
      const expected = (await listAll({ ...query, pageSize: 100 })).map((item) => item.id);

      const offsetIds: string[] = [];
      for (let page = 1; page <= 4; page++) {
        offsetIds.push(...(await listAll({ ...query, page, pageSize: 8 })).map((item) => item.id));
      }

      const cursorIds: string[] = [];
      let cursor = '';
      for (let guard = 0; guard < 10; guard++) {
        const response = await request(http()).get(api('/items')).set('Authorization', alice).query({ ...query, pageSize: 8, cursor });
        expect(response.status).toBe(200);
        cursorIds.push(...response.body.items.map((item: ItemBody) => item.id));
        if (!response.body.nextCursor) {
          break;
        }
        cursor = response.body.nextCursor;
      }

      expect(offsetIds).toEqual(expected);
      expect(cursorIds).toEqual(expected);
      expect(new Set(cursorIds).size).toBe(cursorIds.length);
    });

    it('rejects a tampered cursor with 400', async () => {
      const response = await request(http()).get(api('/items')).set('Authorization', alice).query({ cursor: Buffer.from('{"value":{"$gt":""},"id":"x"}').toString('base64url') });
      expect(response.status).toBe(400);
    });
  });

  describe('aggregations', () => {
    it('/stats/tags counts published items per tag', async () => {
      const response = await request(http()).get(api('/stats/tags')).set('Authorization', alice).query({ limit: 5 });
      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(5);
      expect(response.body[0].tag).toBe('listing');
      const counts = response.body.map((row: { items: number }) => row.items);
      expect(counts).toEqual([...counts].sort((a: number, b: number) => b - a));
    });

    it('/stats/authors returns the top list and totals in one aggregation', async () => {
      const response = await request(http()).get(api('/stats/authors')).set('Authorization', alice).query({ limit: 1 });
      expect(response.status).toBe(200);
      expect(response.body.topAuthors).toHaveLength(1);
      expect(response.body.totals.authors).toBe(2);
      expect(response.body.totals.items).toBeGreaterThanOrEqual(30);
    });
  });

  describe('collections', () => {
    it('adds items in a transaction, keeps the stored order and ignores repeats', async () => {
      const a = await createItem(alice, 'Collection item A', ['col']);
      const b = await createItem(alice, 'Collection item B', ['col']);
      const c = await createItem(alice, 'Collection item C', ['col']);
      const created = await request(http()).post(api('/collections')).set('Authorization', alice).send({ name: 'Ordered' });
      const id = created.body.id as string;

      await request(http()).post(api(`/collections/${id}/items`)).set('Authorization', alice).send({ itemIds: [c.id, a.id] });
      const second = await request(http()).post(api(`/collections/${id}/items`)).set('Authorization', alice).send({ itemIds: [a.id, b.id, c.id] });
      expect(second.body.itemCount).toBe(3);

      const detail = await request(http()).get(api(`/collections/${id}`)).set('Authorization', alice);
      expect(detail.body.items.map((item: ItemBody) => item.id)).toEqual([c.id, a.id, b.id]);

      // delete one item: the $lookup simply no longer finds it
      await request(http()).delete(api(`/items/${a.id}`)).set('Authorization', alice);
      const afterDelete = await request(http()).get(api(`/collections/${id}`)).set('Authorization', alice);
      expect(afterDelete.body.items.map((item: ItemBody) => item.id)).toEqual([c.id, b.id]);
    });

    it('is all or nothing: one unknown id adds nothing', async () => {
      const a = await createItem(alice, 'All or nothing item', ['col']);
      const created = await request(http()).post(api('/collections')).set('Authorization', alice).send({ name: 'Atomic' });
      const id = created.body.id as string;
      const failed = await request(http())
        .post(api(`/collections/${id}/items`))
        .set('Authorization', alice)
        .send({ itemIds: [a.id, 'f'.repeat(24)] });
      expect(failed.status).toBe(404);
      const detail = await request(http()).get(api(`/collections/${id}`)).set('Authorization', alice);
      expect(detail.body.itemCount).toBe(0);
    });

    it('stops at the cap of 200 items with 409', async () => {
      const created = await request(http()).post(api('/collections')).set('Authorization', alice).send({ name: 'Capped' });
      const id = created.body.id as string;
      const ids: string[] = [];
      for (let index = 0; index < 201; index++) {
        const item = await request(http()).post(api('/items')).set('Authorization', alice).send({ title: `Cap item ${index}`, body: 'x' });
        await request(http()).post(api(`/items/${item.body.id}/publish`)).set('Authorization', alice);
        ids.push(item.body.id);
      }
      for (let start = 0; start < 200; start += 50) {
        const ok = await request(http()).post(api(`/collections/${id}/items`)).set('Authorization', alice).send({ itemIds: ids.slice(start, start + 50) });
        expect(ok.status).toBe(200);
      }
      const full = await request(http()).post(api(`/collections/${id}/items`)).set('Authorization', alice).send({ itemIds: [ids[200]] });
      expect(full.status).toBe(409);
      expect(full.body.code).toBe('COLLECTION_FULL');
    }, 120_000);

    it('keeps collections private', async () => {
      const created = await request(http()).post(api('/collections')).set('Authorization', alice).send({ name: 'Mine' });
      expect((await request(http()).get(api(`/collections/${created.body.id}`)).set('Authorization', bob)).status).toBe(404);
    });
  });

  it('has the indexes the queries rely on', async () => {
    const db = connectionOf(app).db!;
    const items = await db.collection('items').indexes();
    expect(items.some((index) => index.unique && index.key.slug === 1)).toBe(true);
    expect(items.some((index) => index.name === 'item_text')).toBe(true);
    const likes = await db.collection('likes').indexes();
    expect(likes.some((index) => index.unique && index.key.itemId === 1 && index.key.userId === 1)).toBe(true);
  });
});
