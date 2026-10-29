import { DomainError } from '../errors/domain-error';

/**
 * A keyset cursor remembers the last row of a page:
 * the value of the sort field and the document id (tie breaker).
 * It is sent to the client as base64url JSON. It is not signed, so the server
 * must treat it as untrusted input and validate it.
 */
export interface CursorPayload {
  value: string | number;
  id: string;
}

export class InvalidCursorError extends DomainError {
  constructor() {
    super('invalid', 'INVALID_CURSOR', 'The cursor is not valid');
  }
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): CursorPayload {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      throw new InvalidCursorError();
    }
    const { value, id } = parsed as Partial<CursorPayload>;
    const valueOk = typeof value === 'string' || typeof value === 'number';
    if (!valueOk || typeof id !== 'string' || !/^[0-9a-f]{24}$/i.test(id)) {
      throw new InvalidCursorError();
    }
    return { value, id };
  } catch {
    throw new InvalidCursorError();
  }
}
