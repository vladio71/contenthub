import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenClaims, AccessTokenService } from './access-token';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenClaims;
}

/** Checks the `Authorization: Bearer <jwt>` header and puts the claims on `request.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: AccessTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const claims = this.tokens.verify(header.slice('Bearer '.length));
    if (!claims) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    request.user = claims;
    return true;
  }
}
