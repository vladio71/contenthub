import { Inject, Injectable } from '@nestjs/common';
import { Collection } from '../domain/collection';
import { CollectionNotFoundError } from '../domain/errors';
import { COLLECTION_REPOSITORY, CollectionRepository } from '../domain/repositories/collection-repository';

@Injectable()
export class AddItemsToCollectionUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: CollectionRepository) {}

  async execute(collectionId: string, ownerId: string, itemIds: string[]): Promise<Collection> {
    const collection = await this.collections.findById(collectionId);
    if (!collection || !collection.isOwnedBy(ownerId)) {
      throw new CollectionNotFoundError(collectionId);
    }
    // Fast check of the domain rules. The repository checks them again inside the transaction,
    // because another request may have changed the collection in between.
    collection.addItems(itemIds);
    return this.collections.addItems(collectionId, ownerId, itemIds);
  }
}
