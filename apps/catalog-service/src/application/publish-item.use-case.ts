import { Inject, Injectable } from '@nestjs/common';
import { ItemNotFoundError } from '../domain/errors';
import { Item } from '../domain/item';
import { ITEM_REPOSITORY, ItemRepository } from '../domain/repositories/item-repository';
import { CLOCK, Clock } from './ports';

@Injectable()
export class PublishItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(itemId: string, userId: string): Promise<Item> {
    const item = await this.items.findById(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    item.assertOwnedBy(userId);
    item.publish(this.clock.now());
    await this.items.save(item);
    return item;
  }
}
