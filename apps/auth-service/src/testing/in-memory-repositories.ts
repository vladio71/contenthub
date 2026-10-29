import { RefreshToken } from '../domain/refresh-token';
import { RefreshTokenRepository } from '../domain/repositories/refresh-token-repository';
import { UserRepository } from '../domain/repositories/user-repository';
import { ProviderUserProfile, User } from '../domain/user';

/**
 * Fake repositories for tests. They follow the same contract as the Mongo ones,
 * so use cases can be tested without a database.
 */
let idCounter = 0;
export function fakeObjectId(): string {
  idCounter += 1;
  return idCounter.toString(16).padStart(24, '0');
}

export class InMemoryUserRepository implements UserRepository {
  readonly users: User[] = [];

  async upsertFromProvider(profile: ProviderUserProfile, now: Date): Promise<User> {
    const existing = this.users.find((user) => user.provider === profile.provider && user.providerUserId === profile.providerUserId);
    const user = new User({ ...profile, id: existing?.id ?? fakeObjectId(), createdAt: existing?.createdAt ?? now, lastLoginAt: now });
    if (existing) {
      this.users[this.users.indexOf(existing)] = user;
    } else {
      this.users.push(user);
    }
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly tokens: RefreshToken[] = [];

  nextId(): string {
    return fakeObjectId();
  }

  async insert(token: RefreshToken): Promise<void> {
    this.tokens.push(token);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.tokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async markUsed(id: string, now: Date): Promise<boolean> {
    const token = this.tokens.find((candidate) => candidate.id === id);
    if (!token || token.usedAt || token.revokedAt) {
      return false;
    }
    this.replace(token, { usedAt: now });
    return true;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const token of this.tokens.filter((candidate) => candidate.familyId === familyId && !candidate.revokedAt)) {
      this.replace(token, { revokedAt: now });
    }
  }

  async revokeFamilyOfUser(familyId: string, userId: string, now: Date): Promise<boolean> {
    const owned = this.tokens.filter((token) => token.familyId === familyId && token.userId === userId && !token.revokedAt);
    owned.forEach((token) => this.replace(token, { revokedAt: now }));
    return owned.length > 0;
  }

  async listActiveByUser(userId: string, now: Date): Promise<RefreshToken[]> {
    return this.tokens.filter((token) => token.userId === userId && token.isActive(now));
  }

  private replace(token: RefreshToken, change: Partial<RefreshToken>): void {
    this.tokens[this.tokens.indexOf(token)] = new RefreshToken({ ...token, ...change });
  }
}
