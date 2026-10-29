import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, DomainErrorKind } from '../errors/domain-error';
import { duplicateKeyFields } from '../mongo/duplicate-key';
import { RequestWithId } from './request-context';

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  forbidden: HttpStatus.FORBIDDEN,
  invalid: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  unsupported_media: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  upstream: HttpStatus.BAD_GATEWAY,
};

export interface ErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  requestId: string | null;
  path: string;
  timestamp: string;
}

interface MappedError {
  status: number;
  code: string;
  message: string | string[];
}

/** One place that turns every error into the same JSON shape. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    const mapped = this.map(exception);
    if (mapped.status >= 500) {
      this.logger.error(`${request.id ?? '-'} ${String(mapped.message)}`, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ErrorBody = {
      statusCode: mapped.status,
      error: HttpStatus[mapped.status] ?? 'Error',
      code: mapped.code,
      message: mapped.message,
      requestId: request.id ?? null,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(mapped.status).json(body);
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof DomainError) {
      return { status: STATUS_BY_KIND[exception.kind], code: exception.code, message: exception.message };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload as { message: string | string[] }).message
          : exception.message;
      return { status, code: HttpStatus[status] ?? 'HTTP_ERROR', message };
    }
    const fields = duplicateKeyFields(exception);
    if (fields) {
      return { status: HttpStatus.CONFLICT, code: 'DUPLICATE_KEY', message: `Already exists: ${fields.join(', ')}` };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }
}
