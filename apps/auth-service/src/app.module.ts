import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonAuthModule } from '@contenthub/common';
import { AuthModule } from './auth.module';
import { loadAuthConfig } from './config';

@Module({
  imports: [
    CommonAuthModule.registerAsync(() => {
      const config = loadAuthConfig();
      return { secret: config.jwtSecret, ttlSeconds: config.accessTokenTtlSeconds };
    }),
    MongooseModule.forRootAsync({
      useFactory: () => {
        const config = loadAuthConfig();
        return { uri: config.mongoUri, dbName: config.mongoDbName };
      },
    }),
    AuthModule,
  ],
})
export class AppModule {}
