import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { createMockOAuthApp } from '@contenthub/mock-oauth';
import { GithubOAuthClient } from './infrastructure/oauth/github-oauth.client';
import { AuthTestApp, createAuthTestApp } from './testing/create-test-app';
import { testAuthConfig } from './testing/fakes';

/**
 * The whole OAuth flow through HTTP: Nest controllers, the real GithubOAuthClient
 * and the real mock-oauth server. Only MongoDB is replaced by in-memory repositories.
 */
describe('auth flow over HTTP', () => {
  let mock: Server;
  let ctx: AuthTestApp;

  beforeAll(async () => {
    mock = createMockOAuthApp().listen(0);
    const mockUrl = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
    const github = {
      ...testAuthConfig().github,
      authorizeUrl: `${mockUrl}/authorize`,
      tokenUrl: `${mockUrl}/access_token`,
      apiUrl: mockUrl,
    };
    ctx = await createAuthTestApp(new GithubOAuthClient(github, { timeoutMs: 2000 }));
  });

  afterAll(async () => {
    await ctx.app.close();
    mock.close();
  });

  /** Does what a browser does: login, authorize at the provider, come back to the callback. */
  async function loginAs(login: string) {
    const server = ctx.app.getHttpServer();
    const start = await request(server).get('/api/auth/github/login');
    expect(start.status).toBe(302);
    const cookie = (start.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/oauth_state=.*HttpOnly/);

    const authorizeUrl = new URL(start.headers.location);
    authorizeUrl.searchParams.set('login', login);
    const approved = await fetch(authorizeUrl, { redirect: 'manual' });
    const callbackUrl = new URL(approved.headers.get('location') as string);

    const callback = await request(server)
      .get('/api/auth/github/callback')
      .query({ code: callbackUrl.searchParams.get('code'), state: callbackUrl.searchParams.get('state') })
      .set('Cookie', cookie.split(';')[0]);
    return { callback, cookie, state: callbackUrl.searchParams.get('state') as string };
  }

  it('logs in and returns tokens and the user', async () => {
    const { callback } = await loginAs('alice');
    expect(callback.status).toBe(200);
    expect(callback.body.user).toMatchObject({ login: 'alice', email: 'alice@example.com', provider: 'github' });
    expect(callback.body.expiresIn).toBe(900);

    const me = await request(ctx.app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${callback.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(callback.body.user.id);
  });

  it('refuses a callback whose state does not match the cookie', async () => {
    const { cookie } = await loginAs('bob');
    const response = await request(ctx.app.getHttpServer())
      .get('/api/auth/github/callback')
      .query({ code: 'whatever', state: 'forged' })
      .set('Cookie', cookie.split(';')[0]);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_OAUTH_STATE');
    expect(response.body.requestId).toBeTruthy();
  });

  it('returns 401 for a code the provider does not know', async () => {
    const start = await request(ctx.app.getHttpServer()).get('/api/auth/github/login');
    const cookie = (start.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const state = cookie.replace('oauth_state=', '');
    const response = await request(ctx.app.getHttpServer()).get('/api/auth/github/callback').query({ code: 'nope', state }).set('Cookie', cookie);
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_AUTHORIZATION_CODE');
  });

  it('rotates refresh tokens and revokes the session when an old one is reused', async () => {
    const server = ctx.app.getHttpServer();
    const { callback } = await loginAs('carol');
    const first = callback.body.refreshToken as string;

    const rotated = await request(server).post('/api/auth/refresh').send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    const replay = await request(server).post('/api/auth/refresh').send({ refreshToken: first });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_TOKEN_REUSED');

    const afterRevoke = await request(server).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken });
    expect(afterRevoke.status).toBe(401);
  });

  it('lists sessions, marks the current one and signs one out', async () => {
    const server = ctx.app.getHttpServer();
    const first = (await loginAs('alice')).callback.body;
    const second = (await loginAs('alice')).callback.body;

    const list = await request(server).get('/api/auth/sessions').set('Authorization', `Bearer ${second.accessToken}`);
    expect(list.status).toBe(200);
    const current = list.body.filter((session: { current: boolean }) => session.current);
    expect(current).toHaveLength(1);
    expect(list.body.length).toBeGreaterThanOrEqual(2);

    const other = list.body.find((session: { current: boolean }) => !session.current);
    const del = await request(server).delete(`/api/auth/sessions/${other.id}`).set('Authorization', `Bearer ${second.accessToken}`);
    expect(del.status).toBe(204);
    const again = await request(server).delete(`/api/auth/sessions/${other.id}`).set('Authorization', `Bearer ${second.accessToken}`);
    expect(again.status).toBe(404);
    expect(first.accessToken).toBeTruthy();
  });

  it('logs out and then the refresh token is dead', async () => {
    const server = ctx.app.getHttpServer();
    const { callback } = await loginAs('bob');
    const out = await request(server).post('/api/auth/logout').send({ refreshToken: callback.body.refreshToken });
    expect(out.status).toBe(204);
    const refresh = await request(server).post('/api/auth/refresh').send({ refreshToken: callback.body.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('protects /me and validates bodies', async () => {
    const server = ctx.app.getHttpServer();
    expect((await request(server).get('/api/auth/me')).status).toBe(401);
    expect((await request(server).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const bad = await request(server).post('/api/auth/refresh').send({ refreshToken: 'short', extra: true });
    expect(bad.status).toBe(400);
  });

  it('lists providers and serves swagger and health', async () => {
    const server = ctx.app.getHttpServer();
    const providers = await request(server).get('/api/auth/providers');
    expect(providers.body).toEqual([{ name: 'github', loginPath: '/api/auth/github/login' }]);
    expect((await request(server).get('/api/auth/health')).body.service).toBe('auth-service');
    const docs = await request(server).get('/docs-json');
    expect(Object.keys(docs.body.paths)).toEqual(expect.arrayContaining(['/api/auth/github/login', '/api/auth/sessions/{id}']));
  });
});
