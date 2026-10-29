import { Inject, Injectable } from '@nestjs/common';
import { ItemNotFoundError } from '../domain/errors';
import { Item } from '../domain/item';
import { ITEM_REPOSITORY, ItemRepository } from '../domain/repositories/item-repository';

@Injectable()
export class GetItemBySlugUseCase {
  constructor(@Inject(ITEM_REPOSITORY) private readonly items: ItemRepository) {}

  /** Reading an item counts as a view. The counter is increased inside the repository, atomically. */
  async execute(slug: string, viewerId: string): Promise<Item> {
    const item = await this.items.viewBySlug(slug, viewerId);
    if (!item) {
      throw new ItemNotFoundError(slug);
    }
    return item;
  }
}
