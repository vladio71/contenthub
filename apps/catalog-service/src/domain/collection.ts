import { CollectionFullError, InvalidCollectionError } from './errors';

export const MAX_ITEMS_PER_COLLECTION = 200;
export const MAX_ITEMS_PER_REQUEST = 50;

export interface CollectionProps {
  id: string;
  ownerId: string;
  name: string;
  /** The order is the order in which items were added. */
  itemIds: string[];
  createdAt: Date;
}

export class Collection {
  private constructor(private props: CollectionProps) {}

  static restore(props: CollectionProps): Collection {
    return new Collection({ ...props, itemIds: [...props.itemIds] });
  }

  static create(input: { id: string; ownerId: string; name: string; now: Date }): Collection {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 80) {
      throw new InvalidCollectionError('Collection name must have 1-80 characters');
    }
    return new Collection({ id: input.id, ownerId: input.ownerId, name, itemIds: [], createdAt: input.now });
  }

  get id(): string {
    return this.props.id;
  }
  get ownerId(): string {
    return this.props.ownerId;
  }
  get name(): string {
    return this.props.name;
  }
  get itemIds(): string[] {
    return [...this.props.itemIds];
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toProps(): CollectionProps {
    return { ...this.props, itemIds: [...this.props.itemIds] };
  }

  isOwnedBy(userId: string): boolean {
    return this.props.ownerId === userId;
  }

  /** The ids that are not in the collection yet, without duplicates. */
  newIdsFrom(candidates: string[]): string[] {
    const known = new Set(this.props.itemIds);
    return [...new Set(candidates)].filter((id) => !known.has(id));
  }

  /** Adds the items that are new to this collection and returns them. Enforces the size cap. */
  addItems(candidates: string[]): string[] {
    if (candidates.length === 0 || candidates.length > MAX_ITEMS_PER_REQUEST) {
      throw new InvalidCollectionError(`Send between 1 and ${MAX_ITEMS_PER_REQUEST} item ids at a time`);
    }
    const added = this.newIdsFrom(candidates);
    if (this.props.itemIds.length + added.length > MAX_ITEMS_PER_COLLECTION) {
      throw new CollectionFullError(MAX_ITEMS_PER_COLLECTION);
    }
    this.props = { ...this.props, itemIds: [...this.props.itemIds, ...added] };
    return added;
  }
}
