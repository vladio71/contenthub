import { RefreshToken } from './refresh-token';

const NOW = new Date('2026-01-01T10:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function issue(): RefreshToken {
  return RefreshToken.issue({
    id: 'a'.repeat(24),
    familyId: 'b'.repeat(24),
    userId: 'c'.repeat(24),
    tokenHash: 'hash',
    sessionStartedAt: NOW,
    now: NOW,
    ttlMs: 30 * DAY_MS,
    userAgent: null,
    ip: null,
  });
}

describe('RefreshToken', () => {
  it('is usable right after it is issued and expires after the ttl', () => {
    const token = issue();
    expect(token.checkRotation(NOW)).toBe('ok');
    expect(token.expiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
    expect(token.checkRotation(new Date(NOW.getTime() + 30 * DAY_MS))).toBe('expired');
  });

  it('reports reuse before revoked, so the caller can react to theft', () => {
    const token = new RefreshToken({ ...issue(), usedAt: NOW, revokedAt: NOW });
    expect(token.checkRotation(NOW)).toBe('reused');
  });

  it('reports revoked tokens', () => {
    const token = new RefreshToken({ ...issue(), revokedAt: NOW });
    expect(token.checkRotation(NOW)).toBe('revoked');
    expect(token.isActive(NOW)).toBe(false);
  });
});
