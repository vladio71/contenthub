import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GetMyProfileUseCase } from './application/get-my-profile.use-case';
import { GetPublicProfileUseCase } from './application/get-public-profile.use-case';
import { AVATAR_STORAGE, CLOCK } from './application/ports';
import { RemoveAvatarUseCase } from './application/remove-avatar.use-case';
import { SearchProfilesUseCase } from './application/search-profiles.use-case';
import { UpdateMyProfileUseCase } from './application/update-my-profile.use-case';
import { UpdatePreferencesUseCase } from './application/update-preferences.use-case';
import { UploadAvatarUseCase } from './application/upload-avatar.use-case';
import { loadProfileConfig, PROFILE_CONFIG } from './config';
import { PROFILE_REPOSITORY } from './domain/repositories/profile-repository';
import { LocalAvatarStorage } from './infrastructure/local-avatar-storage';
import { MongoProfileRepository } from './infrastructure/mongo/mongo-profile.repository';
import { PROFILE_MODEL, ProfileSchema } from './infrastructure/mongo/profile.schema';
import { SystemClock } from './infrastructure/system-clock';
import { HealthController } from './interfaces/http/health.controller';
import { ProfilesController } from './interfaces/http/profiles.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: PROFILE_MODEL, schema: ProfileSchema }])],
  // HealthController first: ProfilesController has ":handle", which would swallow /health.
  controllers: [HealthController, ProfilesController],
  providers: [
    { provide: PROFILE_CONFIG, useFactory: loadProfileConfig },
    { provide: PROFILE_REPOSITORY, useClass: MongoProfileRepository },
    { provide: AVATAR_STORAGE, useClass: LocalAvatarStorage },
    { provide: CLOCK, useClass: SystemClock },
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    UpdatePreferencesUseCase,
    UploadAvatarUseCase,
    RemoveAvatarUseCase,
    GetPublicProfileUseCase,
    SearchProfilesUseCase,
  ],
})
export class ProfileModule {}
