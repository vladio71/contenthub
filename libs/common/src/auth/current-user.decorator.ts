import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessTokenClaims } from './access-token';
import { AuthenticatedRequest } from './jwt-auth.guard';

/** Use on a route protected by JwtAuthGuard to get the token claims. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AccessTokenClaims => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    throw new Error('CurrentUser used on a route without JwtAuthGuard');
  }
  return request.user;
});
