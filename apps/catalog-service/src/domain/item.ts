import { InvalidItemError, InvalidItemStateError, NotItemOwnerError } from './errors';
import { Slug } from './slug';
import { TagSet } from './tag-set';

export type ItemStatus = 'draft' | 'published' | 'archived';
export const ITEM_STATUSES: readonly ItemStatus[] = ['draft', 'published', 'archived'];

export interface ItemStats {
  likes: number;
  views: number;
}

export interface ItemProps {
  id: string;
  title: string;
  slug: Slug;
  body: string;
  tags: TagSet;
  authorId: string;
  status: ItemStatus;
  stats: ItemStats;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface ItemEdit {
  title?: string;
  body?: string;
  tags?: string[];
}

const MIN_TITLE = 3;
const MAX_TITLE = 120;
const MAX_BODY = 20_000;
const SLUG_SUFFIX_LENGTH = 8;

export class Item {
  private constructor(private props: ItemProps) {}

  static restore(props: ItemProps): Item {
    return new Item({ ...props, stats: { ...props.stats } });
  }

  /** A new item always starts as a draft with no likes and no views. */
  static create(input: { id: string; title: string; body: string; tags: string[]; authorId: string; now: Date }): Item {
    const title = validateTitle(input.title);
    validateBody(input.body);
    return new Item({
      id: input.id,
      title,
      slug: Slug.fromTitle(title, input.id.slice(-SLUG_SUFFIX_LENGTH)),
      body: input.body,
      tags: TagSet.from(input.tags),
      authorId: input.authorId,
      status: 'draft',
      stats: { likes: 0, views: 0 },
      createdAt: input.now,
      publishedAt: null,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get slug(): string {
    return this.props.slug.value;
  }
  get body(): string {
    return this.props.body;
  }
  get tags(): string[] {
    return [...this.props.tags.values];
  }
  get authorId(): string {
    return this.props.authorId;
  }
  get status(): ItemStatus {
    return this.props.status;
  }
  get stats(): ItemStats {
    return { ...this.props.stats };
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  isOwnedBy(userId: string): boolean {
    return this.props.authorId === userId;
  }

  /** Published items are visible to everyone. Drafts and archived items only to the author. */
  isVisibleTo(userId: string): boolean {
    return this.props.status === 'published' || this.isOwnedBy(userId);
  }

  assertOwnedBy(userId: string): void {
    if (!this.isOwnedBy(userId)) {
      throw new NotItemOwnerError();
    }
  }

  edit(changes: ItemEdit): void {
    if (this.props.status === 'archived') {
      throw new InvalidItemStateError('An archived item cannot be edited');
    }
    const title = changes.title === undefined ? this.props.title : validateTitle(changes.title);
    if (changes.body !== undefined) {
      validateBody(changes.body);
    }
    // The slug stays the same when the title changes, so old links keep working.
    this.props = {
      ...this.props,
      title,
      body: changes.body ?? this.props.body,
      tags: changes.tags === undefined ? this.props.tags : TagSet.from(changes.tags),
    };
  }

  publish(now: Date): void {
    if (this.props.status !== 'draft') {
      throw new InvalidItemStateError(`Only a draft can be published, this item is ${this.props.status}`);
    }
    if (this.props.body.trim().length === 0) {
      throw new InvalidItemStateError('An item needs a body before it can be published');
    }
    this.props = { ...this.props, status: 'published', publishedAt: now };
  }

  archive(): void {
    if (this.props.status === 'archived') {
      throw new InvalidItemStateError('The item is already archived');
    }
    this.props = { ...this.props, status: 'archived' };
  }

  snapshot(): ItemProps {
    return { ...this.props, stats: { ...this.props.stats } };
  }
}

function validateTitle(raw: string): string {
  const title = raw.trim();
  if (title.length < MIN_TITLE || title.length > MAX_TITLE) {
    throw new InvalidItemError(`Title must have ${MIN_TITLE}-${MAX_TITLE} characters`);
  }
  return title;
}

function validateBody(body: string): void {
  if (body.length > MAX_BODY) {
    throw new InvalidItemError(`Body can have at most ${MAX_BODY} characters`);
  }
}
