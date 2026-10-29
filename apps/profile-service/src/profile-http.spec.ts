import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AccessTokenService } from '@contenthub/common';
import { ProfileTestApp, createProfileTestApp } from './testing/create-test-app';
import { PNG_BYTES, TEST_SECRET } from './testing/fakes';

/** HTTP layer with the real controller, guard, multer, validation and error filter. No MongoDB. */
describe('profile HTTP', () => {
  const tokens = new AccessTokenService(TEST_SECRET);
  const bearer = (sub: string, login: string) =>
    `Bearer ${tokens.sign({ sub, login, name: `${login} name`, email: null, sid: 's'.repeat(24) })}`;
  const alice = bearer('a'.repeat(24), 'alice');
  const bob = bearer('b'.repeat(24), 'bob');

  let ctx: ProfileTestApp;
  let avatarDir: string;
  const http = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    avatarDir = mkdtempSync(join(tmpdir(), 'avatars-'));
    ctx = await createProfileTestApp(avatarDir);
  });

  afterAll(async () => {
    await ctx.app.close();
    rmSync(avatarDir, { recursive: true, force: true });
  });

  it('requires a token for /me and creates the profile on first access', async () => {
    expect((await request(http()).get('/api/profiles/me')).status).toBe(401);
    const response = await request(http()).get('/api/profiles/me').set('Authorization', alice);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ handle: 'alice', displayName: 'alice name', avatar: null });
  });

  it('validates the PUT body', async () => {
    const response = await request(http())
      .put('/api/profiles/me')
      .set('Authorization', alice)
      .send({ displayName: '', links: [{ label: 'x', url: 'ftp://nope' }], hacker: true });
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.message)).toContain('displayName');
  });

  it('answers 409 when the handle belongs to someone else', async () => {
    await request(http()).get('/api/profiles/me').set('Authorization', bob);
    const response = await request(http()).put('/api/profiles/me').set('Authorization', bob).send({ displayName: 'Bob', handle: 'ALICE' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('HANDLE_TAKEN');
  });

  it('updates preferences', async () => {
    const response = await request(http()).patch('/api/profiles/me/preferences').set('Authorization', alice).send({ theme: 'dark', language: 'uk-UA' });
    expect(response.body.preferences).toMatchObject({ theme: 'dark', language: 'uk-UA', publicProfile: true });
    const bad = await request(http()).patch('/api/profiles/me/preferences').set('Authorization', alice).send({ theme: 'neon' });
    expect(bad.status).toBe(400);
  });

  it('uploads a real png, ignores a lying header, and rejects fake images', async () => {
    const ok = await request(http()).post('/api/profiles/me/avatar').set('Authorization', alice).attach('avatar', PNG_BYTES, { filename: 'me.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    expect(ok.body.avatar.mime).toBe('image/png');
    expect(ok.body.avatar.url).toMatch(/^\/api\/profiles\/uploads\/avatars\/[0-9a-f]{32}\.png$/);

    // A script with an image header and a .png name must not pass.
    const fake = await request(http())
      .post('/api/profiles/me/avatar')
      .set('Authorization', alice)
      .attach('avatar', Buffer.from('#!/bin/sh\necho owned'), { filename: 'evil.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);
    expect(fake.body.code).toBe('UNSUPPORTED_IMAGE_TYPE');

    const missing = await request(http()).post('/api/profiles/me/avatar').set('Authorization', alice);
    expect(missing.status).toBe(400);
  });

  it('rejects files over 2 MB with 413', async () => {
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024)]);
    const response = await request(http()).post('/api/profiles/me/avatar').set('Authorization', alice).attach('avatar', big, { filename: 'big.png', contentType: 'image/png' });
    expect(response.status).toBe(413);
  });

  it('serves stored avatars from disk and blocks odd file names', async () => {
    writeFileSync(join(avatarDir, `${'a'.repeat(32)}.png`), PNG_BYTES);
    const served = await request(http()).get(`/api/profiles/uploads/avatars/${'a'.repeat(32)}.png`);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect((await request(http()).get(`/api/profiles/uploads/avatars/${'b'.repeat(32)}.png`)).status).toBe(404);
    expect((await request(http()).get('/api/profiles/uploads/avatars/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
  });

  it('deletes the avatar', async () => {
    const response = await request(http()).delete('/api/profiles/me/avatar').set('Authorization', alice);
    expect(response.status).toBe(200);
    expect(response.body.avatar).toBeNull();
    expect(ctx.storage.files.size).toBe(0);
  });

  it('shows public profiles by handle and in search, but hides private ones', async () => {
    const found = await request(http()).get('/api/profiles/alice');
    expect(found.status).toBe(200);
    expect(found.body).not.toHaveProperty('userId');

    const search = await request(http()).get('/api/profiles').query({ q: 'bob', page: 1, pageSize: 5 });
    expect(search.body).toMatchObject({ page: 1, pageSize: 5, total: 1 });
    expect(search.body.items[0].handle).toBe('bob');

    await request(http()).patch('/api/profiles/me/preferences').set('Authorization', bob).send({ publicProfile: false });
    expect((await request(http()).get('/api/profiles/bob')).status).toBe(404);
    expect((await request(http()).get('/api/profiles').query({ q: 'bob' })).body.total).toBe(0);
    expect((await request(http()).get('/api/profiles').query({ pageSize: 500 })).status).toBe(400);
  });

  it('documents the endpoints in swagger', async () => {
    const docs = await request(http()).get('/docs-json');
    expect(Object.keys(docs.body.paths)).toEqual(expect.arrayContaining(['/api/profiles/me/avatar', '/api/profiles/{handle}']));
  });
});
