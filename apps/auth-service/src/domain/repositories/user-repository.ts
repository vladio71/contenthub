import { ProviderUserProfile, User } from '../user';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  /** Creates the user on first login and updates the profile on later logins, in one atomic step. */
  upsertFromProvider(profile: ProviderUserProfile, now: Date): Promise<User>;
  findById(id: string): Promise<User | null>;
}
