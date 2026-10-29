import { OffsetPage } from '@contenthub/common';
import { LikeResult } from '../../application/like-item.use-case';
import { ListItemsResult } from '../../application/list-items.use-case';
import { Collection } from '../../domain/collection';
import { Item } from '../../domain/item';
import { CollectionWithItems } from '../../domain/repositories/collection-repository';
import { CollectionDetailResponseDto, CollectionPageResponseDto, CollectionResponseDto } from './dto/collection.dto';
import { ItemListResponseDto, ItemResponseDto, LikeResponseDto } from './dto/item.dto';

export function toItemResponse(item: Item): ItemResponseDto {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    body: item.body,
    tags: item.tags,
    authorId: item.authorId,
    status: item.status,
    stats: item.stats,
    createdAt: item.createdAt.toISOString(),
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
  };
}

export function toItemListResponse(result: ListItemsResult): ItemListResponseDto {
  if (result.mode === 'cursor') {
    return {
      mode: 'cursor',
      items: result.page.items.map(toItemResponse),
      pageSize: result.page.pageSize,
      nextCursor: result.page.nextCursor,
    };
  }
  const { items, ...paging } = result.page;
  return { mode: 'offset', items: items.map(toItemResponse), ...paging };
}

export function toLikeResponse(result: LikeResult): LikeResponseDto {
  return { itemId: result.itemId, liked: result.liked, likes: result.likes };
}

export function toCollectionResponse(collection: Collection): CollectionResponseDto {
  return {
    id: collection.id,
    ownerId: collection.ownerId,
    name: collection.name,
    itemCount: collection.itemIds.length,
    createdAt: collection.createdAt.toISOString(),
  };
}

export function toCollectionPage(page: OffsetPage<Collection>): CollectionPageResponseDto {
  const { items, ...paging } = page;
  return { items: items.map(toCollectionResponse), ...paging };
}

export function toCollectionDetail(result: CollectionWithItems): CollectionDetailResponseDto {
  return { ...toCollectionResponse(result.collection), items: result.items.map(toItemResponse) };
}
