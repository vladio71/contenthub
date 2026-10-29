import { Inject, Injectable } from '@nestjs/common';
import { UnsupportedImageTypeError } from '../domain/errors';
import { detectImageType, EXTENSION_BY_MIME } from '../domain/image-signature';
import { Profile } from '../domain/profile';
import { PROFILE_REPOSITORY, ProfileRepository } from '../domain/repositories/profile-repository';
import { GetMyProfileUseCase, ProfileOwner } from './get-my-profile.use-case';
import { AVATAR_STORAGE, AvatarStorage, CLOCK, Clock } from './ports';

@Injectable()
export class UploadAvatarUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(AVATAR_STORAGE) private readonly storage: AvatarStorage,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly getMyProfile: GetMyProfileUseCase,
  ) {}

  async execute(owner: ProfileOwner, content: Buffer): Promise<Profile> {
    // The type comes from the bytes. The Content-Type header and file name are ignored.
    const mime = detectImageType(content);
    if (!mime) {
      throw new UnsupportedImageTypeError();
    }

    const profile = await this.getMyProfile.execute(owner);
    const file = await this.storage.save(content, EXTENSION_BY_MIME[mime]);
    const previous = profile.changeAvatar({ file, mime, size: content.length }, this.clock.now());

    try {
      await this.profiles.save(profile);
    } catch (error) {
      await this.storage.delete(file);
      throw error;
    }
    if (previous) {
      await this.storage.delete(previous.file);
    }
    return profile;
  }
}
