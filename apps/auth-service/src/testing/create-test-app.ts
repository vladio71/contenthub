import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { CommonAuthModule } from '@contenthub/common';
import { OAuthProvider, CLOCK, OAUTH_PROVIDER } from '../application/ports';
import { AuthModule } from '../auth.module';
import { AUTH_CONFIG } from '../config';
import { REFRESH_TOKEN_REPOSITORY } from '../domain/repositories/refresh-token-repository';
import { USER_REPOSITORY } from '../domain/repositories/user-repository';
import { REFRESH_TOKEN_MODEL, USER_MODEL } from '../infrastructure/mongo/schemas';
import { configureApp } from '../setup';
import { FixedClock, TEST_SECRET, testAuthConfig } from './fakes';
import { InMemoryRefreshTokenRepository, InMemoryUserRepository } from './in-memory-repositories';

export interface AuthTestApp {
  app: INestApplication;
  users: InMemoryUserRepository;
  refreshTokens: InMemoryRefreshTokenRepository;
  clock: FixedClock;
}

/**
 * Builds the real AuthModule (controllers, guards, pipes, filters, Swagger) with
 * in-memory repositories instead of MongoDB. Proves that the DI container resolves.
 */
export async function createAuthTestApp(provider: OAuthProvider): Promise<AuthTestApp> {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const clock = new FixedClock(new Date());

  const moduleRef = await Test.createTestingModule({
    imports: [CommonAuthModule.register({ secret: TEST_SECRET }), AuthModule],
  })
    .overrideProvider(getModelToken(USER_MODEL))
    .useValue({})
    .overrideProvider(getModelToken(REFRESH_TOKEN_MODEL))
    .useValue({})
    .overrideProvider(USER_REPOSITORY)
    .useValue(users)
    .overrideProvider(REFRESH_TOKEN_REPOSITORY)
    .useValue(refreshTokens)
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(AUTH_CONFIG)
    .useValue(testAuthConfig())
    .overrideProvider(OAUTH_PROVIDER)
    .useValue(provider)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return { app, users, refreshTokens, clock };
}
