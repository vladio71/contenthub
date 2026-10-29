import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './setup';

/**
 * Boots the real AppModule: env config, the Mongoose root module, every Mongo repository class
 * and every use case. Only the MongoDB connection is replaced by a stub, because there is no
 * database in unit tests. If a provider cannot be resolved, this test fails.
 */
describe('AppModule wiring', () => {
  const saved = { ...process.env };

  beforeAll(() => {
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.MONGO_URI = 'mongodb://stub:27017/?replicaSet=rs0';
    process.env.GITHUB_CLIENT_ID = 'client';
    process.env.GITHUB_CLIENT_SECRET = 'secret';
    process.env.GITHUB_AUTHORIZE_URL = 'http://localhost:9000/authorize';
  });

  afterAll(() => {
    process.env = saved;
  });

  it('resolves every provider and answers on /health', async () => {
    const fakeModel = { init: async (): Promise<void> => undefined };
    const fakeConnection = { models: {}, model: () => fakeModel, db: undefined, close: async (): Promise<void> => undefined };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken())
      .useValue(fakeConnection)
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/api/auth/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'auth-service' });
    await app.close();
  });
});
