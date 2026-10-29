export type AuthProviderName = 'github';

/** What we learn about a person from the OAuth provider. */
export interface ProviderUserProfile {
  provider: AuthProviderName;
  providerUserId: string;
  login: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface UserProps extends ProviderUserProfile {
  id: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export class User {
  readonly id: string;
  readonly provider: AuthProviderName;
  readonly providerUserId: string;
  readonly login: string;
  readonly name: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: Date;
  readonly lastLoginAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.provider = props.provider;
    this.providerUserId = props.providerUserId;
    this.login = props.login;
    this.name = props.name;
    this.email = props.email;
    this.avatarUrl = props.avatarUrl;
    this.createdAt = props.createdAt;
    this.lastLoginAt = props.lastLoginAt;
  }
}
