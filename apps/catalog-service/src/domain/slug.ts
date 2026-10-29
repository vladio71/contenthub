import { InvalidItemError } from './errors';

const MAX_BASE_LENGTH = 60;

/** URL friendly name of an item, for example "my-first-post-1f3a9c2d". */
export class Slug {
  private constructor(readonly value: string) {}

  /** The suffix (taken from the item id) keeps slugs unique even for equal titles. */
  static fromTitle(title: string, uniqueSuffix: string): Slug {
    const base = title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_BASE_LENGTH)
      .replace(/-+$/g, '');
    return new Slug(base ? `${base}-${uniqueSuffix}` : uniqueSuffix);
  }

  static restore(value: string): Slug {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) {
      throw new InvalidItemError(`"${value}" is not a valid slug`);
    }
    return new Slug(value);
  }
}
