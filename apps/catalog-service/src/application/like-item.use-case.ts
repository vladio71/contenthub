import { Inject, Injectable } from '@nestjs/common';
import { InvalidItemStateError, ItemNotFoundError } from '../domain/errors';
import { ITEM_REPOSITORY, ItemRepository } from '../domain/repositories/item-repository';
import { LIKE_REPOSITORY, LikeRepository } from '../domain/repositories/like-repository';

export interface LikeResult {
  itemId: string;
  liked: boolean;
  likes: number;
}

@Injectable()
export class LikeItemUseCase {
  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(LIKE_REPOSITORY) private readonly likes: LikeRepository,
  ) {}

  async execute(itemId: string, userId: string): Promise<LikeResult> {
    const item = await this.items.findById(itemId);
    if (!item || !item.isVisibleTo(userId)) {
      throw new ItemNotFoundError(itemId);
    }
    if (item.status !== 'published') {
      throw new InvalidItemStateError('Only published items can be liked');
    }
    // A second like fails with AlreadyLikedError (HTTP 409) and nothing changes.
    const count = await this.likes.add(itemId, userId);
    return { itemId, liked: true, likes: count };
  }
}
