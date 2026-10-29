import { Inject, Injectable } from '@nestjs/common';
import { OAUTH_PROVIDER, OAuthProvider, TOKEN_CODEC, TokenCodec } from './ports';

export interface GithubLoginStart {
  authorizeUrl: string;
  /** The caller stores it in a cookie and checks it again in the callback. */
  state: string;
}

@Injectable()
export class StartGithubLoginUseCase {
  constructor(
    @Inject(OAUTH_PROVIDER) private readonly provider: OAuthProvider,
    @Inject(TOKEN_CODEC) private readonly codec: TokenCodec,
  ) {}

  execute(): GithubLoginStart {
    const state = this.codec.createOpaqueToken();
    return { authorizeUrl: this.provider.buildAuthorizeUrl(state), state };
  }
}
