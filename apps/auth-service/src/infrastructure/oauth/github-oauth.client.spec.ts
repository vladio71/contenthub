import { InvalidAuthorizationCodeError, ProviderUnavailableError } from '../../domain/errors';
import { testAuthConfig } from '../../testing/fakes';
import { GithubOAuthClient } from './github-oauth.client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function clientWith(fetchImpl: typeof fetch): GithubOAuthClient {
  return new GithubOAuthClient(testAuthConfig().github, { fetchImpl, timeoutMs: 100, retries: 1 });
}

describe('GithubOAuthClient', () => {
  it('builds the authorize url with state and redirect uri', () => {
    const url = new URL(clientWith(jest.fn()).buildAuthorizeUrl('xyz'));
    expect(url.origin + url.pathname).toBe('https://provider.test/authorize');
    expect(url.searchParams.get('state')).toBe('xyz');
    expect(url.searchParams.get('client_id')).toBe('client');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4001/api/auth/github/callback');
  });

  it('retries once on a 5xx and then succeeds', async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok' }));
    await expect(clientWith(fetchImpl as unknown as typeof fetch).exchangeCodeForToken('code')).resolves.toBe('tok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('maps repeated 5xx and network errors to a provider error (502)', async () => {
    const alwaysDown = jest.fn().mockResolvedValue(jsonResponse(500, {}));
    await expect(clientWith(alwaysDown).exchangeCodeForToken('code')).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(alwaysDown).toHaveBeenCalledTimes(2);

    const networkDown = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(clientWith(networkDown).fetchUserProfile('tok')).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it('does not retry a 4xx and maps a bad code to 401', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { error: 'bad_verification_code' }));
    await expect(clientWith(fetchImpl).exchangeCodeForToken('code')).rejects.toBeInstanceOf(InvalidAuthorizationCodeError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('uses the primary verified email from /user/emails', async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      url.endsWith('/user/emails')
        ? jsonResponse(200, [
            { email: 'old@example.com', primary: false, verified: true },
            { email: 'main@example.com', primary: true, verified: true },
          ])
        : jsonResponse(200, { id: 7, login: 'dev', name: null, avatar_url: null, email: null }),
    );
    const profile = await clientWith(fetchImpl as unknown as typeof fetch).fetchUserProfile('tok');
    expect(profile).toEqual({
      provider: 'github',
      providerUserId: '7',
      login: 'dev',
      name: 'dev',
      email: 'main@example.com',
      avatarUrl: null,
    });
  });
});
