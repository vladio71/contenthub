import { InvalidItemError, InvalidItemStateError, NotItemOwnerError } from './errors';
import { Item } from './item';

const NOW = new Date('2026-03-01T10:00:00Z');
const ID = '65f1a2b3c4d5e6f7a8b9c0d1';

function newItem(overrides: Partial<{ title: string; body: string; tags: string[] }> = {}): Item {
  return Item.create({ id: ID, title: 'Hello MongoDB World', body: 'Some text', tags: ['mongodb'], authorId: 'author-1', now: NOW, ...overrides });
}

describe('Item', () => {
  it('starts as a draft with zero stats and a slug built from the title and id', () => {
    const item = newItem();
    expect(item.status).toBe('draft');
    expect(item.stats).toEqual({ likes: 0, views: 0 });
    expect(item.publishedAt).toBeNull();
    expect(item.slug).toBe('hello-mongodb-world-a8b9c0d1');
  });

  it('cleans and limits tags', () => {
    expect(newItem({ tags: [' MongoDB ', 'mongodb', 'Node-JS'] }).tags).toEqual(['mongodb', 'node-js']);
    expect(() => newItem({ tags: ['bad tag!'] })).toThrow(InvalidItemError);
    expect(() => newItem({ tags: Array.from({ length: 11 }, (_, index) => `tag${index}`) })).toThrow(InvalidItemError);
  });

  it('validates the title length', () => {
    expect(() => newItem({ title: 'ab' })).toThrow(InvalidItemError);
    expect(() => newItem({ title: 'x'.repeat(121) })).toThrow(InvalidItemError);
  });

  it('builds a slug from non latin titles too', () => {
    const item = newItem({ title: 'Привіт, світе' });
    expect(item.slug).toBe('a8b9c0d1');
  });

  describe('publish', () => {
    it('moves a draft to published and stores the time', () => {
      const item = newItem();
      item.publish(NOW);
      expect(item.status).toBe('published');
      expect(item.publishedAt).toEqual(NOW);
    });

    it('cannot publish twice, or publish an empty body', () => {
      const item = newItem();
      item.publish(NOW);
      expect(() => item.publish(NOW)).toThrow(InvalidItemStateError);
      expect(() => newItem({ body: '   ' }).publish(NOW)).toThrow(InvalidItemStateError);
    });
  });

  describe('edit and archive', () => {
    it('keeps the slug when the title changes', () => {
      const item = newItem();
      const slug = item.slug;
      item.edit({ title: 'A different title' });
      expect(item.title).toBe('A different title');
      expect(item.slug).toBe(slug);
    });

    it('does not allow edits after archiving', () => {
      const item = newItem();
      item.archive();
      expect(item.status).toBe('archived');
      expect(() => item.edit({ body: 'new' })).toThrow(InvalidItemStateError);
      expect(() => item.archive()).toThrow(InvalidItemStateError);
    });
  });

  describe('ownership and visibility', () => {
    it('lets only the author see a draft', () => {
      const item = newItem();
      expect(item.isVisibleTo('author-1')).toBe(true);
      expect(item.isVisibleTo('someone-else')).toBe(false);
      item.publish(NOW);
      expect(item.isVisibleTo('someone-else')).toBe(true);
    });

    it('throws for a user who is not the author', () => {
      expect(() => newItem().assertOwnedBy('someone-else')).toThrow(NotItemOwnerError);
    });
  });
});
