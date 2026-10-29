import { Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { InvalidOAuthStateError } from '../domain/errors';
import { USER_REPOSITORY, UserRepository } from '../domain/repositories/user-repository';
import { User } from '../domain/user';
import { CLOCK, Clock, OAUTH_PROVIDER, OAuthProvider } from './ports';
import { ClientMetadata, IssuedTokens, TokenIssuer } from './token-issuer';

export interface CompleteGithubLoginInput extends ClientMetadata {
  code: string;
  /** From the callback query string. */
  state: string;
  /** From the cookie we set at the start of the login. */
  expectedState: string | undefined;
}

export interface LoginResult {
  tokens: IssuedTokens;
  user: User;
}

@Injectable()
export class CompleteGithubLoginUseCase {
  constructor(
    @Inject(OAUTH_PROVIDER) private readonly provider: OAuthProvider,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly tokenIssuer: TokenIssuer,
  ) {}

  async execute(input: CompleteGithubLoginInput): Promise<LoginResult> {
    if (!input.expectedState || !statesMatch(input.expectedState, input.state)) {
      throw new InvalidOAuthStateError();
    }
    const providerToken = await this.provider.exchangeCodeForToken(input.code);
    const profile = await this.provider.fetchUserProfile(providerToken);
    const user = await this.users.upsertFromProvider(profile, this.clock.now());
    const tokens = await this.tokenIssuer.startSession(user, { userAgent: input.userAgent, ip: input.ip });
    return { tokens, user };
  }
}

function statesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
