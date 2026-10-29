import { InvalidProfileError } from './errors';

export type Theme = 'light' | 'dark' | 'system';
export const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

export interface Preferences {
  theme: Theme;
  language: string;
  emailNotifications: boolean;
  /** When false, GET /:handle returns 404 and the profile is hidden from search. */
  publicProfile: boolean;
}

export type PreferencesPatch = Partial<Preferences>;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  language: 'en',
  emailNotifications: true,
  publicProfile: true,
};

const LANGUAGE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

export function applyPreferencesPatch(current: Preferences, patch: PreferencesPatch): Preferences {
  const next: Preferences = { ...current, ...removeUndefined(patch) };
  if (!THEMES.includes(next.theme)) {
    throw new InvalidProfileError(`Theme must be one of: ${THEMES.join(', ')}`);
  }
  if (!LANGUAGE_PATTERN.test(next.language)) {
    throw new InvalidProfileError('Language must look like "en" or "uk-UA"');
  }
  return next;
}

function removeUndefined(patch: PreferencesPatch): PreferencesPatch {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as PreferencesPatch;
}
