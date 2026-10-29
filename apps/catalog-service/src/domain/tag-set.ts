import { InvalidItemError } from './errors';

export const MAX_TAGS_PER_ITEM = 10;
const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,29}$/;

/** A list of unique, lowercase tags. */
export class TagSet {
  private constructor(readonly values: readonly string[]) {}

  static from(raw: string[]): TagSet {
    const unique = [...new Set(raw.map((tag) => tag.trim().toLowerCase()))];
    if (unique.length > MAX_TAGS_PER_ITEM) {
      throw new InvalidItemError(`An item can have at most ${MAX_TAGS_PER_ITEM} tags`);
    }
    const invalid = unique.find((tag) => !TAG_PATTERN.test(tag));
    if (invalid !== undefined) {
      throw new InvalidItemError(`Tag "${invalid}" is not valid. Use 1-30 characters: a-z, 0-9 and "-"`);
    }
    return new TagSet(unique);
  }
}
