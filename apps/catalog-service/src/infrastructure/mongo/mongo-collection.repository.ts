import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, PipelineStage, Types } from 'mongoose';
import { buildOffsetPage, OffsetPage, toSkipLimit } from '@contenthub/common';
import { Collection } from '../../domain/collection';
import { CollectionNotFoundError, ItemNotFoundError } from '../../domain/errors';
import { CollectionRepository, CollectionWithItems } from '../../domain/repositories/collection-repository';
import { ITEM_COLLECTION_NAME } from './collection-names';
import { itemToDomain } from './item.mapper';
import { runInTransaction } from './run-in-transaction';
import { COLLECTION_MODEL, CollectionRecord, ITEM_MODEL, ItemRecord } from './schemas';

interface CollectionWithItemsRecord extends CollectionRecord {
  items: ItemRecord[];
}

@Injectable()
export class MongoCollectionRepository implements CollectionRepository, OnModuleInit {
  constructor(
    @InjectModel(COLLECTION_MODEL) private readonly collectionModel: Model<CollectionRecord>,
    @InjectModel(ITEM_MODEL) private readonly itemModel: Model<ItemRecord>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.collectionModel.init();
  }

  nextId(): string {
    return new Types.ObjectId().toHexString();
  }

  async insert(collection: Collection): Promise<void> {
    await this.collectionModel.create(this.toRecord(collection));
  }

  async findById(id: string): Promise<Collection | null> {
    const record = await this.collectionModel.findById(id).lean();
    return record ? this.toDomain(record) : null;
  }

  async listByOwner(ownerId: string, page: number, pageSize: number): Promise<OffsetPage<Collection>> {
    const { skip, limit } = toSkipLimit(page, pageSize);
    const [records, total] = await Promise.all([
      this.collectionModel.find({ ownerId }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.collectionModel.countDocuments({ ownerId }),
    ]);
    return buildOffsetPage(records.map((record) => this.toDomain(record)), total, page, pageSize);
  }

  async addItems(collectionId: string, ownerId: string, itemIds: string[]): Promise<Collection> {
    const id = new Types.ObjectId(collectionId);
    const uniqueIds = [...new Set(itemIds)];
    const objectIds = uniqueIds.map((itemId) => new Types.ObjectId(itemId));

    return runInTransaction(this.connection, async (session) => {
      // Everything below reads and writes inside one transaction, so the checks cannot go stale.
      const record = await this.collectionModel.findOne({ _id: id, ownerId }, null, { session }).lean();
      if (!record) {
        throw new CollectionNotFoundError(collectionId);
      }

      const visibleItems = await this.itemModel.countDocuments(
        { _id: { $in: objectIds }, $or: [{ status: 'published' }, { authorId: ownerId }] },
        { session },
      );
      if (visibleItems !== objectIds.length) {
        throw new ItemNotFoundError('one or more of the items do not exist');
      }

      // The domain object enforces the size cap on the state we just read.
      this.toDomain(record).addItems(uniqueIds);

      // $addToSet adds only ids that are not in the array yet, so repeated calls are safe.
      const updated = await this.collectionModel
        .findOneAndUpdate({ _id: id }, { $addToSet: { itemIds: { $each: objectIds } } }, { session, returnDocument: 'after' })
        .lean();
      if (!updated) {
        throw new CollectionNotFoundError(collectionId);
      }
      return this.toDomain(updated);
    });
  }

  /**
   * One aggregation: $lookup joins the items, then $map walks the stored itemIds so the result
   * keeps the order in which items were added ($lookup alone returns them in any order).
   * Items that were deleted, or that the viewer may not see, are dropped.
   */
  async findWithItems(collectionId: string, viewerId: string): Promise<CollectionWithItems | null> {
    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(collectionId) } },
      { $lookup: { from: ITEM_COLLECTION_NAME, localField: 'itemIds', foreignField: '_id', as: 'found' } },
      {
        $project: {
          ownerId: 1,
          name: 1,
          itemIds: 1,
          createdAt: 1,
          items: {
            $filter: {
              input: {
                $map: {
                  input: '$itemIds',
                  as: 'wantedId',
                  in: {
                    $first: {
                      $filter: { input: '$found', as: 'candidate', cond: { $eq: ['$$candidate._id', '$$wantedId'] } },
                    },
                  },
                },
              },
              as: 'item',
              cond: {
                $and: [
                  { $ne: ['$$item', null] },
                  { $or: [{ $eq: ['$$item.status', 'published'] }, { $eq: ['$$item.authorId', viewerId] }] },
                ],
              },
            },
          },
        },
      },
    ];
    const [record] = await this.collectionModel.aggregate<CollectionWithItemsRecord>(pipeline);
    if (!record) {
      return null;
    }
    return { collection: this.toDomain(record), items: record.items.map(itemToDomain) };
  }

  private toRecord(collection: Collection): CollectionRecord {
    return {
      _id: new Types.ObjectId(collection.id),
      ownerId: collection.ownerId,
      name: collection.name,
      itemIds: collection.itemIds.map((itemId) => new Types.ObjectId(itemId)),
      createdAt: collection.createdAt,
    };
  }

  private toDomain(record: CollectionRecord): Collection {
    return Collection.restore({
      id: record._id.toHexString(),
      ownerId: record.ownerId,
      name: record.name,
      itemIds: record.itemIds.map((itemId) => itemId.toHexString()),
      createdAt: record.createdAt,
    });
  }
}
