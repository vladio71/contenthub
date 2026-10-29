import { loadCommonConfig } from './common-config';
import { readBool, readInt, readString } from './env';

describe('config', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('reads strings, numbers and booleans with fallbacks', () => {
    delete process.env.X_TEST;
    expect(readString('X_TEST', 'fallback')).toBe('fallback');
    expect(() => readString('X_TEST')).toThrow('Missing required environment variable X_TEST');
    process.env.X_TEST = '42';
    expect(readInt('X_TEST', 1)).toBe(42);
    process.env.X_TEST = 'abc';
    expect(() => readInt('X_TEST', 1)).toThrow('must be an integer');
    process.env.X_TEST = 'true';
    expect(readBool('X_TEST', false)).toBe(true);
  });

  it('requires a long enough JWT secret', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => loadCommonConfig({ port: 1, dbName: 'x' })).toThrow('at least 32');
    process.env.JWT_SECRET = 'x'.repeat(32);
    delete process.env.PORT;
    delete process.env.MONGO_DB_NAME;
    expect(loadCommonConfig({ port: 4001, dbName: 'db' })).toMatchObject({ port: 4001, mongoDbName: 'db' });
  });
});
