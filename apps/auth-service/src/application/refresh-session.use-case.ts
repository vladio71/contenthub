import { Inject, Injectable } from '@nestjs/common';
import { InvalidRefreshTokenError, RefreshTokenReuseError, UserNotFoundError } from '../domain/errors';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/repositories/refresh-token-repository';
import { USER_REPOSITORY, UserRepository } from '../domain/repositories/user-repository';
import { CLOCK, Clock, TOKEN_CODEC, TokenCodec } from './ports';
import { ClientMetadata, IssuedTokens, TokenIssuer } from './token-issuer';

export interface RefreshSessionInput extends ClientMetadata {
  refreshToken: string;
}

/**
 * Refresh token rotation: every refresh token works once and is replaced by a new one.
 * If an old token shows up again, we assume it was stolen and revoke the whole session.
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOKEN_CODEC) private readonly codec: TokenCodec,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: RefreshSessionInput): Promise<IssuedTokens> {
    const now = this.clock.now();
    const token = await this.refreshTokens.findByHash(this.codec.hash(input.refreshToken));
    if (!token) {
      throw new InvalidRefreshTokenError();
    }

    const check = token.checkRotation(now);
    if (check === 'reused') {
      await this.refreshTokens.revokeFamily(token.familyId, now);
      throw new RefreshTokenReuseError();
    }
    if (check !== 'ok') {
      throw new InvalidRefreshTokenError();
    }

    // Two requests can present the same token at the same time. Only one wins this step.
    const won = await this.refreshTokens.markUsed(token.id, now);
    if (!won) {
      await this.refreshTokens.revokeFamily(token.familyId, now);
      throw new RefreshTokenReuseError();
    }

    const user = await this.users.findById(token.userId);
    if (!user) {
      throw new UserNotFoundError(token.userId);
    }
    return this.tokenIssuer.continueSession(user, token, { userAgent: input.userAgent, ip: input.ip });
  }
}
