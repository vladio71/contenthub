import { AccessTokenService } from '@contenthub/common';
import { InvalidRefreshTokenError, RefreshTokenReuseError } from '../domain/errors';
import { CryptoTokenCodec } from '../infrastructure/crypto-token-codec';
import { ALICE_PROFILE, FixedClock, TEST_SECRET, testAuthConfig } from '../testing/fakes';
import { InMemoryRefreshTokenRepository, InMemoryUserRepository } from '../testing/in-memory-repositories';
import { CompleteGithubLoginUseCase } from './complete-github-login.use-case';
import { FakeOAuthProvider } from '../testing/fakes';
import { RefreshSessionUseCase } from './refresh-session.use-case';
import { TokenIssuer } from './token-issuer';

function setup() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const clock = new FixedClock();
  const codec = new CryptoTokenCodec();
  const accessTokens = new AccessTokenService(TEST_SECRET);
  const issuer = new TokenIssuer(accessTokens, refreshTokens, codec, clock, testAuthConfig());
  const login = new CompleteGithubLoginUseCase(new FakeOAuthProvider(), users, clock, issuer);
  const refresh = new RefreshSessionUseCase(refreshTokens, users, codec, clock, issuer);
  const client = { userAgent: 'jest', ip: '127.0.0.1' };
  return { users, refreshTokens, clock, accessTokens, login, refresh, client };
}

async function loginAlice(ctx: ReturnType<typeof setup>) {
  return ctx.login.execute({ code: 'code', state: 's', expectedState: 's', ...ctx.client });
}

describe('RefreshSessionUseCase', () => {
  it('rotates: the new token works and the old one is spent', async () => {
    const ctx = setup();
    const { tokens } = await loginAlice(ctx);

    const rotated = await ctx.refresh.execute({ refreshToken: tokens.refreshToken, ...ctx.client });

    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);
    const claims = ctx.accessTokens.verify(rotated.accessToken);
    expect(claims?.login).toBe(ALICE_PROFILE.login);
    // Same session id before and after the refresh
    expect(claims?.sid).toBe(ctx.accessTokens.verify(tokens.accessToken)?.sid);
    expect(ctx.refreshTokens.tokens).toHaveLength(2);
  });

  it('detects reuse of an old token and revokes the whole session', async () => {
    const ctx = setup();
    const { tokens } = await loginAlice(ctx);
    const rotated = await ctx.refresh.execute({ refreshToken: tokens.refreshToken, ...ctx.client });

    await expect(ctx.refresh.execute({ refreshToken: tokens.refreshToken, ...ctx.client })).rejects.toBeInstanceOf(RefreshTokenReuseError);

    // The thief and the real user are both locked out: the newest token is dead too.
    await expect(ctx.refresh.execute({ refreshToken: rotated.refreshToken, ...ctx.client })).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('rejects unknown and expired tokens', async () => {
    const ctx = setup();
    await expect(ctx.refresh.execute({ refreshToken: 'x'.repeat(30), ...ctx.client })).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    const { tokens } = await loginAlice(ctx);
    ctx.clock.advance(31 * 24 * 60 * 60 * 1000);
    await expect(ctx.refresh.execute({ refreshToken: tokens.refreshToken, ...ctx.client })).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('stores only the hash of the refresh token', async () => {
    const ctx = setup();
    const { tokens } = await loginAlice(ctx);
    expect(ctx.refreshTokens.tokens.some((token) => token.tokenHash === tokens.refreshToken)).toBe(false);
  });
});
