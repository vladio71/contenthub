import * as jwt from 'jsonwebtoken';

/** What the access JWT carries. Other services read these claims and never call auth-service. */
export interface AccessTokenClaims {
  /** User id */
  sub: string;
  login: string;
  name: string;
  email: string | null;
  /** Session id (the refresh token family) */
  sid: string;
}

export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Signs and verifies HS256 access tokens with a shared secret.
 * In production use an asymmetric algorithm so that only auth-service holds the private key.
 */
export class AccessTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number = DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  ) {}

  sign(claims: AccessTokenClaims): string {
    return jwt.sign({ ...claims }, this.secret, { algorithm: 'HS256', expiresIn: this.ttlSeconds });
  }

  /** Returns the claims, or null when the token is invalid, expired or malformed. */
  verify(token: string): AccessTokenClaims | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof payload === 'string') {
        return null;
      }
      const { sub, login, name, email, sid } = payload as Partial<AccessTokenClaims>;
      if (typeof sub !== 'string' || typeof login !== 'string' || typeof sid !== 'string') {
        return null;
      }
      return { sub, login, name: typeof name === 'string' ? name : login, email: email ?? null, sid };
    } catch {
      return null;
    }
  }
}
