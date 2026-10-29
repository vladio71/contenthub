import { Collection, MAX_ITEMS_PER_COLLECTION, MAX_ITEMS_PER_REQUEST } from './collection';
import { CollectionFullError, InvalidCollectionError } from './errors';

const id = (n: number) => n.toString(16).padStart(24, '0');

function newCollection(): Collection {
  return Collection.create({ id: id(1), ownerId: 'owner', name: ' Reading list ', now: new Date() });
}

describe('Collection', () => {
  it('trims the name and rejects an empty one', () => {
    expect(newCollection().name).toBe('Reading list');
    expect(() => Collection.create({ id: id(1), ownerId: 'o', name: '  ', now: new Date() })).toThrow(InvalidCollectionError);
  });

  it('adds only new ids and keeps the order', () => {
    const collection = newCollection();
    expect(collection.addItems([id(5), id(3), id(5)])).toEqual([id(5), id(3)]);
    expect(collection.addItems([id(3), id(9)])).toEqual([id(9)]);
    expect(collection.itemIds).toEqual([id(5), id(3), id(9)]);
  });

  it('limits one request', () => {
    const collection = newCollection();
    expect(() => collection.addItems([])).toThrow(InvalidCollectionError);
    const tooMany = Array.from({ length: MAX_ITEMS_PER_REQUEST + 1 }, (_, index) => id(index + 10));
    expect(() => collection.addItems(tooMany)).toThrow(InvalidCollectionError);
  });

  it('limits the whole collection and leaves it unchanged when the cap would be broken', () => {
    const collection = newCollection();
    let next = 100;
    while (collection.itemIds.length < MAX_ITEMS_PER_COLLECTION) {
      collection.addItems(Array.from({ length: MAX_ITEMS_PER_REQUEST }, () => id(next++)));
    }
    expect(collection.itemIds).toHaveLength(MAX_ITEMS_PER_COLLECTION);
    expect(() => collection.addItems([id(99999)])).toThrow(CollectionFullError);
    expect(collection.itemIds).toHaveLength(MAX_ITEMS_PER_COLLECTION);
    // ids that are already inside do not count as new
    expect(collection.addItems([id(100)])).toEqual([]);
  });
});
