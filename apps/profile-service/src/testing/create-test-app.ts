import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { CommonAuthModule } from '@contenthub/common';
import { AVATAR_STORAGE, CLOCK } from '../application/ports';
import { PROFILE_CONFIG } from '../config';
import { PROFILE_REPOSITORY } from '../domain/repositories/profile-repository';
import { PROFILE_MODEL } from '../infrastructure/mongo/profile.schema';
import { ProfileModule } from '../profile.module';
import { configureApp } from '../setup';
import { FixedClock, InMemoryAvatarStorage, InMemoryProfileRepository, TEST_SECRET, testProfileConfig } from './fakes';

export interface ProfileTestApp {
  app: INestApplication;
  profiles: InMemoryProfileRepository;
  storage: InMemoryAvatarStorage;
}

/** The real ProfileModule with in-memory repository and storage instead of MongoDB and disk. */
export async function createProfileTestApp(avatarDir: string): Promise<ProfileTestApp> {
  const profiles = new InMemoryProfileRepository();
  const storage = new InMemoryAvatarStorage();

  const moduleRef = await Test.createTestingModule({
    imports: [CommonAuthModule.register({ secret: TEST_SECRET }), ProfileModule],
  })
    .overrideProvider(getModelToken(PROFILE_MODEL))
    .useValue({})
    .overrideProvider(PROFILE_REPOSITORY)
    .useValue(profiles)
    .overrideProvider(AVATAR_STORAGE)
    .useValue(storage)
    .overrideProvider(CLOCK)
    .useValue(new FixedClock())
    .overrideProvider(PROFILE_CONFIG)
    .useValue(testProfileConfig(avatarDir))
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return { app, profiles, storage };
}
