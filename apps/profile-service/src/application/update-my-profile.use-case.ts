import { Inject, Injectable } from '@nestjs/common';
import { Handle } from '../domain/handle';
import { Profile, ProfileLink } from '../domain/profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/repositories/profile-repository';
import { CLOCK, Clock } from './ports';
import { GetMyProfileUseCase, ProfileOwner } from './get-my-profile.use-case';

export interface UpdateProfileInput {
  handle?: string;
  displayName: string;
  bio: string;
  location: string;
  links: ProfileLink[];
}

@Injectable()
export class UpdateMyProfileUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getMyProfile: GetMyProfileUseCase,
  ) {}

  async execute(owner: ProfileOwner, input: UpdateProfileInput): Promise<Profile> {
    const profile = await this.getMyProfile.execute(owner);
    profile.updateDetails(
      {
        handle: input.handle === undefined ? undefined : Handle.parse(input.handle),
        displayName: input.displayName,
        bio: input.bio,
        location: input.location,
        links: input.links,
      },
      this.clock.now(),
    );
    // A taken handle is reported by the unique index, so two users cannot both win.
    await this.profiles.save(profile);
    return profile;
  }
}
