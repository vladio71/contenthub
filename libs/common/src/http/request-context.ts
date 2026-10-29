import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request {
  id?: string;
}

const logger = new Logger('HTTP');
const SAFE_REQUEST_ID = /^[\w.-]{1,64}$/;

/** Gives every request an id (from X-Request-Id or new) and logs one line when it ends. */
export function requestContext(request: RequestWithId, response: Response, next: NextFunction): void {
  const incoming = request.header('x-request-id');
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  request.id = requestId;
  response.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();
  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.log(`${requestId} ${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs.toFixed(1)}ms`);
  });
  next();
}
