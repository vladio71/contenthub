import { Clock, OAuthProvider } from '../application/ports';
import { ProviderUserProfile } from '../domain/user';
import { AuthConfig } from '../config';

export class FixedClock implements Clock {
  constructor(private current: Date = new Date('2026-01-01T10:00:00Z')) {}

  now(): Date {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export const ALICE_PROFILE: ProviderUserProfile = {
  provider: 'github',
  providerUserId: '1001',
  login: 'alice',
  name: 'Alice Moroz',
  email: 'alice@example.com',
  avatarUrl: null,
};

export class FakeOAuthProvider implements OAuthProvider {
  readonly name = 'github';
  profile: ProviderUserProfile = ALICE_PROFILE;

  buildAuthorizeUrl(state: string): string {
    return `https://provider.test/authorize?state=${state}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    return `token-for-${code}`;
  }

  async fetchUserProfile(): Promise<ProviderUserProfile> {
    return this.profile;
  }
}

export const TEST_SECRET = 'test-secret-test-secret-test-secret-1234';

export function testAuthConfig(): AuthConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    mongoUri: 'mongodb://unused',
    mongoDbName: 'unused',
    jwtSecret: TEST_SECRET,
    accessTokenTtlSeconds: 900,
    refreshTokenTtlDays: 30,
    cookieSecure: false,
    github: {
      clientId: 'client',
      clientSecret: 'secret',
      authorizeUrl: 'https://provider.test/authorize',
      tokenUrl: 'https://provider.test/token',
      apiUrl: 'https://provider.test',
      redirectUri: 'http://localhost:4001/api/auth/github/callback',
    },
  };
}
