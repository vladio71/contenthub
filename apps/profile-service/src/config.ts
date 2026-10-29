import { CommonConfig, loadCommonConfig, readString } from '@contenthub/common';

export interface ProfileConfig extends CommonConfig {
  /** Folder where avatar files are stored. In docker it is a volume. */
  avatarDir: string;
}

export const PROFILE_CONFIG = Symbol('PROFILE_CONFIG');
export const PROFILE_PREFIX = 'api/profiles';
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function loadProfileConfig(): ProfileConfig {
  return {
    ...loadCommonConfig({ port: 4002, dbName: 'contenthub_profiles' }),
    avatarDir: readString('AVATAR_DIR', './data/avatars'),
  };
}
