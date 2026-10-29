import { DomainError } from '@contenthub/common';

export class InvalidOAuthStateError extends DomainError {
  constructor() {
    super('unauthorized', 'INVALID_OAUTH_STATE', 'OAuth state is missing or does not match. Start the login again.');
  }
}

export class InvalidAuthorizationCodeError extends DomainError {
  constructor() {
    super('unauthorized', 'INVALID_AUTHORIZATION_CODE', 'The provider rejected the authorization code');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor() {
    super('unauthorized', 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid, expired or revoked');
  }
}

export class RefreshTokenReuseError extends DomainError {
  constructor() {
    super('unauthorized', 'REFRESH_TOKEN_REUSED', 'Refresh token was already used. The session was revoked.');
  }
}

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super('not_found', 'SESSION_NOT_FOUND', `Session ${sessionId} not found`);
  }
}

export class UserNotFoundError extends DomainError {
  constructor(userId: string) {
    super('not_found', 'USER_NOT_FOUND', `User ${userId} not found`);
  }
}

export class ProviderUnavailableError extends DomainError {
  constructor(detail: string) {
    super('upstream', 'PROVIDER_UNAVAILABLE', `The OAuth provider failed: ${detail}`);
  }
}
