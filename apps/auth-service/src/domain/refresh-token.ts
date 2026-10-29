export interface RefreshTokenProps {
  id: string;
  /** All tokens of one login share a family. A family is what the user sees as "a session". */
  familyId: string;
  userId: string;
  /** Only the hash is stored. The raw token exists only in the response to the client. */
  tokenHash: string;
  sessionStartedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
}

export interface IssueRefreshTokenInput {
  id: string;
  familyId: string;
  userId: string;
  tokenHash: string;
  sessionStartedAt: Date;
  now: Date;
  ttlMs: number;
  userAgent: string | null;
  ip: string | null;
}

/** What to do with a presented refresh token. */
export type RotationCheck = 'ok' | 'reused' | 'revoked' | 'expired';

export class RefreshToken {
  readonly id: string;
  readonly familyId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly sessionStartedAt: Date;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly userAgent: string | null;
  readonly ip: string | null;

  constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.familyId = props.familyId;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.sessionStartedAt = props.sessionStartedAt;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
    this.usedAt = props.usedAt;
    this.revokedAt = props.revokedAt;
    this.userAgent = props.userAgent;
    this.ip = props.ip;
  }

  static issue(input: IssueRefreshTokenInput): RefreshToken {
    return new RefreshToken({
      id: input.id,
      familyId: input.familyId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      sessionStartedAt: input.sessionStartedAt,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + input.ttlMs),
      usedAt: null,
      revokedAt: null,
      userAgent: input.userAgent,
      ip: input.ip,
    });
  }

  /**
   * Order matters. A token that was already used is the dangerous case:
   * either the client has a bug or someone stole the token. The caller revokes the whole family.
   */
  checkRotation(now: Date): RotationCheck {
    if (this.usedAt) {
      return 'reused';
    }
    if (this.revokedAt) {
      return 'revoked';
    }
    if (this.expiresAt.getTime() <= now.getTime()) {
      return 'expired';
    }
    return 'ok';
  }

  isActive(now: Date): boolean {
    return this.checkRotation(now) === 'ok';
  }
}
