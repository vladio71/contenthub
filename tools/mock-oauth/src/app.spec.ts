import request from 'supertest';
import { createMockOAuthApp } from './app';

describe('mock-oauth', () => {
  const app = createMockOAuthApp();

  it('authorize redirects back with code and the same state', async () => {
    const response = await request(app)
      .get('/authorize')
      .query({ redirect_uri: 'http://localhost:8081/cb', state: 'abc', login: 'bob' });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.location);
    expect(location.searchParams.get('state')).toBe('abc');
    expect(location.searchParams.get('code')).toMatch(/^[0-9a-f]{24}$/);
  });

  it('runs the whole flow and a code can be used only once', async () => {
    const authorize = await request(app).get('/authorize').query({ redirect_uri: 'http://x.test/cb', state: 's', login: 'carol' });
    const code = new URL(authorize.headers.location).searchParams.get('code');

    const token = await request(app).post('/access_token').send({ code });
    expect(token.body.access_token).toMatch(/^mock_/);

    const user = await request(app).get('/user').set('Authorization', `Bearer ${token.body.access_token}`);
    expect(user.body).toMatchObject({ id: 1003, login: 'carol', email: null });

    const emails = await request(app).get('/user/emails').set('Authorization', `Bearer ${token.body.access_token}`);
    expect(emails.body.find((entry: { primary: boolean }) => entry.primary).email).toBe('carol@example.com');

    const second = await request(app).post('/access_token').send({ code });
    expect(second.body.error).toBe('bad_verification_code');
  });

  it('rejects unknown users and missing tokens', async () => {
    const unknown = await request(app).get('/authorize').query({ redirect_uri: 'http://x.test/cb', login: 'nobody' });
    expect(unknown.status).toBe(400);
    const noToken = await request(app).get('/user');
    expect(noToken.status).toBe(401);
  });
});
