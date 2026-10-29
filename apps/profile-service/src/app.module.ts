import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonAuthModule } from '@contenthub/common';
import { loadProfileConfig } from './config';
import { ProfileModule } from './profile.module';

@Module({
  imports: [
    CommonAuthModule.registerAsync(() => ({ secret: loadProfileConfig().jwtSecret })),
    MongooseModule.forRootAsync({
      useFactory: () => {
        const config = loadProfileConfig();
        return { uri: config.mongoUri, dbName: config.mongoDbName };
      },
    }),
    ProfileModule,
  ],
})
export class AppModule {}
