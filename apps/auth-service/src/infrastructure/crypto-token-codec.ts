import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { TokenCodec } from '../application/ports';

@Injectable()
export class CryptoTokenCodec implements TokenCodec {
  createOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** SHA-256 is enough here: the input is 256 random bits, so there is nothing to brute force. */
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
