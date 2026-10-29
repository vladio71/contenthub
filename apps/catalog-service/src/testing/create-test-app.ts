import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { CommonAuthModule } from '@contenthub/common';
import { CatalogModule } from '../catalog.module';
import { CLOCK } from '../application/ports';
import { COLLECTION_REPOSITORY } from '../domain/repositories/collection-repository';
import { ITEM_REPOSITORY } from '../domain/repositories/item-repository';
import { LIKE_REPOSITORY } from '../domain/repositories/like-repository';
import { STATS_REPOSITORY } from '../domain/repositories/stats-repository';
import { COLLECTION_MODEL, ITEM_MODEL, LIKE_MODEL } from '../infrastructure/mongo/schemas';
import { configureApp } from '../setup';
import {
  FixedClock,
  InMemoryCollectionRepository,
  InMemoryItemRepository,
  InMemoryLikeRepository,
  InMemoryStatsRepository,
  TEST_SECRET,
} from './in-memory-repositories';

export interface CatalogTestApp {
  app: INestApplication;
  items: InMemoryItemRepository;
  clock: FixedClock;
}

/** The real CatalogModule (controllers, guard, pipes, filter, Swagger) over in-memory repositories. */
export async function createCatalogTestApp(): Promise<CatalogTestApp> {
  const items = new InMemoryItemRepository();
  const clock = new FixedClock();

  const moduleRef = await Test.createTestingModule({
    imports: [CommonAuthModule.register({ secret: TEST_SECRET }), CatalogModule],
  })
    .overrideProvider(getModelToken(ITEM_MODEL))
    .useValue({})
    .overrideProvider(getModelToken(LIKE_MODEL))
    .useValue({})
    .overrideProvider(getModelToken(COLLECTION_MODEL))
    .useValue({})
    .overrideProvider(ITEM_REPOSITORY)
    .useValue(items)
    .overrideProvider(LIKE_REPOSITORY)
    .useValue(new InMemoryLikeRepository(items))
    .overrideProvider(STATS_REPOSITORY)
    .useValue(new InMemoryStatsRepository(items))
    .overrideProvider(COLLECTION_REPOSITORY)
    .useValue(new InMemoryCollectionRepository(items))
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return { app, items, clock };
}

