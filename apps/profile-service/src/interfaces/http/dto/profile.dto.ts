import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '@contenthub/common';
import { THEMES, Theme } from '../../../domain/preferences';

export class ProfileLinkDto {
  @ApiProperty({ example: 'GitHub' })
  @IsString()
  @Length(1, 40)
  label!: string;

  @ApiProperty({ example: 'https://github.com/alice' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'alice-dev', description: '3-30 characters: a-z, 0-9, "_" and "-"' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,28}[A-Za-z0-9]$/, { message: 'handle must have 3-30 letters, digits, "_" or "-"' })
  handle?: string;

  @ApiProperty({ example: 'Alice Moroz' })
  @IsString()
  @Length(1, 80)
  displayName!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'Mykolaiv, Ukraine' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  location?: string;

  @ApiPropertyOptional({ type: [ProfileLinkDto], maxItems: 5 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ProfileLinkDto)
  links?: ProfileLinkDto[];
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: THEMES })
  @IsOptional()
  @IsIn(THEMES)
  theme?: Theme;

  @ApiPropertyOptional({ example: 'uk-UA' })
  @IsOptional()
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'language must look like "en" or "uk-UA"' })
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publicProfile?: boolean;
}

export class SearchProfilesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Text search over handle, display name and bio' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class PreferencesResponseDto {
  @ApiProperty({ enum: THEMES }) theme!: Theme;
  @ApiProperty() language!: string;
  @ApiProperty() emailNotifications!: boolean;
  @ApiProperty() publicProfile!: boolean;
}

export class AvatarResponseDto {
  @ApiProperty() url!: string;
  @ApiProperty() mime!: string;
  @ApiProperty() size!: number;
}

/** What anyone can see. */
export class PublicProfileResponseDto {
  @ApiProperty() handle!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() bio!: string;
  @ApiProperty() location!: string;
  @ApiProperty({ type: [ProfileLinkDto] }) links!: ProfileLinkDto[];
  @ApiProperty({ type: AvatarResponseDto, nullable: true }) avatar!: AvatarResponseDto | null;
  @ApiProperty() createdAt!: string;
}

/** What the owner sees: the public part plus ids and preferences. */
export class MyProfileResponseDto extends PublicProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ type: PreferencesResponseDto }) preferences!: PreferencesResponseDto;
  @ApiProperty() updatedAt!: string;
}

export class ProfilePageResponseDto {
  @ApiProperty({ type: [PublicProfileResponseDto] }) items!: PublicProfileResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
