import { Schema, Types } from 'mongoose';
import { AuthProviderName } from '../../domain/user';

export const USER_MODEL = 'User';
export const REFRESH_TOKEN_MODEL = 'RefreshToken';

export interface UserRecord {
  _id: Types.ObjectId;
  provider: AuthProviderName;
  providerUserId: string;
  login: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  lastLoginAt: Date;
}

export const UserSchema = new Schema<UserRecord>(
  {
    provider: { type: String, required: true },
    providerUserId: { type: String, required: true },
    login: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    createdAt: { type: Date, required: true },
    lastLoginAt: { type: Date, required: true },
  },
  { collection: 'users', versionKey: false },
);
// One user per provider account. This index makes the upsert safe.
UserSchema.index({ provider: 1, providerUserId: 1 }, { unique: true });

export interface RefreshTokenRecord {
  _id: Types.ObjectId;
  familyId: string;
  userId: string;
  tokenHash: string;
  sessionStartedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
}

export const RefreshTokenSchema = new Schema<RefreshTokenRecord>(
  {
    familyId: { type: String, required: true },
    userId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    sessionStartedAt: { type: Date, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { collection: 'refresh_tokens', versionKey: false },
);
RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
RefreshTokenSchema.index({ familyId: 1 });
RefreshTokenSchema.index({ userId: 1, usedAt: 1, revokedAt: 1 });
// MongoDB deletes expired tokens by itself.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
