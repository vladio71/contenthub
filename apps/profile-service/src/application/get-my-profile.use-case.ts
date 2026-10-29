import { Inject, Injectable } from '@nestjs/common';
import { HandleTakenError, ProfileAlreadyExistsError } from '../domain/errors';
import { Handle } from '../domain/handle';
import { Profile } from '../domain/profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/repositories/profile-repository';
import { CLOCK, Clock } from './ports';

export interface ProfileOwner {
  userId: string;
  login: string;
  name: string;
}

const MAX_HANDLE_ATTEMPTS = 5;

/** Returns the profile of the caller. The first call creates it from the token claims. */
@Injectable()
export class GetMyProfileUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(owner: ProfileOwner): Promise<Profile> {
    const existing = await this.profiles.findByUserId(owner.userId);
    return existing ?? this.createFirstProfile(owner);
  }

  private async createFirstProfile(owner: ProfileOwner): Promise<Profile> {
    let handle = Handle.suggestFrom(owner.login, owner.userId.slice(-6));
    for (let attempt = 1; attempt <= MAX_HANDLE_ATTEMPTS; attempt++) {
      const profile = Profile.createFor({
        id: this.profiles.nextId(),
        userId: owner.userId,
        handle,
        displayName: owner.name,
        now: this.clock.now(),
      });
      try {
        await this.profiles.insert(profile);
        return profile;
      } catch (error) {
        if (error instanceof ProfileAlreadyExistsError) {
          // Two first requests raced. The other one won, so we return its profile.
          const winner = await this.profiles.findByUserId(owner.userId);
          if (winner) {
            return winner;
          }
        }
        if (!(error instanceof HandleTakenError) || attempt === MAX_HANDLE_ATTEMPTS) {
          throw error;
        }
        handle = Handle.suggestFrom(owner.login, owner.userId.slice(-6)).withSuffix(this.profiles.nextId().slice(-4));
      }
    }
    throw new HandleTakenError(handle.value);
  }
}
