import { Schema, Types } from 'mongoose';
import { ImageMime } from '../../domain/image-signature';
import { Theme } from '../../domain/preferences';

export const PROFILE_MODEL = 'Profile';

export interface ProfileRecord {
  _id: Types.ObjectId;
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  links: Array<{ label: string; url: string }>;
  location: string;
  avatar: { file: string; mime: ImageMime; size: number } | null;
  preferences: { theme: Theme; language: string; emailNotifications: boolean; publicProfile: boolean };
  createdAt: Date;
  updatedAt: Date;
}

export const ProfileSchema = new Schema<ProfileRecord>(
  {
    userId: { type: String, required: true },
    handle: { type: String, required: true },
    displayName: { type: String, required: true },
    bio: { type: String, default: '' },
    links: { type: [new Schema({ label: String, url: String }, { _id: false })], default: [] },
    location: { type: String, default: '' },
    avatar: {
      type: new Schema({ file: String, mime: String, size: Number }, { _id: false }),
      default: null,
    },
    preferences: {
      type: new Schema(
        { theme: String, language: String, emailNotifications: Boolean, publicProfile: Boolean },
        { _id: false },
      ),
      required: true,
    },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'profiles', versionKey: false },
);

// Unique indexes: these are the real guard against two users taking the same handle.
ProfileSchema.index({ userId: 1 }, { unique: true });
ProfileSchema.index({ handle: 1 }, { unique: true });
ProfileSchema.index({ createdAt: -1 });
// Text index for GET /?q=. Handle and display name matter more than the bio.
ProfileSchema.index(
  { displayName: 'text', handle: 'text', bio: 'text' },
  { weights: { handle: 10, displayName: 5, bio: 1 }, name: 'profile_text' },
);
