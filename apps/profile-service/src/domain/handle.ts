import { InvalidHandleError } from './errors';

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;
const RESERVED_HANDLES = new Set(['me', 'admin', 'api', 'docs', 'health', 'uploads', 'search', 'support']);
const MIN_LENGTH = 3;
const MAX_LENGTH = 30;

/** The public name in the profile URL. Lowercase, 3 to 30 characters: a-z, 0-9, "_" and "-". */
export class Handle {
  private constructor(readonly value: string) {}

  static parse(raw: string): Handle {
    const value = raw.trim().toLowerCase();
    if (!HANDLE_PATTERN.test(value)) {
      throw new InvalidHandleError(
        `Handle must have ${MIN_LENGTH}-${MAX_LENGTH} characters: letters, digits, "_" or "-", starting and ending with a letter or digit`,
      );
    }
    if (RESERVED_HANDLES.has(value)) {
      throw new InvalidHandleError(`"${value}" is a reserved handle`);
    }
    return new Handle(value);
  }

  /** Makes a valid handle from any login, for example "John_Doe!" becomes "john_doe". */
  static suggestFrom(login: string, fallbackSeed: string): Handle {
    const cleaned = login
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '')
      .slice(0, MAX_LENGTH);
    const candidate = cleaned.length >= MIN_LENGTH ? cleaned : `user-${fallbackSeed}`;
    return RESERVED_HANDLES.has(candidate) ? Handle.parse(`${candidate}-1`) : Handle.parse(candidate);
  }

  /** Used when the suggested handle is taken: "alice" becomes "alice-4f2a". */
  withSuffix(suffix: string): Handle {
    return Handle.parse(`${this.value.slice(0, MAX_LENGTH - suffix.length - 1)}-${suffix}`);
  }

  equals(other: Handle): boolean {
    return this.value === other.value;
  }
}
