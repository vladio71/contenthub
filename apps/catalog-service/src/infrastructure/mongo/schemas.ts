import { Schema, Types } from 'mongoose';
import { ItemStatus } from '../../domain/item';

export const ITEM_MODEL = 'Item';
export const LIKE_MODEL = 'Like';
export const COLLECTION_MODEL = 'Collection';

export interface ItemRecord {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  body: string;
  tags: string[];
  authorId: string;
  status: ItemStatus;
  stats: { likes: number; views: number };
  createdAt: Date;
  publishedAt: Date | null;
}

export const ItemSchema = new Schema<ItemRecord>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    body: { type: String, default: '' },
    tags: { type: [String], default: [] },
    authorId: { type: String, required: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], required: true },
    stats: {
      type: new Schema({ likes: { type: Number, default: 0 }, views: { type: Number, default: 0 } }, { _id: false }),
      required: true,
    },
    createdAt: { type: Date, required: true },
    publishedAt: { type: Date, default: null },
  },
  { collection: 'items', versionKey: false },
);

ItemSchema.index({ slug: 1 }, { unique: true });
// Text search for ?q=. Title matters more than body and tags.
ItemSchema.index({ title: 'text', body: 'text', tags: 'text' }, { weights: { title: 10, tags: 5, body: 1 }, name: 'item_text' });
// Indexes for the common list queries. The last key is _id, the tie breaker of keyset pagination.
ItemSchema.index({ status: 1, createdAt: -1, _id: -1 });
ItemSchema.index({ status: 1, 'stats.likes': -1, _id: -1 });
ItemSchema.index({ status: 1, title: 1, _id: 1 });
ItemSchema.index({ tags: 1, status: 1 });
ItemSchema.index({ authorId: 1, status: 1, createdAt: -1 });

export interface LikeRecord {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;
  userId: string;
  createdAt: Date;
}

export const LikeSchema = new Schema<LikeRecord>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'likes', versionKey: false },
);
// One like per user and item. The transaction relies on this index to answer 409.
LikeSchema.index({ itemId: 1, userId: 1 }, { unique: true });
LikeSchema.index({ userId: 1, createdAt: -1 });

export interface CollectionRecord {
  _id: Types.ObjectId;
  ownerId: string;
  name: string;
  itemIds: Types.ObjectId[];
  createdAt: Date;
}

export const CollectionSchema = new Schema<CollectionRecord>(
  {
    ownerId: { type: String, required: true },
    name: { type: String, required: true },
    itemIds: { type: [Schema.Types.ObjectId], default: [] },
    createdAt: { type: Date, required: true },
  },
  { collection: 'collections', versionKey: false },
);
CollectionSchema.index({ ownerId: 1, createdAt: -1 });
