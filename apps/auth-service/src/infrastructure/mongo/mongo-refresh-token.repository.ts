import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshToken } from '../../domain/refresh-token';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token-repository';
import { REFRESH_TOKEN_MODEL, RefreshTokenRecord } from './schemas';

@Injectable()
export class MongoRefreshTokenRepository implements RefreshTokenRepository, OnModuleInit {
  constructor(@InjectModel(REFRESH_TOKEN_MODEL) private readonly model: Model<RefreshTokenRecord>) {}

  async onModuleInit(): Promise<void> {
    await this.model.init();
  }

  nextId(): string {
    return new Types.ObjectId().toHexString();
  }

  async insert(token: RefreshToken): Promise<void> {
    await this.model.create({
      _id: new Types.ObjectId(token.id),
      familyId: token.familyId,
      userId: token.userId,
      tokenHash: token.tokenHash,
      sessionStartedAt: token.sessionStartedAt,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt,
      revokedAt: token.revokedAt,
      userAgent: token.userAgent,
      ip: token.ip,
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const record = await this.model.findOne({ tokenHash }).lean();
    return record ? this.toDomain(record) : null;
  }

  async markUsed(id: string, now: Date): Promise<boolean> {
    // The filter is the lock: a second request with the same token matches nothing.
    const result = await this.model.updateOne({ _id: new Types.ObjectId(id), usedAt: null, revokedAt: null }, { $set: { usedAt: now } });
    return result.modifiedCount === 1;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.model.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now } });
  }

  async revokeFamilyOfUser(familyId: string, userId: string, now: Date): Promise<boolean> {
    const result = await this.model.updateMany({ familyId, userId, revokedAt: null }, { $set: { revokedAt: now } });
    return result.modifiedCount > 0;
  }

  async listActiveByUser(userId: string, now: Date): Promise<RefreshToken[]> {
    const records = await this.model
      .find({ userId, usedAt: null, revokedAt: null, expiresAt: { $gt: now } })
      .sort({ sessionStartedAt: -1 })
      .lean();
    return records.map((record) => this.toDomain(record));
  }

  private toDomain(record: RefreshTokenRecord): RefreshToken {
    return new RefreshToken({
      id: record._id.toHexString(),
      familyId: record.familyId,
      userId: record.userId,
      tokenHash: record.tokenHash,
      sessionStartedAt: record.sessionStartedAt,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
      revokedAt: record.revokedAt,
      userAgent: record.userAgent,
      ip: record.ip,
    });
  }
}
