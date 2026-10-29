import { InvalidHandleError } from './errors';
import { Handle } from './handle';

describe('Handle', () => {
  it('lowercases and trims', () => {
    expect(Handle.parse('  Alice-Dev ').value).toBe('alice-dev');
  });

  it.each(['ab', 'a'.repeat(31), '-alice', 'alice_', 'al ice', 'alice!', 'me', 'admin'])('rejects "%s"', (raw) => {
    expect(() => Handle.parse(raw)).toThrow(InvalidHandleError);
  });

  it('builds a valid handle from a messy login', () => {
    expect(Handle.suggestFrom('John_Doe!!', 'abc123').value).toBe('john_doe');
    expect(Handle.suggestFrom('Ян', 'abc123').value).toBe('user-abc123');
  });

  it('adds a suffix without breaking the length limit', () => {
    const long = Handle.parse('a'.repeat(30));
    const suffixed = long.withSuffix('4f2a');
    expect(suffixed.value).toHaveLength(30);
    expect(suffixed.value.endsWith('-4f2a')).toBe(true);
  });
});
