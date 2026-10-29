import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { createMockOAuthApp } from '@contenthub/mock-oauth';
import { AppModule } from '../../apps/auth-service/src/app.module';
import { configureApp } from '../../apps/auth-service/src/setup';
import { connectionOf, createApp, dropDatabaseAndClose, useE2eEnvironment } from './helpers';

describe('auth-service (real MongoDB)', () => {
  let app: INestApplication;
  let mock: Server;

  beforeAll(async () => {
    mock = createMockOAuthApp().listen(0);
    const mockUrl = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
    useE2eEnvironment('auth');
    process.env.GITHUB_CLIENT_ID = 'e2e-client';
    process.env.GITHUB_CLIENT_SECRET = 'e2e-secret';
    process.env.GITHUB_AUTHORIZE_URL = `${mockUrl}/authorize`;
    process.env.GITHUB_TOKEN_URL = `${mockUrl}/access_token`;
    process.env.GITHUB_API_URL = mockUrl;
    process.env.GITHUB_REDIRECT_URI = 'http://localhost:4001/api/auth/github/callback';
    app = await createApp(AppModule, configureApp);
  });

  afterAll(async () => {
    await dropDatabaseAndClose(app);
    mock.close();
  });

  const http = () => app.getHttpServer();

  /** Login as a browser would: /login, approve at the provider, /callback with the state cookie. */
  async function login(provider: string): Promise<request.Response> {
    const start = await request(http()).get('/api/auth/github/login');
    const cookie = (start.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const authorizeUrl = new URL(start.headers.location);
    authorizeUrl.searchParams.set('login', provider);
    const approved = await fetch(authorizeUrl, { redirect: 'manual' });
    const callback = new URL(approved.headers.get('location') as string);
    return request(http())
      .get('/api/auth/github/callback')
      .query({ code: callback.searchParams.get('code'), state: callback.searchParams.get('state') })
      .set('Cookie', cookie);
  }

  it('upserts the user atomically: many parallel first logins create exactly one user', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => login('alice')));
    expect(results.map((response) => response.status)).toEqual(Array(6).fill(200));
    expect(new Set(results.map((response) => response.body.user.id)).size).toBe(1);

    const users = await connectionOf(app).db!.collection('users').countDocuments({ providerUserId: '1001' });
    expect(users).toBe(1);
  });

  it('issues tokens that work on /me and stores refresh tokens only as hashes', async () => {
    const { body } = await login('bob');
    const me = await request(http()).get('/api/auth/me').set('Authorization', `Bearer ${body.accessToken}`);
    expect(me.body).toMatchObject({ login: 'bob', email: 'bob@example.com' });

    const stored = await connectionOf(app).db!.collection('refresh_tokens').find({ userId: body.user.id }).toArray();
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.some((doc) => doc.tokenHash === body.refreshToken)).toBe(false);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const { body } = await login('carol');
    const rotated = await request(http()).post('/api/auth/refresh').send({ refreshToken: body.refreshToken });
    expect(rotated.status).toBe(200);

    const reuse = await request(http()).post('/api/auth/refresh').send({ refreshToken: body.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');

    const newest = await request(http()).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken });
    expect(newest.status).toBe(401);
  });

  it('lets only one of two parallel refreshes with the same token win', async () => {
    const { body } = await login('alice');
    const attempts = await Promise.all([
      request(http()).post('/api/auth/refresh').send({ refreshToken: body.refreshToken }),
      request(http()).post('/api/auth/refresh').send({ refreshToken: body.refreshToken }),
    ]);
    const statuses = attempts.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 401]);
  });

  it('lists and revokes sessions', async () => {
    const first = (await login('bob')).body;
    const second = (await login('bob')).body;
    const list = await request(http()).get('/api/auth/sessions').set('Authorization', `Bearer ${second.accessToken}`);
    expect(list.body.filter((session: { current: boolean }) => session.current)).toHaveLength(1);

    const other = list.body.find((session: { current: boolean }) => !session.current);
    expect((await request(http()).delete(`/api/auth/sessions/${other.id}`).set('Authorization', `Bearer ${second.accessToken}`)).status).toBe(204);
    expect((await request(http()).delete(`/api/auth/sessions/${other.id}`).set('Authorization', `Bearer ${second.accessToken}`)).status).toBe(404);
    expect(first.refreshToken).toBeTruthy();
  });

  it('creates the indexes the code depends on', async () => {
    const users = await connectionOf(app).db!.collection('users').indexes();
    expect(users.some((index) => index.unique && index.key.providerUserId === 1)).toBe(true);
    const tokens = await connectionOf(app).db!.collection('refresh_tokens').indexes();
    expect(tokens.some((index) => index.unique && index.key.tokenHash === 1)).toBe(true);
    expect(tokens.some((index) => index.expireAfterSeconds === 0)).toBe(true);
  });
});
