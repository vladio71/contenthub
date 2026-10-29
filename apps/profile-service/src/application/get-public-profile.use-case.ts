import { Inject, Injectable } from '@nestjs/common';
import { ProfileNotFoundError } from '../domain/errors';
import { Profile } from '../domain/profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/repositories/profile-repository';

@Injectable()
export class GetPublicProfileUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}

  async execute(handle: string): Promise<Profile> {
    const profile = await this.profiles.findByHandle(handle.toLowerCase());
    // A private profile looks exactly like a missing one.
    if (!profile || !profile.isPublic()) {
      throw new ProfileNotFoundError(handle);
    }
    return profile;
  }
}
