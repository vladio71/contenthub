import { OffsetPage } from '@contenthub/common';
import { Profile } from '../../domain/profile';
import { PROFILE_PREFIX } from '../../config';
import { MyProfileResponseDto, ProfilePageResponseDto, PublicProfileResponseDto } from './dto/profile.dto';

export function toPublicProfile(profile: Profile): PublicProfileResponseDto {
  return {
    handle: profile.handle.value,
    displayName: profile.displayName,
    bio: profile.bio,
    location: profile.location,
    links: profile.links,
    avatar: profile.avatar
      ? { url: `/${PROFILE_PREFIX}/uploads/avatars/${profile.avatar.file}`, mime: profile.avatar.mime, size: profile.avatar.size }
      : null,
    createdAt: profile.createdAt.toISOString(),
  };
}

export function toMyProfile(profile: Profile): MyProfileResponseDto {
  return {
    ...toPublicProfile(profile),
    id: profile.id,
    userId: profile.userId,
    preferences: profile.preferences,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function toProfilePage(page: OffsetPage<Profile>): ProfilePageResponseDto {
  return { ...page, items: page.items.map(toPublicProfile) };
}
