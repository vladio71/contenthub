import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadAuthConfig } from './config';
import { configureApp } from './setup';

async function bootstrap(): Promise<void> {
  const config = loadAuthConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger('Bootstrap').log(`auth-service on :${config.port}, docs at /docs, database ${config.mongoDbName}`);
}

void bootstrap();
