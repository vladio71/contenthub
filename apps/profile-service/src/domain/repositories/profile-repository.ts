import { Profile } from '../profile';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileSearchQuery {
  text?: string;
  page: number;
  pageSize: number;
}

export interface ProfileSearchResult {
  profiles: Profile[];
  total: number;
}

export interface ProfileRepository {
  nextId(): string;
  /** Throws HandleTakenError or ProfileAlreadyExistsError when a unique index is violated. */
  insert(profile: Profile): Promise<void>;
  /** Throws HandleTakenError, or ProfileNotFoundError when the profile is gone. */
  save(profile: Profile): Promise<void>;
  findByUserId(userId: string): Promise<Profile | null>;
  findByHandle(handle: string): Promise<Profile | null>;
  /** Only public profiles. With text, results are ordered by relevance. */
  search(query: ProfileSearchQuery): Promise<ProfileSearchResult>;
}
