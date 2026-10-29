import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { AccessTokenService } from '@contenthub/common';

export const E2E_JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-12345';

/**
 * Needs a MongoDB replica set. Start one with `docker compose up -d --wait mongo`.
 * From the host, "directConnection=true" is needed because the replica set announces
 * itself as "mongo:27017", a name that only exists inside the docker network.
 */
export function mongoUri(): string {
  return process.env.MONGO_URI ?? 'mongodb://localhost:27017/?directConnection=true';
}

/** Each test file gets its own database, so files do not see each other's data. */
export function uniqueDbName(service: string): string {
  return `e2e_${service}_${randomBytes(4).toString('hex')}`;
}

/** Sets the env vars the services read, then returns the database name used. */
export function useE2eEnvironment(service: string): string {
  const dbName = uniqueDbName(service);
  process.env.MONGO_URI = mongoUri();
  process.env.MONGO_DB_NAME = dbName;
  process.env.JWT_SECRET = E2E_JWT_SECRET;
  return dbName;
}

export async function createApp(module: new () => unknown, configure: (app: INestApplication) => void): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [module] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configure(app);
  await app.init();
  return app;
}

export function connectionOf(app: INestApplication): Connection {
  return app.get<Connection>(getConnectionToken());
}

export async function dropDatabaseAndClose(app: INestApplication): Promise<void> {
  await connectionOf(app).dropDatabase();
  await app.close();
}

const tokens = new AccessTokenService(E2E_JWT_SECRET);

/** A bearer header for a fake user. The profile and catalog services only check the signature. */
export function bearerFor(userId: string, login: string): string {
  return `Bearer ${tokens.sign({ sub: userId, login, name: `${login} name`, email: `${login}@example.com`, sid: 'a'.repeat(24) })}`;
}

export const ALICE = { id: 'a'.repeat(24), login: 'alice' };
export const BOB = { id: 'b'.repeat(24), login: 'bob' };
