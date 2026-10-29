import { Inject, Injectable } from '@nestjs/common';
import { LIKE_REPOSITORY, LikeRepository } from '../domain/repositories/like-repository';
import { LikeResult } from './like-item.use-case';

@Injectable()
export class UnlikeItemUseCase {
  constructor(@Inject(LIKE_REPOSITORY) private readonly likes: LikeRepository) {}

  async execute(itemId: string, userId: string): Promise<LikeResult> {
    const count = await this.likes.remove(itemId, userId);
    return { itemId, liked: false, likes: count };
  }
}
