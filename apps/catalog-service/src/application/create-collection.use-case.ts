import { Inject, Injectable } from '@nestjs/common';
import { Collection } from '../domain/collection';
import { COLLECTION_REPOSITORY, CollectionRepository } from '../domain/repositories/collection-repository';
import { CLOCK, Clock } from './ports';

@Injectable()
export class CreateCollectionUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collections: CollectionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(ownerId: string, name: string): Promise<Collection> {
    const collection = Collection.create({ id: this.collections.nextId(), ownerId, name, now: this.clock.now() });
    await this.collections.insert(collection);
    return collection;
  }
}
