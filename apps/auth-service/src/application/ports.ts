import { ProviderUserProfile } from '../domain/user';

export const OAUTH_PROVIDER = Symbol('OAUTH_PROVIDER');
export const TOKEN_CODEC = Symbol('TOKEN_CODEC');
export const CLOCK = Symbol('CLOCK');

/** The third-party API. The real adapter calls GitHub (or the mock). */
export interface OAuthProvider {
  readonly name: string;
  buildAuthorizeUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<string>;
  fetchUserProfile(providerAccessToken: string): Promise<ProviderUserProfile>;
}

export interface TokenCodec {
  /** Random, URL safe, hard to guess. Used for the OAuth state and for refresh tokens. */
  createOpaqueToken(): string;
  hash(token: string): string;
}

export interface Clock {
  now(): Date;
}
