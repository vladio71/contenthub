import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/repositories/refresh-token-repository';
import { CLOCK, Clock, TOKEN_CODEC, TokenCodec } from './ports';

/** Logout never fails: an unknown token means there is nothing left to revoke. */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(TOKEN_CODEC) private readonly codec: TokenCodec,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const token = await this.refreshTokens.findByHash(this.codec.hash(refreshToken));
    if (token) {
      await this.refreshTokens.revokeFamily(token.familyId, this.clock.now());
    }
  }
}
