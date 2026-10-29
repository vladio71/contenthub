import { Inject, Injectable } from '@nestjs/common';
import { ItemNotFoundError } from '../domain/errors';
import { ITEM_REPOSITORY, ItemRepository } from '../domain/repositories/item-repository';

@Injectable()
export class DeleteItemUseCase {
  constructor(@Inject(ITEM_REPOSITORY) private readonly items: ItemRepository) {}

  async execute(itemId: string, userId: string): Promise<void> {
    const item = await this.items.findById(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    item.assertOwnedBy(userId);
    await this.items.delete(itemId);
  }
}
