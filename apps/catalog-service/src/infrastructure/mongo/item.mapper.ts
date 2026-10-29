import { Types } from 'mongoose';
import { Item } from '../../domain/item';
import { Slug } from '../../domain/slug';
import { TagSet } from '../../domain/tag-set';
import { ItemRecord } from './schemas';

export function itemToDomain(record: ItemRecord): Item {
  return Item.restore({
    id: record._id.toHexString(),
    title: record.title,
    slug: Slug.restore(record.slug),
    body: record.body,
    tags: TagSet.from(record.tags),
    authorId: record.authorId,
    status: record.status,
    stats: { likes: record.stats.likes, views: record.stats.views },
    createdAt: record.createdAt,
    publishedAt: record.publishedAt,
  });
}

export function itemToRecord(item: Item): ItemRecord {
  return {
    _id: new Types.ObjectId(item.id),
    title: item.title,
    slug: item.slug,
    body: item.body,
    tags: item.tags,
    authorId: item.authorId,
    status: item.status,
    stats: item.stats,
    createdAt: item.createdAt,
    publishedAt: item.publishedAt,
  };
}
