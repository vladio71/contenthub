import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadCatalogConfig } from './config';
import { configureApp } from './setup';

async function bootstrap(): Promise<void> {
  const config = loadCatalogConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`catalog-service on :${config.port}, docs at /docs, database ${config.mongoDbName}`);
}

void bootstrap();
