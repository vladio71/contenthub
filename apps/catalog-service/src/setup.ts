import { INestApplication } from '@nestjs/common';
import { applyCommonSetup } from '@contenthub/common';
import { CATALOG_PREFIX } from './config';

export function configureApp(app: INestApplication): void {
  applyCommonSetup(app, {
    prefix: CATALOG_PREFIX,
    title: 'ContentHub catalog-service',
    description: 'Content items, likes and collections. Filtering, sorting, offset and cursor pagination, aggregations.',
  });
}
