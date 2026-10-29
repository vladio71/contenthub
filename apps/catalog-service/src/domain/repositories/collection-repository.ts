import { OffsetPage } from '@contenthub/common';
import { Collection } from '../collection';
import { Item } from '../item';

export const COLLECTION_REPOSITORY = Symbol('COLLECTION_REPOSITORY');

export interface CollectionWithItems {
  collection: Collection;
  /** In the order they were added. Items the viewer cannot see are left out. */
  items: Item[];
}

export interface CollectionRepository {
  nextId(): string;
  insert(collection: Collection): Promise<void>;
  findById(id: string): Promise<Collection | null>;
  listByOwner(ownerId: string, page: number, pageSize: number): Promise<OffsetPage<Collection>>;
  /**
   * Adds many items in one transaction: checks that the collection belongs to the owner, that every
   * item exists, that the size cap holds, and then adds the ids with $addToSet.
   */
  addItems(collectionId: string, ownerId: string, itemIds: string[]): Promise<Collection>;
  findWithItems(collectionId: string, viewerId: string): Promise<CollectionWithItems | null>;
}
