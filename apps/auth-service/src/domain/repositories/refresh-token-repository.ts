import { RefreshToken } from '../refresh-token';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepository {
  nextId(): string;
  insert(token: RefreshToken): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /**
   * Marks the token as used only if it is still unused and not revoked.
   * Returns true for exactly one caller, even when two requests race.
   */
  markUsed(id: string, now: Date): Promise<boolean>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  /** Returns false when the user has no such active session. */
  revokeFamilyOfUser(familyId: string, userId: string, now: Date): Promise<boolean>;
  /** The current (unused, not revoked, not expired) token of each session of the user. */
  listActiveByUser(userId: string, now: Date): Promise<RefreshToken[]>;
}
