import { InvalidOAuthStateError } from '../domain/errors';
import { CryptoTokenCodec } from '../infrastructure/crypto-token-codec';
import { AccessTokenService } from '@contenthub/common';
import { FakeOAuthProvider, FixedClock, TEST_SECRET, testAuthConfig } from '../testing/fakes';
import { InMemoryRefreshTokenRepository, InMemoryUserRepository } from '../testing/in-memory-repositories';
import { CompleteGithubLoginUseCase } from './complete-github-login.use-case';
import { TokenIssuer } from './token-issuer';

function setup() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const clock = new FixedClock();
  const issuer = new TokenIssuer(new AccessTokenService(TEST_SECRET), refreshTokens, new CryptoTokenCodec(), clock, testAuthConfig());
  const useCase = new CompleteGithubLoginUseCase(new FakeOAuthProvider(), users, clock, issuer);
  return { users, refreshTokens, clock, useCase };
}

const client = { userAgent: null, ip: null };

describe('CompleteGithubLoginUseCase', () => {
  it('rejects a missing or different state before calling the provider', async () => {
    const { useCase } = setup();
    await expect(useCase.execute({ code: 'c', state: 'abc', expectedState: undefined, ...client })).rejects.toBeInstanceOf(InvalidOAuthStateError);
    await expect(useCase.execute({ code: 'c', state: 'abc', expectedState: 'abd', ...client })).rejects.toBeInstanceOf(InvalidOAuthStateError);
    await expect(useCase.execute({ code: 'c', state: 'abc', expectedState: 'abcd', ...client })).rejects.toBeInstanceOf(InvalidOAuthStateError);
  });

  it('creates the user on first login and reuses it on the second', async () => {
    const { useCase, users, refreshTokens, clock } = setup();
    const first = await useCase.execute({ code: 'c', state: 's', expectedState: 's', ...client });
    clock.advance(60_000);
    const second = await useCase.execute({ code: 'c', state: 's', expectedState: 's', ...client });

    expect(users.users).toHaveLength(1);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.createdAt).toEqual(first.user.createdAt);
    expect(second.user.lastLoginAt.getTime()).toBeGreaterThan(first.user.lastLoginAt.getTime());
    // Two logins are two separate sessions
    expect(new Set(refreshTokens.tokens.map((token) => token.familyId)).size).toBe(2);
  });
});
