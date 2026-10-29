import { Inject, Injectable } from '@nestjs/common';
import { AccessTokenService } from '@contenthub/common';
import { AUTH_CONFIG, AuthConfig } from '../config';
import { RefreshToken } from '../domain/refresh-token';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/repositories/refresh-token-repository';
import { User } from '../domain/user';
import { CLOCK, Clock, TOKEN_CODEC, TokenCodec } from './ports';

export interface ClientMetadata {
  userAgent: string | null;
  ip: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Creates an access JWT and a new opaque refresh token. Shared by login and refresh. */
@Injectable()
export class TokenIssuer {
  constructor(
    private readonly accessTokens: AccessTokenService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(TOKEN_CODEC) private readonly codec: TokenCodec,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** A new login: starts a new session (token family). */
  startSession(user: User, client: ClientMetadata): Promise<IssuedTokens> {
    const now = this.clock.now();
    return this.issue(user, this.refreshTokens.nextId(), now, client);
  }

  /** A refresh: same session, new token. */
  continueSession(user: User, previous: RefreshToken, client: ClientMetadata): Promise<IssuedTokens> {
    return this.issue(user, previous.familyId, previous.sessionStartedAt, client);
  }

  private async issue(user: User, familyId: string, sessionStartedAt: Date, client: ClientMetadata): Promise<IssuedTokens> {
    const refreshToken = this.codec.createOpaqueToken();
    await this.refreshTokens.insert(
      RefreshToken.issue({
        id: this.refreshTokens.nextId(),
        familyId,
        userId: user.id,
        tokenHash: this.codec.hash(refreshToken),
        sessionStartedAt,
        now: this.clock.now(),
        ttlMs: this.config.refreshTokenTtlDays * DAY_MS,
        userAgent: client.userAgent,
        ip: client.ip,
      }),
    );
    const accessToken = this.accessTokens.sign({
      sub: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      sid: familyId,
    });
    return { accessToken, refreshToken, expiresIn: this.config.accessTokenTtlSeconds };
  }
}
