import { Inject, Injectable } from '@nestjs/common';
import { OAUTH_PROVIDER, OAuthProvider } from './ports';

export interface ProviderView {
  name: string;
  loginPath: string;
}

@Injectable()
export class ListProvidersUseCase {
  constructor(@Inject(OAUTH_PROVIDER) private readonly provider: OAuthProvider) {}

  execute(): ProviderView[] {
    return [{ name: this.provider.name, loginPath: `/${this.provider.name}/login` }];
  }
}
