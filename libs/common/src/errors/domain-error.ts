/**
 * Base class for errors raised by domain and application code.
 * It has no framework imports. The HTTP exception filter maps `kind` to a status code.
 */
export type DomainErrorKind =
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'invalid'
  | 'unauthorized'
  | 'unsupported_media'
  | 'upstream';

export abstract class DomainError extends Error {
  protected constructor(
    readonly kind: DomainErrorKind,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
