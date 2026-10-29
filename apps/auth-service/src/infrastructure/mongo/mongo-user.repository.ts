import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { duplicateKeyFields } from '@contenthub/common';
import { UserRepository } from '../../domain/repositories/user-repository';
import { ProviderUserProfile, User } from '../../domain/user';
import { USER_MODEL, UserRecord } from './schemas';

@Injectable()
export class MongoUserRepository implements UserRepository, OnModuleInit {
  constructor(@InjectModel(USER_MODEL) private readonly model: Model<UserRecord>) {}

  async onModuleInit(): Promise<void> {
    // Build indexes before the first request, the upsert below relies on the unique one.
    await this.model.init();
  }

  async upsertFromProvider(profile: ProviderUserProfile, now: Date): Promise<User> {
    try {
      return await this.upsertOnce(profile, now);
    } catch (error) {
      // Two first logins at the same moment can both try to insert. The loser retries as an update.
      if (duplicateKeyFields(error)) {
        return this.upsertOnce(profile, now);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.model.findById(id).lean();
    return record ? this.toDomain(record) : null;
  }

  private async upsertOnce(profile: ProviderUserProfile, now: Date): Promise<User> {
    const record = await this.model
      .findOneAndUpdate(
        { provider: profile.provider, providerUserId: profile.providerUserId },
        {
          $set: { login: profile.login, name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl, lastLoginAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .lean();
    if (!record) {
      throw new Error('Upsert returned no document');
    }
    return this.toDomain(record);
  }

  private toDomain(record: UserRecord): User {
    return new User({
      id: record._id.toHexString(),
      provider: record.provider,
      providerUserId: record.providerUserId,
      login: record.login,
      name: record.name,
      email: record.email,
      avatarUrl: record.avatarUrl,
      createdAt: record.createdAt,
      lastLoginAt: record.lastLoginAt,
    });
  }
}
