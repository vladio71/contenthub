import { DomainError } from '@contenthub/common';

export class ItemNotFoundError extends DomainError {
  constructor(what: string) {
    super('not_found', 'ITEM_NOT_FOUND', `Item not found: ${what}`);
  }
}

export class NotItemOwnerError extends DomainError {
  constructor() {
    super('forbidden', 'NOT_ITEM_OWNER', 'Only the author can change this item');
  }
}

export class InvalidItemError extends DomainError {
  constructor(reason: string) {
    super('invalid', 'INVALID_ITEM', reason);
  }
}

export class InvalidItemStateError extends DomainError {
  constructor(reason: string) {
    super('conflict', 'INVALID_ITEM_STATE', reason);
  }
}

export class AlreadyLikedError extends DomainError {
  constructor() {
    super('conflict', 'ALREADY_LIKED', 'You already liked this item');
  }
}

export class LikeNotFoundError extends DomainError {
  constructor() {
    super('not_found', 'LIKE_NOT_FOUND', 'You have not liked this item');
  }
}

export class CollectionNotFoundError extends DomainError {
  constructor(id: string) {
    super('not_found', 'COLLECTION_NOT_FOUND', `Collection ${id} not found`);
  }
}

export class InvalidCollectionError extends DomainError {
  constructor(reason: string) {
    super('invalid', 'INVALID_COLLECTION', reason);
  }
}

export class CollectionFullError extends DomainError {
  constructor(max: number) {
    super('conflict', 'COLLECTION_FULL', `A collection can hold at most ${max} items`);
  }
}
