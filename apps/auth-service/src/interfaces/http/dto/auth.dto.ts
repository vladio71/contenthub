import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CallbackQueryDto {
  @ApiProperty({ description: 'Authorization code from the provider' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  code!: string;

  @ApiProperty({ description: 'The state we sent. Must match the oauth_state cookie.' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  state!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  refreshToken!: string;
}

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() login!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ nullable: true, type: String }) avatarUrl!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() lastLoginAt!: string;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ description: 'Access token lifetime in seconds' }) expiresIn!: number;
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
}

export class TokensResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() expiresIn!: number;
}

export class SessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() startedAt!: string;
  @ApiProperty() lastRefreshedAt!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ nullable: true, type: String }) userAgent!: string | null;
  @ApiProperty({ nullable: true, type: String }) ip!: string | null;
  @ApiProperty({ description: 'True for the session that owns the access token used in this request' }) current!: boolean;
}

export class ProviderResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() loginPath!: string;
}
