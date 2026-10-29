import { CommonConfig, loadCommonConfig } from '@contenthub/common';

export type CatalogConfig = CommonConfig;

export const CATALOG_PREFIX = 'api/catalog';

export function loadCatalogConfig(): CatalogConfig {
  return loadCommonConfig({ port: 4003, dbName: 'contenthub_catalog' });
}
