import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { duplicateKeyFields, toSkipLimit } from '@contenthub/common';
import { HandleTakenError, ProfileAlreadyExistsError, ProfileNotFoundError } from '../../domain/errors';
import { Handle } from '../../domain/handle';
import { Profile } from '../../domain/profile';
import { ProfileRepository, ProfileSearchQuery, ProfileSearchResult } from '../../domain/repositories/profile-repository';
import { PROFILE_MODEL, ProfileRecord } from './profile.schema';

@Injectable()
export class MongoProfileRepository implements ProfileRepository, OnModuleInit {
  constructor(@InjectModel(PROFILE_MODEL) private readonly model: Model<ProfileRecord>) {}

  async onModuleInit(): Promise<void> {
    await this.model.init();
  }

  nextId(): string {
    return new Types.ObjectId().toHexString();
  }

  async insert(profile: Profile): Promise<void> {
    try {
      await this.model.create(this.toRecord(profile));
    } catch (error) {
      throw this.translate(error, profile) ?? error;
    }
  }

  async save(profile: Profile): Promise<void> {
    const { _id, userId, ...fields } = this.toRecord(profile);
    try {
      const result = await this.model.updateOne({ _id }, { $set: fields });
      if (result.matchedCount === 0) {
        throw new ProfileNotFoundError(userId);
      }
    } catch (error) {
      throw this.translate(error, profile) ?? error;
    }
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const record = await this.model.findOne({ userId }).lean();
    return record ? this.toDomain(record) : null;
  }

  async findByHandle(handle: string): Promise<Profile | null> {
    const record = await this.model.findOne({ handle }).lean();
    return record ? this.toDomain(record) : null;
  }

  async search(query: ProfileSearchQuery): Promise<ProfileSearchResult> {
    const { skip, limit } = toSkipLimit(query.page, query.pageSize);
    const filter: Record<string, unknown> = { 'preferences.publicProfile': true };

    if (query.text) {
      filter.$text = { $search: query.text };
      const [records, total] = await Promise.all([
        this.model
          .find(filter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' }, _id: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.model.countDocuments(filter),
      ]);
      return { profiles: records.map((record) => this.toDomain(record)), total };
    }

    const [records, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);
    return { profiles: records.map((record) => this.toDomain(record)), total };
  }

  /** Turns a duplicate key error into a domain error that says which rule was broken. */
  private translate(error: unknown, profile: Profile): Error | null {
    const fields = duplicateKeyFields(error);
    if (!fields) {
      return null;
    }
    return fields.includes('userId') ? new ProfileAlreadyExistsError(profile.userId) : new HandleTakenError(profile.handle.value);
  }

  private toRecord(profile: Profile): ProfileRecord {
    return {
      _id: new Types.ObjectId(profile.id),
      userId: profile.userId,
      handle: profile.handle.value,
      displayName: profile.displayName,
      bio: profile.bio,
      links: profile.links,
      location: profile.location,
      avatar: profile.avatar,
      preferences: profile.preferences,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private toDomain(record: ProfileRecord): Profile {
    return Profile.restore({
      id: record._id.toHexString(),
      userId: record.userId,
      handle: Handle.parse(record.handle),
      displayName: record.displayName,
      bio: record.bio,
      links: record.links.map((link) => ({ label: link.label, url: link.url })),
      location: record.location,
      avatar: record.avatar ? { file: record.avatar.file, mime: record.avatar.mime, size: record.avatar.size } : null,
      preferences: { ...record.preferences },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
