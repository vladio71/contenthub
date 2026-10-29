export const LIKE_REPOSITORY = Symbol('LIKE_REPOSITORY');

export interface LikeRepository {
  /**
   * Stores the like and adds 1 to the item counter. Both happen together or not at all.
   * Throws AlreadyLikedError for a second like and ItemNotFoundError for an unknown item.
   * Returns the new number of likes.
   */
  add(itemId: string, userId: string): Promise<number>;
  /** The mirror of add. Throws LikeNotFoundError when there is no like. Returns the new number. */
  remove(itemId: string, userId: string): Promise<number>;
}
