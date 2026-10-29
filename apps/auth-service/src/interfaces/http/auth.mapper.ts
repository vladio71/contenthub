import { AUTH_PREFIX } from '../../config';
import { LoginResult } from '../../application/complete-github-login.use-case';
import { SessionView } from '../../application/list-sessions.use-case';
import { ProviderView } from '../../application/list-providers.use-case';
import { User } from '../../domain/user';
import { AuthResponseDto, ProviderResponseDto, SessionResponseDto, UserResponseDto } from './dto/auth.dto';

export function toUserResponse(user: User): UserResponseDto {
  return {
    id: user.id,
    provider: user.provider,
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt.toISOString(),
  };
}

export function toAuthResponse(result: LoginResult): AuthResponseDto {
  return { ...result.tokens, user: toUserResponse(result.user) };
}

export function toSessionResponse(session: SessionView): SessionResponseDto {
  return {
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    lastRefreshedAt: session.lastRefreshedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    userAgent: session.userAgent,
    ip: session.ip,
    current: session.current,
  };
}

export function toProviderResponse(provider: ProviderView): ProviderResponseDto {
  return { name: provider.name, loginPath: `/${AUTH_PREFIX}${provider.loginPath}` };
}
