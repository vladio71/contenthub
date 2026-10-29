import { Inject, Injectable } from '@nestjs/common';
import { Profile } from '../domain/profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/repositories/profile-repository';
import { GetMyProfileUseCase, ProfileOwner } from './get-my-profile.use-case';
import { AVATAR_STORAGE, AvatarStorage, CLOCK, Clock } from './ports';

@Injectable()
export class RemoveAvatarUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(AVATAR_STORAGE) private readonly storage: AvatarStorage,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getMyProfile: GetMyProfileUseCase,
  ) {}

  async execute(owner: ProfileOwner): Promise<Profile> {
    const profile = await this.getMyProfile.execute(owner);
    const previous = profile.removeAvatar(this.clock.now());
    if (previous) {
      await this.profiles.save(profile);
      await this.storage.delete(previous.file);
    }
    return profile;
  }
}
