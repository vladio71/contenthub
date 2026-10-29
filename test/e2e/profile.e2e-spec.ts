import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/profile-service/src/app.module';
import { configureApp } from '../../apps/profile-service/src/setup';
import { ALICE, BOB, bearerFor, connectionOf, createApp, dropDatabaseAndClose, useE2eEnvironment } from './helpers';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

describe('profile-service (real MongoDB)', () => {
  let app: INestApplication;
  let avatarDir: string;
  const alice = bearerFor(ALICE.id, ALICE.login);
  const bob = bearerFor(BOB.id, BOB.login);
  const http = () => app.getHttpServer();

  beforeAll(async () => {
    useE2eEnvironment('profile');
    avatarDir = mkdtempSync(join(tmpdir(), 'e2e-avatars-'));
    process.env.AVATAR_DIR = avatarDir;
    app = await createApp(AppModule, configureApp);
  });

  afterAll(async () => {
    await dropDatabaseAndClose(app);
    rmSync(avatarDir, { recursive: true, force: true });
  });

  it('creates one profile even when the first requests arrive together', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(http()).get('/api/profiles/me').set('Authorization', alice)));
    expect(responses.map((response) => response.status)).toEqual(Array(5).fill(200));
    expect(new Set(responses.map((response) => response.body.id)).size).toBe(1);
    expect(await connectionOf(app).db!.collection('profiles').countDocuments({ userId: ALICE.id })).toBe(1);
  });

  it('maps the unique handle index to 409', async () => {
    await request(http()).get('/api/profiles/me').set('Authorization', bob);
    const response = await request(http()).put('/api/profiles/me').set('Authorization', bob).send({ displayName: 'Bob', handle: 'alice' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('HANDLE_TAKEN');
  });

  it('gives a second user with the same login a different handle', async () => {
    const twin = await request(http()).get('/api/profiles/me').set('Authorization', bearerFor('c'.repeat(24), 'alice'));
    expect(twin.status).toBe(200);
    expect(twin.body.handle).toMatch(/^alice-[0-9a-f]{4}$/);
  });

  it('updates the profile and reads it as a public profile', async () => {
    const updated = await request(http())
      .put('/api/profiles/me')
      .set('Authorization', alice)
      .send({ displayName: 'Alice the Engineer', bio: 'Loves databases', location: 'Mykolaiv', links: [{ label: 'Site', url: 'https://alice.dev' }] });
    expect(updated.status).toBe(200);
    const publicProfile = await request(http()).get('/api/profiles/alice');
    expect(publicProfile.body).toMatchObject({ displayName: 'Alice the Engineer', location: 'Mykolaiv' });
    expect(publicProfile.body.userId).toBeUndefined();
  });

  it('stores an avatar on disk, checks the real type, and removes it', async () => {
    const ok = await request(http()).post('/api/profiles/me/avatar').set('Authorization', alice).attach('avatar', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    const url = ok.body.avatar.url as string;
    expect(readdirSync(avatarDir)).toHaveLength(1);

    const file = await request(http()).get(url);
    expect(file.status).toBe(200);
    expect(Buffer.from(file.body as Buffer).subarray(0, 4)).toEqual(PNG.subarray(0, 4));

    const fake = await request(http())
      .post('/api/profiles/me/avatar')
      .set('Authorization', alice)
      .attach('avatar', Buffer.from('<html>not an image</html>'), { filename: 'a.png', contentType: 'image/png' });
    expect(fake.status).toBe(415);

    const tooBig = await request(http())
      .post('/api/profiles/me/avatar')
      .set('Authorization', alice)
      .attach('avatar', Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), { filename: 'big.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(413);

    const removed = await request(http()).delete('/api/profiles/me/avatar').set('Authorization', alice);
    expect(removed.body.avatar).toBeNull();
    expect(readdirSync(avatarDir)).toHaveLength(0);
  });

  it('searches with the text index and paginates', async () => {
    const found = await request(http()).get('/api/profiles').query({ q: 'databases' });
    expect(found.status).toBe(200);
    expect(found.body.items.map((profile: { handle: string }) => profile.handle)).toContain('alice');

    const none = await request(http()).get('/api/profiles').query({ q: 'zzzznomatch' });
    expect(none.body.total).toBe(0);

    const page = await request(http()).get('/api/profiles').query({ page: 1, pageSize: 1 });
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBeGreaterThanOrEqual(3);
  });

  it('hides a profile when publicProfile is false', async () => {
    await request(http()).patch('/api/profiles/me/preferences').set('Authorization', bob).send({ publicProfile: false });
    expect((await request(http()).get('/api/profiles/bob')).status).toBe(404);
    const search = await request(http()).get('/api/profiles').query({ pageSize: 100 });
    expect(search.body.items.map((profile: { handle: string }) => profile.handle)).not.toContain('bob');
  });

  it('has the unique indexes', async () => {
    const indexes = await connectionOf(app).db!.collection('profiles').indexes();
    expect(indexes.some((index) => index.unique && index.key.handle === 1)).toBe(true);
    expect(indexes.some((index) => index.unique && index.key.userId === 1)).toBe(true);
    expect(indexes.some((index) => index.name === 'profile_text')).toBe(true);
  });
});
