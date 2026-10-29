import { Inject, Injectable } from '@nestjs/common';
import { OffsetPage } from '@contenthub/common';
import { Collection } from '../domain/collection';
import { COLLECTION_REPOSITORY, CollectionRepository } from '../domain/repositories/collection-repository';

@Injectable()
export class ListCollectionsUseCase {
  constructor(@Inject(COLLECTION_REPOSITORY) private readonly collections: CollectionRepository) {}

  execute(ownerId: string, page: number, pageSize: number): Promise<OffsetPage<Collection>> {
    return this.collections.listByOwner(ownerId, page, pageSize);
  }
}
