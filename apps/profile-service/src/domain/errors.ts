import { DomainError } from '@contenthub/common';

export class ProfileNotFoundError extends DomainError {
  constructor(what: string) {
    super('not_found', 'PROFILE_NOT_FOUND', `Profile not found: ${what}`);
  }
}

export class HandleTakenError extends DomainError {
  constructor(handle: string) {
    super('conflict', 'HANDLE_TAKEN', `The handle "${handle}" is already taken`);
  }
}

export class ProfileAlreadyExistsError extends DomainError {
  constructor(userId: string) {
    super('conflict', 'PROFILE_EXISTS', `User ${userId} already has a profile`);
  }
}

export class InvalidHandleError extends DomainError {
  constructor(reason: string) {
    super('invalid', 'INVALID_HANDLE', reason);
  }
}

export class InvalidProfileError extends DomainError {
  constructor(reason: string) {
    super('invalid', 'INVALID_PROFILE', reason);
  }
}

export class UnsupportedImageTypeError extends DomainError {
  constructor() {
    super('unsupported_media', 'UNSUPPORTED_IMAGE_TYPE', 'The file content is not a PNG, JPEG or WebP image');
  }
}
