import { AvatarStorage, Clock } from '../application/ports';
import { ProfileConfig } from '../config';
import { HandleTakenError, ProfileAlreadyExistsError, ProfileNotFoundError } from '../domain/errors';
import { Profile } from '../domain/profile';
import { ProfileRepository, ProfileSearchQuery, ProfileSearchResult } from '../domain/repositories/profile-repository';

export const TEST_SECRET = 'test-secret-test-secret-test-secret-1234';

export class FixedClock implements Clock {
  now(): Date {
    return new Date('2026-01-01T10:00:00Z');
  }
}

/** Like a database, the fake hands out copies. Changing a loaded profile must not change the stored one. */
function copy(profile: Profile): Profile {
  return Profile.restore(profile.snapshot());
}

/** Same rules as the Mongo repository: unique userId and unique handle. */
export class InMemoryProfileRepository implements ProfileRepository {
  readonly profiles = new Map<string, Profile>();
  private counter = 0;

  nextId(): string {
    this.counter += 1;
    return this.counter.toString(16).padStart(24, '0');
  }

  async insert(profile: Profile): Promise<void> {
    this.assertUnique(profile);
    this.profiles.set(profile.id, copy(profile));
  }

  async save(profile: Profile): Promise<void> {
    if (!this.profiles.has(profile.id)) {
      throw new ProfileNotFoundError(profile.userId);
    }
    this.assertUnique(profile);
    this.profiles.set(profile.id, copy(profile));
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const found = [...this.profiles.values()].find((profile) => profile.userId === userId);
    return found ? copy(found) : null;
  }

  async findByHandle(handle: string): Promise<Profile | null> {
    const found = [...this.profiles.values()].find((profile) => profile.handle.value === handle);
    return found ? copy(found) : null;
  }

  async search(query: ProfileSearchQuery): Promise<ProfileSearchResult> {
    const text = query.text?.toLowerCase();
    const matches = [...this.profiles.values()].filter(
      (profile) =>
        profile.isPublic() &&
        (!text || `${profile.handle.value} ${profile.displayName} ${profile.bio}`.toLowerCase().includes(text)),
    );
    const start = (query.page - 1) * query.pageSize;
    return { profiles: matches.slice(start, start + query.pageSize).map(copy), total: matches.length };
  }

  private assertUnique(profile: Profile): void {
    for (const other of this.profiles.values()) {
      if (other.id === profile.id) {
        continue;
      }
      if (other.handle.equals(profile.handle)) {
        throw new HandleTakenError(profile.handle.value);
      }
      if (other.userId === profile.userId) {
        throw new ProfileAlreadyExistsError(profile.userId);
      }
    }
  }
}

export class InMemoryAvatarStorage implements AvatarStorage {
  readonly files = new Map<string, Buffer>();
  private counter = 0;

  async save(content: Buffer, extension: string): Promise<string> {
    this.counter += 1;
    const file = `${this.counter.toString(16).padStart(32, '0')}.${extension}`;
    this.files.set(file, content);
    return file;
  }

  async delete(file: string): Promise<void> {
    this.files.delete(file);
  }
}

export function testProfileConfig(avatarDir: string): ProfileConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    mongoUri: 'mongodb://unused',
    mongoDbName: 'unused',
    jwtSecret: TEST_SECRET,
    avatarDir,
  };
}

/** The smallest valid-looking files for each type. Only the first bytes matter to the check. */
export const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
export const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
export const WEBP_BYTES = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(16)]);
