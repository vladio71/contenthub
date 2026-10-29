import { duplicateKeyFields } from './duplicate-key';

describe('duplicateKeyFields', () => {
  it('returns the fields of the violated index', () => {
    expect(duplicateKeyFields({ code: 11000, keyPattern: { itemId: 1, userId: 1 } })).toEqual(['itemId', 'userId']);
    expect(duplicateKeyFields({ code: 11000, keyValue: { handle: 'alice' } })).toEqual(['handle']);
    expect(duplicateKeyFields({ code: 11000 })).toEqual([]);
  });

  it('returns null for everything else', () => {
    expect(duplicateKeyFields(new Error('boom'))).toBeNull();
    expect(duplicateKeyFields({ code: 121 })).toBeNull();
    expect(duplicateKeyFields(null)).toBeNull();
    expect(duplicateKeyFields('E11000')).toBeNull();
  });
});
