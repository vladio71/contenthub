import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AccessTokenService } from './access-token';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'a-secret-that-is-long-enough-for-tests';
const claims = { sub: 'u1', login: 'alice', name: 'Alice', email: 'a@example.com', sid: 's1' };

function contextWith(authorization?: string): { context: ExecutionContext; request: { headers: { authorization?: string }; user?: unknown } } {
  const request: { headers: { authorization?: string }; user?: unknown } = { headers: { authorization } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { context, request };
}

describe('AccessTokenService', () => {
  const service = new AccessTokenService(SECRET, 900);

  it('signs a token that verifies and expires in the configured time', () => {
    const token = service.sign(claims);
    expect(service.verify(token)).toEqual(claims);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it('rejects wrong secret, expired token, garbage and other algorithms', () => {
    expect(new AccessTokenService('another-secret-another-secret-123').verify(service.sign(claims))).toBeNull();
    expect(service.verify(jwt.sign(claims, SECRET, { expiresIn: -10 }))).toBeNull();
    expect(service.verify('not.a.jwt')).toBeNull();
    expect(service.verify(jwt.sign(claims, SECRET, { algorithm: 'HS512' }))).toBeNull();
    expect(service.verify(jwt.sign({ foo: 'bar' }, SECRET))).toBeNull();
  });
});

describe('JwtAuthGuard', () => {
  const service = new AccessTokenService(SECRET);
  const guard = new JwtAuthGuard(service);

  it('puts the claims on the request', () => {
    const { context, request } = contextWith(`Bearer ${service.sign(claims)}`);
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual(claims);
  });

  it.each([undefined, 'Basic abc', 'Bearer', 'Bearer bad.token.value'])('rejects the header %s', (header) => {
    expect(() => guard.canActivate(contextWith(header).context)).toThrow(UnauthorizedException);
  });
});
