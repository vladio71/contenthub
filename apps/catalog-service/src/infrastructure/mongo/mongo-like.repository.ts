import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { duplicateKeyFields } from '@contenthub/common';
import { AlreadyLikedError, ItemNotFoundError, LikeNotFoundError } from '../../domain/errors';
import { LikeRepository } from '../../domain/repositories/like-repository';
import { runInTransaction } from './run-in-transaction';
import { ITEM_MODEL, ItemRecord, LIKE_MODEL, LikeRecord } from './schemas';

@Injectable()
export class MongoLikeRepository implements LikeRepository, OnModuleInit {
  constructor(
    @InjectModel(LIKE_MODEL) private readonly likeModel: Model<LikeRecord>,
    @InjectModel(ITEM_MODEL) private readonly itemModel: Model<ItemRecord>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.likeModel.init();
  }

  async add(itemId: string, userId: string): Promise<number> {
    const id = new Types.ObjectId(itemId);
    try {
      return await runInTransaction(this.connection, async (session) => {
        // If this user already liked the item, the unique index throws and the transaction aborts.
        await this.likeModel.create([{ itemId: id, userId, createdAt: new Date() }], { session });
        const item = await this.itemModel
          .findOneAndUpdate({ _id: id }, { $inc: { 'stats.likes': 1 } }, { session, returnDocument: 'after' })
          .lean();
        if (!item) {
          throw new ItemNotFoundError(itemId);
        }
        return item.stats.likes;
      });
    } catch (error) {
      if (duplicateKeyFields(error)) {
        throw new AlreadyLikedError();
      }
      throw error;
    }
  }

  async remove(itemId: string, userId: string): Promise<number> {
    const id = new Types.ObjectId(itemId);
    return runInTransaction(this.connection, async (session) => {
      const deleted = await this.likeModel.deleteOne({ itemId: id, userId }, { session });
      if (deleted.deletedCount === 0) {
        throw new LikeNotFoundError();
      }
      const item = await this.itemModel
        .findOneAndUpdate({ _id: id }, { $inc: { 'stats.likes': -1 } }, { session, returnDocument: 'after' })
        .lean();
      if (!item) {
        throw new ItemNotFoundError(itemId);
      }
      return item.stats.likes;
    });
  }
}
