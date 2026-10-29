import { HandleTakenError, UnsupportedImageTypeError } from '../domain/errors';
import { FixedClock, InMemoryAvatarStorage, InMemoryProfileRepository, PNG_BYTES, JPEG_BYTES } from '../testing/fakes';
import { GetMyProfileUseCase } from './get-my-profile.use-case';
import { GetPublicProfileUseCase } from './get-public-profile.use-case';
import { RemoveAvatarUseCase } from './remove-avatar.use-case';
import { UpdateMyProfileUseCase } from './update-my-profile.use-case';
import { UpdatePreferencesUseCase } from './update-preferences.use-case';
import { UploadAvatarUseCase } from './upload-avatar.use-case';

function setup() {
  const repository = new InMemoryProfileRepository();
  const storage = new InMemoryAvatarStorage();
  const clock = new FixedClock();
  const getMine = new GetMyProfileUseCase(repository, clock);
  return {
    repository,
    storage,
    getMine,
    update: new UpdateMyProfileUseCase(repository, clock, getMine),
    preferences: new UpdatePreferencesUseCase(repository, clock, getMine),
    upload: new UploadAvatarUseCase(repository, storage, clock, getMine),
    remove: new RemoveAvatarUseCase(repository, storage, clock, getMine),
    publicProfile: new GetPublicProfileUseCase(repository),
  };
}

const alice = { userId: 'a'.repeat(24), login: 'alice', name: 'Alice Moroz' };
const bob = { userId: 'b'.repeat(24), login: 'alice', name: 'Bob (same login)' };
const emptyDetails = { displayName: 'Alice', bio: '', location: '', links: [] };

describe('GetMyProfileUseCase', () => {
  it('creates the profile on first access and returns the same one after', async () => {
    const { getMine, repository } = setup();
    const first = await getMine.execute(alice);
    const second = await getMine.execute(alice);
    expect(first.handle.value).toBe('alice');
    expect(first.displayName).toBe('Alice Moroz');
    expect(second.id).toBe(first.id);
    expect(repository.profiles.size).toBe(1);
  });

  it('picks another handle when the login is already taken', async () => {
    const { getMine } = setup();
    const first = await getMine.execute(alice);
    const second = await getMine.execute(bob);
    expect(first.handle.value).toBe('alice');
    expect(second.handle.value).toMatch(/^alice-[0-9a-f]{4}$/);
  });
});

describe('UpdateMyProfileUseCase', () => {
  it('reports a taken handle as a conflict', async () => {
    const { getMine, update } = setup();
    await getMine.execute(alice);
    await getMine.execute(bob);
    await expect(update.execute(bob, { ...emptyDetails, handle: 'alice' })).rejects.toBeInstanceOf(HandleTakenError);
  });

  it('keeps the old handle when none is sent', async () => {
    const { update } = setup();
    const profile = await update.execute(alice, { ...emptyDetails, displayName: 'New name' });
    expect(profile.handle.value).toBe('alice');
    expect(profile.displayName).toBe('New name');
  });
});

describe('avatar use cases', () => {
  it('stores the file, replaces the old one and removes it on delete', async () => {
    const { upload, remove, storage } = setup();
    const first = await upload.execute(alice, PNG_BYTES);
    expect(first.avatar).toMatchObject({ mime: 'image/png', size: PNG_BYTES.length });
    expect(storage.files.size).toBe(1);

    const second = await upload.execute(alice, JPEG_BYTES);
    expect(second.avatar?.mime).toBe('image/jpeg');
    expect(storage.files.size).toBe(1);

    const removed = await remove.execute(alice);
    expect(removed.avatar).toBeNull();
    expect(storage.files.size).toBe(0);
  });

  it('rejects content that is not an image, whatever the client says', async () => {
    const { upload, storage } = setup();
    await expect(upload.execute(alice, Buffer.from('not an image at all'))).rejects.toBeInstanceOf(UnsupportedImageTypeError);
    expect(storage.files.size).toBe(0);
  });
});

describe('privacy', () => {
  it('hides a profile when publicProfile is false', async () => {
    const { getMine, preferences, publicProfile } = setup();
    await getMine.execute(alice);
    await expect(publicProfile.execute('alice')).resolves.toBeDefined();
    await preferences.execute(alice, { publicProfile: false });
    await expect(publicProfile.execute('alice')).rejects.toThrow('Profile not found');
  });
});
