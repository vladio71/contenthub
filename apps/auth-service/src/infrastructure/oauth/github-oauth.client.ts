import { GithubConfig } from '../../config';
import { OAuthProvider } from '../../application/ports';
import { InvalidAuthorizationCodeError, ProviderUnavailableError } from '../../domain/errors';
import { ProviderUserProfile } from '../../domain/user';
import { requestJson, RequestJsonOptions } from './request-json';

interface GithubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface GithubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
}

/** Adapter for GitHub's OAuth2 authorization code flow. Works with tools/mock-oauth too. */
export class GithubOAuthClient implements OAuthProvider {
  readonly name = 'github';

  constructor(
    private readonly config: GithubConfig,
    private readonly http: RequestJsonOptions = {},
  ) {}

  buildAuthorizeUrl(state: string): string {
    const url = new URL(this.config.authorizeUrl);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const response = await requestJson(
      this.config.tokenUrl,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
        }),
      },
      this.http,
    );

    const body = asRecord(response.body);
    if (body.error === 'bad_verification_code') {
      throw new InvalidAuthorizationCodeError();
    }
    if (response.status !== 200 || typeof body.access_token !== 'string') {
      // Any other error means our own setup is wrong (for example bad client credentials).
      throw new ProviderUnavailableError(`token endpoint answered ${response.status} ${String(body.error ?? '')}`.trim());
    }
    return body.access_token;
  }

  async fetchUserProfile(providerAccessToken: string): Promise<ProviderUserProfile> {
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${providerAccessToken}`,
      'User-Agent': 'contenthub-auth-service',
    };
    const userResponse = await requestJson(`${this.config.apiUrl}/user`, { headers }, this.http);
    if (userResponse.status !== 200) {
      throw new ProviderUnavailableError(`/user answered ${userResponse.status}`);
    }
    const user = parseUser(userResponse.body);

    // The public email is often empty, so ask for the list of emails.
    const emailsResponse = await requestJson(`${this.config.apiUrl}/user/emails`, { headers }, this.http);
    const email = emailsResponse.status === 200 ? pickPrimaryEmail(emailsResponse.body) : null;

    return {
      provider: 'github',
      providerUserId: String(user.id),
      login: user.login,
      name: user.name ?? user.login,
      email: email ?? user.email,
      avatarUrl: user.avatar_url,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function parseUser(body: unknown): GithubUserResponse {
  const data = asRecord(body);
  if (typeof data.id !== 'number' || typeof data.login !== 'string') {
    throw new ProviderUnavailableError('/user returned an unexpected body');
  }
  return {
    id: data.id,
    login: data.login,
    name: typeof data.name === 'string' ? data.name : null,
    avatar_url: typeof data.avatar_url === 'string' ? data.avatar_url : null,
    email: typeof data.email === 'string' ? data.email : null,
  };
}

function pickPrimaryEmail(body: unknown): string | null {
  if (!Array.isArray(body)) {
    return null;
  }
  const emails = body.map(asRecord) as unknown as GithubEmailResponse[];
  const primary = emails.find((entry) => entry.primary && entry.verified);
  return primary ? primary.email : null;
}
