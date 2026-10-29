import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonAuthModule } from '@contenthub/common';
import { CatalogModule } from './catalog.module';
import { loadCatalogConfig } from './config';

@Module({
  imports: [
    CommonAuthModule.registerAsync(() => ({ secret: loadCatalogConfig().jwtSecret })),
    MongooseModule.forRootAsync({
      useFactory: () => {
        const config = loadCatalogConfig();
        return { uri: config.mongoUri, dbName: config.mongoDbName };
      },
    }),
    CatalogModule,
  ],
})
export class AppModule {}
