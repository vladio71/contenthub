import { Controller, Get, INestApplication, Module, Param, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DomainError } from '../errors/domain-error';
import { ParseObjectIdPipe } from './parse-object-id.pipe';
import { applyCommonSetup } from './setup-app';

class SomethingMissingError extends DomainError {
  constructor() {
    super('not_found', 'SOMETHING_MISSING', 'Nothing here');
  }
}

class UpstreamDownError extends DomainError {
  constructor() {
    super('upstream', 'UPSTREAM_DOWN', 'Provider failed');
  }
}

@Controller()
class DemoController {
  @Get('domain')
  domain(): void {
    throw new SomethingMissingError();
  }

  @Get('upstream')
  upstream(): void {
    throw new UpstreamDownError();
  }

  @Get('duplicate')
  duplicate(): void {
    // This is the shape of the error the MongoDB driver throws for a unique index violation.
    throw Object.assign(new Error('E11000 duplicate key error'), { code: 11000, keyPattern: { handle: 1 } });
  }

  @Get('crash')
  crash(): void {
    throw new Error('secret internal detail');
  }

  @Get('http')
  http(): void {
    throw new BadRequestException('bad input');
  }

  @Get('number/:value')
  number(@Param('value', ParseIntPipe) value: number): { value: number } {
    return { value };
  }

  @Get('id/:id')
  id(@Param('id', ParseObjectIdPipe) id: string): { id: string } {
    return { id };
  }
}

@Module({ controllers: [DemoController] })
class DemoModule {}

describe('exception filter, request id and common setup', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DemoModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyCommonSetup(app, { prefix: 'api/demo', title: 'demo', description: 'demo' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps a duplicate key error to 409', async () => {
    const response = await request(app.getHttpServer()).get('/api/demo/duplicate');
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ statusCode: 409, code: 'DUPLICATE_KEY', message: 'Already exists: handle' });
  });

  it('maps domain errors by kind', async () => {
    const missing = await request(app.getHttpServer()).get('/api/demo/domain');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('SOMETHING_MISSING');
    expect((await request(app.getHttpServer()).get('/api/demo/upstream')).status).toBe(502);
  });

  it('hides details of unexpected errors', async () => {
    const response = await request(app.getHttpServer()).get('/api/demo/crash');
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('secret internal detail');
  });

  it('keeps http exception messages and parse pipe errors', async () => {
    expect((await request(app.getHttpServer()).get('/api/demo/http')).body.message).toBe('bad input');
    expect((await request(app.getHttpServer()).get('/api/demo/number/abc')).status).toBe(400);
    expect((await request(app.getHttpServer()).get('/api/demo/id/xyz')).status).toBe(400);
    expect((await request(app.getHttpServer()).get('/api/demo/id/65f1a2b3c4d5e6f7a8b9c0d1')).status).toBe(200);
  });

  it('returns the request id in the header and in the error body, and reuses an incoming one', async () => {
    const generated = await request(app.getHttpServer()).get('/api/demo/domain');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.body.requestId).toBe(generated.headers['x-request-id']);

    const forwarded = await request(app.getHttpServer()).get('/api/demo/domain').set('X-Request-Id', 'gateway-123');
    expect(forwarded.headers['x-request-id']).toBe('gateway-123');

    const unsafe = await request(app.getHttpServer()).get('/api/demo/domain').set('X-Request-Id', 'bad id with spaces\t');
    expect(unsafe.headers['x-request-id']).not.toContain(' ');
  });

  it('serves swagger json at /docs-json', async () => {
    const docs = await request(app.getHttpServer()).get('/docs-json');
    expect(docs.status).toBe(200);
    expect(docs.body.paths).toHaveProperty('/api/demo/domain');
  });
});
