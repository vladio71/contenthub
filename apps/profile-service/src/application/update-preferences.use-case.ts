import { Inject, Injectable } from '@nestjs/common';
import { PreferencesPatch } from '../domain/preferences';
import { Profile } from '../domain/profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/repositories/profile-repository';
import { GetMyProfileUseCase, ProfileOwner } from './get-my-profile.use-case';
import { CLOCK, Clock } from './ports';

@Injectable()
export class UpdatePreferencesUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getMyProfile: GetMyProfileUseCase,
  ) {}

  async execute(owner: ProfileOwner, patch: PreferencesPatch): Promise<Profile> {
    const profile = await this.getMyProfile.execute(owner);
    profile.updatePreferences(patch, this.clock.now());
    await this.profiles.save(profile);
    return profile;
  }
}
