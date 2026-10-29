import { Inject, Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { AvatarStorage } from '../application/ports';
import { PROFILE_CONFIG, ProfileConfig } from '../config';

/** Names we create ourselves. Anything else is rejected, so a path like "../x" never reaches the disk. */
export const STORED_FILE_PATTERN = /^[a-f0-9]{32}\.(png|jpg|webp)$/;

@Injectable()
export class LocalAvatarStorage implements AvatarStorage {
  constructor(@Inject(PROFILE_CONFIG) private readonly config: ProfileConfig) {}

  async save(content: Buffer, extension: string): Promise<string> {
    await mkdir(this.config.avatarDir, { recursive: true });
    const file = `${randomBytes(16).toString('hex')}.${extension}`;
    await writeFile(join(this.config.avatarDir, file), content, { flag: 'wx' });
    return file;
  }

  async delete(file: string): Promise<void> {
    if (!STORED_FILE_PATTERN.test(file)) {
      return;
    }
    try {
      await unlink(join(this.config.avatarDir, file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
