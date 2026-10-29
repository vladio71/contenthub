import request from 'supertest';
import { AccessTokenService } from '@contenthub/common';
import { CatalogTestApp, createCatalogTestApp } from './testing/create-test-app';
import { TEST_SECRET } from './testing/in-memory-repositories';

/** HTTP layer with real controllers, guard, DTO validation and error filter. Repositories are in memory. */
describe('catalog HTTP', () => {
  const tokens = new AccessTokenService(TEST_SECRET);
  const bearer = (sub: string) => `Bearer ${tokens.sign({ sub, login: sub, name: sub, email: null, sid: 's'.repeat(24) })}`;
  const alice = bearer('alice');
  const bob = bearer('bob');

  let ctx: CatalogTestApp;
  const http = () => ctx.app.getHttpServer();

  async function createItem(auth: string, title: string, tags: string[] = [], publish = true) {
    const created = await request(http()).post('/api/catalog/items').set('Authorization', auth).send({ title, body: `About ${title}`, tags });
    expect(created.status).toBe(201);
    if (publish) {
      const published = await request(http()).post(`/api/catalog/items/${created.body.id}/publish`).set('Authorization', auth);
      expect(published.status).toBe(200);
      return published.body as { id: string; slug: string; tags: string[] };
    }
    return created.body as { id: string; slug: string; tags: string[] };
  }

  beforeAll(async () => {
    ctx = await createCatalogTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('rejects requests without a token', async () => {
    expect((await request(http()).get('/api/catalog/items')).status).toBe(401);
    expect((await request(http()).get('/api/catalog/stats/tags')).status).toBe(401);
  });

  it('validates input', async () => {
    const bad = await request(http()).post('/api/catalog/items').set('Authorization', alice).send({ title: 'x', body: 5, extra: 1 });
    expect(bad.status).toBe(400);
    const badTag = await request(http()).post('/api/catalog/items').set('Authorization', alice).send({ title: 'Valid title', body: 'b', tags: ['Not Valid!'] });
    expect(badTag.status).toBe(400);
    expect(badTag.body.code).toBe('INVALID_ITEM');
    const badQuery = await request(http()).get('/api/catalog/items').set('Authorization', alice).query({ sort: 'price', pageSize: 1000, dateFrom: 'yesterday' });
    expect(badQuery.status).toBe(400);
    expect((await request(http()).get('/api/catalog/items/not-an-id/like').set('Authorization', alice)).status).toBe(404);
    expect((await request(http()).post('/api/catalog/items/not-an-id/like').set('Authorization', alice)).status).toBe(400);
  });

  it('creates, publishes, reads by slug (counting views), edits and deletes', async () => {
    const item = await createItem(alice, 'Lifecycle post', ['mongodb']);
    const first = await request(http()).get(`/api/catalog/items/${item.slug}`).set('Authorization', bob);
    const second = await request(http()).get(`/api/catalog/items/${item.slug}`).set('Authorization', bob);
    expect(first.body.stats.views).toBe(1);
    expect(second.body.stats.views).toBe(2);

    const forbidden = await request(http()).patch(`/api/catalog/items/${item.id}`).set('Authorization', bob).send({ title: 'Stolen title' });
    expect(forbidden.status).toBe(403);
    const edited = await request(http()).patch(`/api/catalog/items/${item.id}`).set('Authorization', alice).send({ title: 'Edited title' });
    expect(edited.body).toMatchObject({ title: 'Edited title', slug: item.slug });

    expect((await request(http()).delete(`/api/catalog/items/${item.id}`).set('Authorization', bob)).status).toBe(403);
    expect((await request(http()).delete(`/api/catalog/items/${item.id}`).set('Authorization', alice)).status).toBe(204);
    expect((await request(http()).get(`/api/catalog/items/${item.slug}`).set('Authorization', alice)).status).toBe(404);
  });

  it('likes once and answers 409 for a second like, then unlikes', async () => {
    const item = await createItem(alice, 'Popular post');
    const liked = await request(http()).post(`/api/catalog/items/${item.id}/like`).set('Authorization', bob);
    expect(liked.status).toBe(201);
    expect(liked.body).toEqual({ itemId: item.id, liked: true, likes: 1 });

    const again = await request(http()).post(`/api/catalog/items/${item.id}/like`).set('Authorization', bob);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_LIKED');

    const unliked = await request(http()).delete(`/api/catalog/items/${item.id}/like`).set('Authorization', bob);
    expect(unliked.body).toMatchObject({ liked: false, likes: 0 });
    expect((await request(http()).delete(`/api/catalog/items/${item.id}/like`).set('Authorization', bob)).status).toBe(404);
  });

  describe('listing', () => {
    beforeAll(async () => {
      for (let index = 0; index < 7; index++) {
        ctx.clock.set(new Date(Date.UTC(2026, 0, 10 + index)));
        await createItem(bob, `Listing post ${index}`, index % 2 === 0 ? ['listing', 'even'] : ['listing', 'odd']);
      }
      await createItem(bob, 'Listing draft', ['listing'], false);
    });

    const list = (query: Record<string, string | number>, auth = alice) =>
      request(http()).get('/api/catalog/items').set('Authorization', auth).query(query);

    it('filters by comma separated tags with mode any and all', async () => {
      const any = await list({ tags: 'even,odd', q: 'Listing', pageSize: 50 });
      expect(any.body.total).toBe(7);
      const all = await list({ tags: 'listing,even', tagMode: 'all', pageSize: 50 });
      expect(all.body.items.map((item: { title: string }) => item.title).sort()).toEqual([
        'Listing post 0',
        'Listing post 2',
        'Listing post 4',
        'Listing post 6',
      ]);
    });

    it('filters by author and by date range, and sorts by title', async () => {
      const range = await list({ authorId: 'bob', dateFrom: '2026-01-12T00:00:00Z', dateTo: '2026-01-14T23:59:59Z', sort: 'title', order: 'asc', tags: 'listing' });
      expect(range.body.items.map((item: { title: string }) => item.title)).toEqual(['Listing post 2', 'Listing post 3', 'Listing post 4']);
    });

    it('uses offset pagination by default', async () => {
      const page = await list({ authorId: 'bob', page: 2, pageSize: 3, sort: 'createdAt', order: 'asc' });
      expect(page.body).toMatchObject({ mode: 'offset', page: 2, pageSize: 3, total: 7, totalPages: 3 });
      expect(page.body.items[0].title).toBe('Listing post 3');
    });

    it('walks the list with cursors when ?cursor= is sent', async () => {
      const titles: string[] = [];
      let cursor = '';
      for (let guard = 0; guard < 10; guard++) {
        const response = await list({ authorId: 'bob', pageSize: 3, cursor, sort: 'createdAt', order: 'desc' });
        expect(response.status).toBe(200);
        expect(response.body.mode).toBe('cursor');
        titles.push(...response.body.items.map((item: { title: string }) => item.title));
        if (!response.body.nextCursor) {
          break;
        }
        cursor = response.body.nextCursor;
      }
      expect(titles).toEqual(Array.from({ length: 7 }, (_, index) => `Listing post ${6 - index}`));
    });

    it('rejects a broken cursor with 400', async () => {
      const response = await list({ cursor: 'garbage' });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_CURSOR');
    });

    it('shows drafts only to their author', async () => {
      const mine = await list({ status: 'draft' }, bob);
      expect(mine.body.total).toBe(1);
      const others = await list({ status: 'draft' }, alice);
      expect(others.body.total).toBe(0);
      expect((await list({ status: 'draft', authorId: 'bob' }, alice)).status).toBe(403);
    });
  });

  it('reports tag and author statistics', async () => {
    const tags = await request(http()).get('/api/catalog/stats/tags').set('Authorization', alice).query({ limit: 2 });
    expect(tags.status).toBe(200);
    expect(tags.body).toHaveLength(2);
    expect(tags.body[0]).toMatchObject({ tag: expect.any(String), items: expect.any(Number), likes: expect.any(Number) });

    const authors = await request(http()).get('/api/catalog/stats/authors').set('Authorization', alice);
    expect(authors.body.totals.authors).toBeGreaterThanOrEqual(2);
    expect(authors.body.topAuthors[0]).toHaveProperty('authorId');
  });

  it('builds a collection and returns the items in the stored order', async () => {
    const first = await createItem(alice, 'Collection item one');
    const second = await createItem(alice, 'Collection item two');
    const created = await request(http()).post('/api/catalog/collections').set('Authorization', alice).send({ name: 'My list' });
    expect(created.status).toBe(201);
    const collectionId = created.body.id as string;

    const added = await request(http())
      .post(`/api/catalog/collections/${collectionId}/items`)
      .set('Authorization', alice)
      .send({ itemIds: [second.id, first.id, second.id] });
    expect(added.status).toBe(200);
    expect(added.body.itemCount).toBe(2);

    const detail = await request(http()).get(`/api/catalog/collections/${collectionId}`).set('Authorization', alice);
    expect(detail.body.items.map((item: { id: string }) => item.id)).toEqual([second.id, first.id]);

    const mine = await request(http()).get('/api/catalog/collections').set('Authorization', alice);
    expect(mine.body.items[0]).toMatchObject({ id: collectionId, itemCount: 2 });
    expect((await request(http()).get(`/api/catalog/collections/${collectionId}`).set('Authorization', bob)).status).toBe(404);

    const invalid = await request(http()).post(`/api/catalog/collections/${collectionId}/items`).set('Authorization', alice).send({ itemIds: ['nope'] });
    expect(invalid.status).toBe(400);
  });

  it('serves swagger with all route groups', async () => {
    const docs = await request(http()).get('/docs-json');
    expect(Object.keys(docs.body.paths)).toEqual(
      expect.arrayContaining(['/api/catalog/items', '/api/catalog/items/{id}/like', '/api/catalog/stats/authors', '/api/catalog/collections/{id}/items']),
    );
  });
});
