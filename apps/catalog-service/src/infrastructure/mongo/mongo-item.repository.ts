import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, PipelineStage, Types } from 'mongoose';
import { buildOffsetPage, CursorPage, decodeCursor, OffsetPage, toSkipLimit } from '@contenthub/common';
import { Item } from '../../domain/item';
import { CursorListQuery, ItemRepository, OffsetListQuery } from '../../domain/repositories/item-repository';
import { itemToDomain, itemToRecord } from './item.mapper';
import { buildItemMatch, buildKeysetCondition, buildSort, cursorFor } from './item-query';
import { runInTransaction } from './run-in-transaction';
import { ITEM_MODEL, ItemRecord, LIKE_MODEL, LikeRecord } from './schemas';

@Injectable()
export class MongoItemRepository implements ItemRepository, OnModuleInit {
  constructor(
    @InjectModel(ITEM_MODEL) private readonly itemModel: Model<ItemRecord>,
    @InjectModel(LIKE_MODEL) private readonly likeModel: Model<LikeRecord>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.itemModel.init();
  }

  nextId(): string {
    return new Types.ObjectId().toHexString();
  }

  async insert(item: Item): Promise<void> {
    await this.itemModel.create(itemToRecord(item));
  }

  async findById(id: string): Promise<Item | null> {
    const record = await this.itemModel.findById(id).lean();
    return record ? itemToDomain(record) : null;
  }

  async save(item: Item): Promise<void> {
    // Only $set the fields the domain controls. stats are changed with $inc elsewhere,
    // so saving an old copy of the item can never overwrite newer counters.
    await this.itemModel.updateOne(
      { _id: new Types.ObjectId(item.id) },
      { $set: { title: item.title, body: item.body, tags: item.tags, status: item.status, publishedAt: item.publishedAt } },
    );
  }

  async delete(id: string): Promise<void> {
    const itemId = new Types.ObjectId(id);
    // The item and its likes disappear together.
    await runInTransaction(this.connection, async (session) => {
      await this.itemModel.deleteOne({ _id: itemId }, { session });
      await this.likeModel.deleteMany({ itemId }, { session });
    });
  }

  async viewBySlug(slug: string, viewerId: string): Promise<Item | null> {
    // One atomic step: find the item AND add a view. Two readers at once never lose a view.
    const record = await this.itemModel
      .findOneAndUpdate(
        { slug, $or: [{ status: 'published' }, { authorId: viewerId }] },
        { $inc: { 'stats.views': 1 } },
        { returnDocument: 'after' },
      )
      .lean();
    return record ? itemToDomain(record) : null;
  }

  /** Offset pagination with Mongoose: find + sort + skip + limit, and a count for the page numbers. */
  async listOffset(query: OffsetListQuery): Promise<OffsetPage<Item>> {
    const match = buildItemMatch(query.filters);
    const { skip, limit } = toSkipLimit(query.page, query.pageSize);
    const [records, total] = await Promise.all([
      this.itemModel.find(match).sort(buildSort(query.sort)).skip(skip).limit(limit).lean(),
      this.itemModel.countDocuments(match),
    ]);
    return buildOffsetPage(records.map(itemToDomain), total, query.page, query.pageSize);
  }

  /**
   * Keyset pagination with a native aggregation pipeline. No skip, so page 1000 is as fast as page 1.
   * We ask for one row more than the page size, to know if there is a next page without a count.
   */
  async listCursor(query: CursorListQuery): Promise<CursorPage<Item>> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const keyset = buildKeysetCondition(query.sort, cursor);
    const pipeline: PipelineStage[] = [
      { $match: { ...buildItemMatch(query.filters), ...(keyset ?? {}) } },
      { $sort: buildSort(query.sort) },
      { $limit: query.pageSize + 1 },
    ];
    const records = await this.itemModel.aggregate<ItemRecord>(pipeline);

    const hasMore = records.length > query.pageSize;
    const items = records.slice(0, query.pageSize).map(itemToDomain);
    const last = items[items.length - 1];
    return { items, pageSize: query.pageSize, nextCursor: hasMore && last ? cursorFor(last, query.sort) : null };
  }
}
