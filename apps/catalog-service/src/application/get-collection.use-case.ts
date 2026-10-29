import { Inject, Injectable } from '@nestjs/common';
import { CollectionNotFoundError } from '../domain/errors';
import { COLLECTION_REPOSITORY, CollectionRepository, CollectionWithItems } from '../domain/repositories/collection-repository';

@Injectable()
export class GetCollectionUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: CollectionRepository) {}

  async execute(collectionId: string, viewerId: string): Promise<CollectionWithItems> {
    const result = await this.collections.findWithItems(collectionId, viewerId);
    if (!result || !result.collection.isOwnedBy(viewerId)) {
      throw new CollectionNotFoundError(collectionId);
    }
    return result;
  }
}
