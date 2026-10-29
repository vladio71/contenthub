import { Inject, Injectable } from '@nestjs/common';
import { Item } from '../domain/item';
import { ITEM_REPOSITORY, ItemRepository } from '../domain/repositories/item-repository';
import { CLOCK, Clock } from './ports';

export interface CreateItemInput {
  authorId: string;
  title: string;
  body: string;
  tags: string[];
}

@Injectable()
export class CreateItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(input: CreateItemInput): Promise<Item> {
    const item = Item.create({ id: this.items.nextId(), ...input, now: this.clock.now() });
    await this.items.insert(item);
    return item;
  }
}
