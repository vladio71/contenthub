import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompleteGithubLoginUseCase } from './application/complete-github-login.use-case';
import { GetCurrentUserUseCase } from './application/get-current-user.use-case';
import { ListProvidersUseCase } from './application/list-providers.use-case';
import { ListSessionsUseCase } from './application/list-sessions.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { CLOCK, OAUTH_PROVIDER, TOKEN_CODEC } from './application/ports';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { RevokeSessionUseCase } from './application/revoke-session.use-case';
import { StartGithubLoginUseCase } from './application/start-github-login.use-case';
import { TokenIssuer } from './application/token-issuer';
import { AUTH_CONFIG, AuthConfig, loadAuthConfig } from './config';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token-repository';
import { USER_REPOSITORY } from './domain/repositories/user-repository';
import { CryptoTokenCodec } from './infrastructure/crypto-token-codec';
import { MongoRefreshTokenRepository } from './infrastructure/mongo/mongo-refresh-token.repository';
import { MongoUserRepository } from './infrastructure/mongo/mongo-user.repository';
import { REFRESH_TOKEN_MODEL, RefreshTokenSchema, USER_MODEL, UserSchema } from './infrastructure/mongo/schemas';
import { GithubOAuthClient } from './infrastructure/oauth/github-oauth.client';
import { SystemClock } from './infrastructure/system-clock';
import { AuthController } from './interfaces/http/auth.controller';
import { HealthController } from './interfaces/http/health.controller';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: USER_MODEL, schema: UserSchema },
      { name: REFRESH_TOKEN_MODEL, schema: RefreshTokenSchema },
    ]),
  ],
  controllers: [AuthController, HealthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: loadAuthConfig },
    { provide: USER_REPOSITORY, useClass: MongoUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: MongoRefreshTokenRepository },
    { provide: TOKEN_CODEC, useClass: CryptoTokenCodec },
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: OAUTH_PROVIDER,
      useFactory: (config: AuthConfig) => new GithubOAuthClient(config.github),
      inject: [AUTH_CONFIG],
    },
    TokenIssuer,
    StartGithubLoginUseCase,
    CompleteGithubLoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    GetCurrentUserUseCase,
    ListSessionsUseCase,
    RevokeSessionUseCase,
    ListProvidersUseCase,
  ],
})
export class AuthModule {}
