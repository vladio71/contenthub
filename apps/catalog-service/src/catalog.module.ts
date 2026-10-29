import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AddItemsToCollectionUseCase } from './application/add-items-to-collection.use-case';
import { CreateCollectionUseCase } from './application/create-collection.use-case';
import { CreateItemUseCase } from './application/create-item.use-case';
import { DeleteItemUseCase } from './application/delete-item.use-case';
import { GetCollectionUseCase } from './application/get-collection.use-case';
import { GetItemBySlugUseCase } from './application/get-item-by-slug.use-case';
import { LikeItemUseCase } from './application/like-item.use-case';
import { ListCollectionsUseCase } from './application/list-collections.use-case';
import { ListItemsUseCase } from './application/list-items.use-case';
import { CLOCK } from './application/ports';
import { PublishItemUseCase } from './application/publish-item.use-case';
import { GetAuthorStatsUseCase, GetTagStatsUseCase } from './application/stats.use-cases';
import { UnlikeItemUseCase } from './application/unlike-item.use-case';
import { UpdateItemUseCase } from './application/update-item.use-case';
import { COLLECTION_REPOSITORY } from './domain/repositories/collection-repository';
import { ITEM_REPOSITORY } from './domain/repositories/item-repository';
import { LIKE_REPOSITORY } from './domain/repositories/like-repository';
import { STATS_REPOSITORY } from './domain/repositories/stats-repository';
import { MongoCollectionRepository } from './infrastructure/mongo/mongo-collection.repository';
import { MongoItemRepository } from './infrastructure/mongo/mongo-item.repository';
import { MongoLikeRepository } from './infrastructure/mongo/mongo-like.repository';
import { MongoStatsRepository } from './infrastructure/mongo/mongo-stats.repository';
import {
  COLLECTION_MODEL,
  CollectionSchema,
  ITEM_MODEL,
  ItemSchema,
  LIKE_MODEL,
  LikeSchema,
} from './infrastructure/mongo/schemas';
import { SystemClock } from './infrastructure/system-clock';
import { CollectionsController } from './interfaces/http/collections.controller';
import { HealthController } from './interfaces/http/health.controller';
import { ItemsController } from './interfaces/http/items.controller';
import { StatsController } from './interfaces/http/stats.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ITEM_MODEL, schema: ItemSchema },
      { name: LIKE_MODEL, schema: LikeSchema },
      { name: COLLECTION_MODEL, schema: CollectionSchema },
    ]),
  ],
  controllers: [ItemsController, StatsController, CollectionsController, HealthController],
  providers: [
    { provide: ITEM_REPOSITORY, useClass: MongoItemRepository },
    { provide: LIKE_REPOSITORY, useClass: MongoLikeRepository },
    { provide: STATS_REPOSITORY, useClass: MongoStatsRepository },
    { provide: COLLECTION_REPOSITORY, useClass: MongoCollectionRepository },
    { provide: CLOCK, useClass: SystemClock },
    CreateItemUseCase,
    ListItemsUseCase,
    GetItemBySlugUseCase,
    UpdateItemUseCase,
    DeleteItemUseCase,
    PublishItemUseCase,
    LikeItemUseCase,
    UnlikeItemUseCase,
    GetTagStatsUseCase,
    GetAuthorStatsUseCase,
    CreateCollectionUseCase,
    ListCollectionsUseCase,
    AddItemsToCollectionUseCase,
    GetCollectionUseCase,
  ],
})
export class CatalogModule {}
