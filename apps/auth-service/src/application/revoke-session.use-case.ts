import { Inject, Injectable } from '@nestjs/common';
import { SessionNotFoundError } from '../domain/errors';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/repositories/refresh-token-repository';
import { CLOCK, Clock } from './ports';

@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(userId: string, sessionId: string): Promise<void> {
    const revoked = await this.refreshTokens.revokeFamilyOfUser(sessionId, userId, this.clock.now());
    if (!revoked) {
      throw new SessionNotFoundError(sessionId);
    }
  }
}
