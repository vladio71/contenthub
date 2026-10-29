import { Inject, Injectable } from '@nestjs/common';
import { ItemNotFoundError } from '../domain/errors';
import { Item, ItemEdit } from '../domain/item';
import { ITEM_REPOSITORY, ItemRepository } from '../domain/repositories/item-repository';

export interface UpdateItemInput extends ItemEdit {
  /** The only status change allowed through PATCH. Publishing has its own endpoint. */
  archive?: boolean;
}

@Injectable()
export class UpdateItemUseCase {
  constructor(@Inject(ITEM_REPOSITORY) private readonly items: ItemRepository) {}

  async execute(itemId: string, userId: string, input: UpdateItemInput): Promise<Item> {
    const item = await this.items.findById(itemId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    item.assertOwnedBy(userId);
    item.edit({ title: input.title, body: input.body, tags: input.tags });
    if (input.archive) {
      item.archive();
    }
    await this.items.save(item);
    return item;
  }
}
