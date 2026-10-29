import { InvalidProfileError } from './errors';
import { Handle } from './handle';
import { ImageMime } from './image-signature';
import { applyPreferencesPatch, DEFAULT_PREFERENCES, Preferences, PreferencesPatch } from './preferences';

export interface ProfileLink {
  label: string;
  url: string;
}

export interface Avatar {
  /** Stored file name. It is random, never the name the client sent. */
  file: string;
  mime: ImageMime;
  size: number;
}

export interface ProfileProps {
  id: string;
  userId: string;
  handle: Handle;
  displayName: string;
  bio: string;
  links: ProfileLink[];
  location: string;
  avatar: Avatar | null;
  preferences: Preferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileDetails {
  handle?: Handle;
  displayName: string;
  bio: string;
  links: ProfileLink[];
  location: string;
}

const MAX_DISPLAY_NAME = 80;
const MAX_BIO = 500;
const MAX_LOCATION = 80;
const MAX_LINKS = 5;

export class Profile {
  private constructor(private props: ProfileProps) {}

  static restore(props: ProfileProps): Profile {
    return new Profile({ ...props, links: [...props.links] });
  }

  /** First access: the profile is built from what the access token tells us. */
  static createFor(input: { id: string; userId: string; handle: Handle; displayName: string; now: Date }): Profile {
    const displayName = input.displayName.trim().slice(0, MAX_DISPLAY_NAME) || input.handle.value;
    return new Profile({
      id: input.id,
      userId: input.userId,
      handle: input.handle,
      displayName,
      bio: '',
      links: [],
      location: '',
      avatar: null,
      preferences: { ...DEFAULT_PREFERENCES },
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get handle(): Handle {
    return this.props.handle;
  }
  get displayName(): string {
    return this.props.displayName;
  }
  get bio(): string {
    return this.props.bio;
  }
  get links(): ProfileLink[] {
    return [...this.props.links];
  }
  get location(): string {
    return this.props.location;
  }
  get avatar(): Avatar | null {
    return this.props.avatar;
  }
  get preferences(): Preferences {
    return { ...this.props.preferences };
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** A copy of the state. Repositories use it to copy aggregates without sharing references. */
  snapshot(): ProfileProps {
    return { ...this.props, links: this.links, preferences: this.preferences };
  }

  isPublic(): boolean {
    return this.props.preferences.publicProfile;
  }

  /** Replaces the editable fields (this is what PUT /me does). */
  updateDetails(details: ProfileDetails, now: Date): void {
    const displayName = details.displayName.trim();
    if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME) {
      throw new InvalidProfileError(`Display name must have 1-${MAX_DISPLAY_NAME} characters`);
    }
    if (details.bio.length > MAX_BIO) {
      throw new InvalidProfileError(`Bio can have at most ${MAX_BIO} characters`);
    }
    if (details.location.length > MAX_LOCATION) {
      throw new InvalidProfileError(`Location can have at most ${MAX_LOCATION} characters`);
    }
    if (details.links.length > MAX_LINKS) {
      throw new InvalidProfileError(`A profile can have at most ${MAX_LINKS} links`);
    }
    details.links.forEach(assertWebLink);

    this.props = {
      ...this.props,
      handle: details.handle ?? this.props.handle,
      displayName,
      bio: details.bio,
      links: details.links.map((link) => ({ ...link })),
      location: details.location,
      updatedAt: now,
    };
  }

  updatePreferences(patch: PreferencesPatch, now: Date): void {
    this.props = { ...this.props, preferences: applyPreferencesPatch(this.props.preferences, patch), updatedAt: now };
  }

  /** Returns the old avatar so the caller can delete its file. */
  changeAvatar(avatar: Avatar, now: Date): Avatar | null {
    const previous = this.props.avatar;
    this.props = { ...this.props, avatar, updatedAt: now };
    return previous;
  }

  removeAvatar(now: Date): Avatar | null {
    const previous = this.props.avatar;
    this.props = { ...this.props, avatar: null, updatedAt: now };
    return previous;
  }
}

function assertWebLink(link: ProfileLink): void {
  let url: URL;
  try {
    url = new URL(link.url);
  } catch {
    throw new InvalidProfileError(`Link "${link.label}" is not a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidProfileError(`Link "${link.label}" must use http or https`);
  }
  if (link.label.trim().length === 0) {
    throw new InvalidProfileError('Every link needs a label');
  }
}
