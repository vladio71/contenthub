import { Inject, Injectable } from '@nestjs/common';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/repositories/refresh-token-repository';
import { CLOCK, Clock } from './ports';

export interface SessionView {
  id: string;
  startedAt: Date;
  lastRefreshedAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
}

@Injectable()
export class ListSessionsUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(userId: string, currentSessionId: string): Promise<SessionView[]> {
    const tokens = await this.refreshTokens.listActiveByUser(userId, this.clock.now());
    return tokens.map((token) => ({
      id: token.familyId,
      startedAt: token.sessionStartedAt,
      lastRefreshedAt: token.createdAt,
      expiresAt: token.expiresAt,
      userAgent: token.userAgent,
      ip: token.ip,
      current: token.familyId === currentSessionId,
    }));
  }
}
