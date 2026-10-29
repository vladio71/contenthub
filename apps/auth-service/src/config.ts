import { CommonConfig, loadCommonConfig, readBool, readInt, readString } from '@contenthub/common';

export interface GithubConfig {
  clientId: string;
  clientSecret: string;
  /** Where the browser is sent. Must be reachable from the user's machine. */
  authorizeUrl: string;
  /** Called by this service. Inside docker this can be an internal host name. */
  tokenUrl: string;
  apiUrl: string;
  redirectUri: string;
}

export interface AuthConfig extends CommonConfig {
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  cookieSecure: boolean;
  github: GithubConfig;
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const AUTH_PREFIX = 'api/auth';

export function loadAuthConfig(): AuthConfig {
  return {
    ...loadCommonConfig({ port: 4001, dbName: 'contenthub_auth' }),
    accessTokenTtlSeconds: readInt('ACCESS_TOKEN_TTL_SECONDS', 15 * 60),
    refreshTokenTtlDays: readInt('REFRESH_TOKEN_TTL_DAYS', 30),
    cookieSecure: readBool('COOKIE_SECURE', false),
    github: {
      clientId: readString('GITHUB_CLIENT_ID'),
      clientSecret: readString('GITHUB_CLIENT_SECRET'),
      authorizeUrl: readString('GITHUB_AUTHORIZE_URL', 'https://github.com/login/oauth/authorize'),
      tokenUrl: readString('GITHUB_TOKEN_URL', 'https://github.com/login/oauth/access_token'),
      apiUrl: readString('GITHUB_API_URL', 'https://api.github.com'),
      redirectUri: readString('GITHUB_REDIRECT_URI', 'http://localhost:8081/api/auth/github/callback'),
    },
  };
}
