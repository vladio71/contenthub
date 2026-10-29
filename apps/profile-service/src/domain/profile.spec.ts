import { InvalidProfileError } from './errors';
import { Handle } from './handle';
import { Profile } from './profile';

const NOW = new Date('2026-01-01T10:00:00Z');
const LATER = new Date('2026-01-02T10:00:00Z');

function newProfile(): Profile {
  return Profile.createFor({ id: '1'.repeat(24), userId: 'u1', handle: Handle.parse('alice'), displayName: 'Alice', now: NOW });
}

const details = { displayName: 'Alice M', bio: 'Hi', location: 'Kyiv', links: [{ label: 'Site', url: 'https://alice.dev' }] };

describe('Profile', () => {
  it('starts with default preferences and no avatar', () => {
    const profile = newProfile();
    expect(profile.avatar).toBeNull();
    expect(profile.preferences).toEqual({ theme: 'system', language: 'en', emailNotifications: true, publicProfile: true });
  });

  it('updates details and changes the handle only when one is given', () => {
    const profile = newProfile();
    profile.updateDetails(details, LATER);
    expect(profile.handle.value).toBe('alice');
    expect(profile.displayName).toBe('Alice M');
    expect(profile.updatedAt).toEqual(LATER);

    profile.updateDetails({ ...details, handle: Handle.parse('alice-new') }, LATER);
    expect(profile.handle.value).toBe('alice-new');
  });

  it.each([
    ['empty display name', { ...details, displayName: '  ' }],
    ['long bio', { ...details, bio: 'x'.repeat(501) }],
    ['six links', { ...details, links: Array.from({ length: 6 }, () => ({ label: 'a', url: 'https://a.dev' })) }],
    ['javascript link', { ...details, links: [{ label: 'x', url: 'javascript:alert(1)' }] }],
    ['broken link', { ...details, links: [{ label: 'x', url: 'not a url' }] }],
  ])('rejects %s', (_name, input) => {
    expect(() => newProfile().updateDetails(input, LATER)).toThrow(InvalidProfileError);
  });

  it('merges a preferences patch and validates it', () => {
    const profile = newProfile();
    profile.updatePreferences({ theme: 'dark', language: undefined }, LATER);
    expect(profile.preferences).toMatchObject({ theme: 'dark', language: 'en' });
    expect(() => profile.updatePreferences({ language: 'english' }, LATER)).toThrow(InvalidProfileError);
  });

  it('returns the previous avatar when it changes, so the file can be deleted', () => {
    const profile = newProfile();
    const first = { file: 'a.png', mime: 'image/png' as const, size: 10 };
    expect(profile.changeAvatar(first, NOW)).toBeNull();
    expect(profile.changeAvatar({ ...first, file: 'b.png' }, NOW)).toEqual(first);
    expect(profile.removeAvatar(NOW)?.file).toBe('b.png');
    expect(profile.avatar).toBeNull();
  });
});
