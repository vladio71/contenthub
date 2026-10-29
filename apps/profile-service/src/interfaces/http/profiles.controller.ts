import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccessTokenClaims, CurrentUser, JwtAuthGuard } from '@contenthub/common';
import { GetMyProfileUseCase, ProfileOwner } from '../../application/get-my-profile.use-case';
import { GetPublicProfileUseCase } from '../../application/get-public-profile.use-case';
import { RemoveAvatarUseCase } from '../../application/remove-avatar.use-case';
import { SearchProfilesUseCase } from '../../application/search-profiles.use-case';
import { UpdateMyProfileUseCase } from '../../application/update-my-profile.use-case';
import { UpdatePreferencesUseCase } from '../../application/update-preferences.use-case';
import { UploadAvatarUseCase } from '../../application/upload-avatar.use-case';
import { MAX_AVATAR_BYTES, PROFILE_CONFIG, ProfileConfig } from '../../config';
import { STORED_FILE_PATTERN } from '../../infrastructure/local-avatar-storage';
import {
  MyProfileResponseDto,
  ProfilePageResponseDto,
  PublicProfileResponseDto,
  SearchProfilesQueryDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { toMyProfile, toProfilePage, toPublicProfile } from './profile.mapper';

/** The part of a multer file that we use. */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

function ownerOf(claims: AccessTokenClaims): ProfileOwner {
  return { userId: claims.sub, login: claims.login, name: claims.name };
}

@ApiTags('profiles')
@Controller()
export class ProfilesController {
  constructor(
    private readonly getMyProfile: GetMyProfileUseCase,
    private readonly updateMyProfile: UpdateMyProfileUseCase,
    private readonly updatePreferences: UpdatePreferencesUseCase,
    private readonly uploadAvatar: UploadAvatarUseCase,
    private readonly removeAvatar: RemoveAvatarUseCase,
    private readonly getPublicProfile: GetPublicProfileUseCase,
    private readonly searchProfiles: SearchProfilesUseCase,
    @Inject(PROFILE_CONFIG) private readonly config: ProfileConfig,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My profile. Created from the token on first access.' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  async me(@CurrentUser() claims: AccessTokenClaims): Promise<MyProfileResponseDto> {
    return toMyProfile(await this.getMyProfile.execute(ownerOf(claims)));
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace my profile fields. A taken handle gives 409.' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  async update(@CurrentUser() claims: AccessTokenClaims, @Body() body: UpdateProfileDto): Promise<MyProfileResponseDto> {
    const profile = await this.updateMyProfile.execute(ownerOf(claims), {
      handle: body.handle,
      displayName: body.displayName,
      bio: body.bio ?? '',
      location: body.location ?? '',
      links: body.links ?? [],
    });
    return toMyProfile(profile);
  }

  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MyProfileResponseDto })
  async patchPreferences(@CurrentUser() claims: AccessTokenClaims, @Body() body: UpdatePreferencesDto): Promise<MyProfileResponseDto> {
    return toMyProfile(await this.updatePreferences.execute(ownerOf(claims), body));
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload an avatar. PNG, JPEG or WebP, at most 2 MB. The type is checked from the bytes.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['avatar'], properties: { avatar: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: MyProfileResponseDto })
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: MAX_AVATAR_BYTES, files: 1 } }))
  async upload(@CurrentUser() claims: AccessTokenClaims, @UploadedFile() file: UploadedImage | undefined): Promise<MyProfileResponseDto> {
    if (!file) {
      throw new BadRequestException('Send the image in a multipart field named "avatar"');
    }
    return toMyProfile(await this.uploadAvatar.execute(ownerOf(claims), file.buffer));
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MyProfileResponseDto })
  async deleteAvatar(@CurrentUser() claims: AccessTokenClaims): Promise<MyProfileResponseDto> {
    return toMyProfile(await this.removeAvatar.execute(ownerOf(claims)));
  }

  @Get()
  @ApiOperation({ summary: 'Search public profiles. Without q, newest first.' })
  @ApiOkResponse({ type: ProfilePageResponseDto })
  async search(@Query() query: SearchProfilesQueryDto): Promise<ProfilePageResponseDto> {
    return toProfilePage(await this.searchProfiles.execute(query));
  }

  @Get('uploads/avatars/:file')
  @ApiOperation({ summary: 'Avatar file' })
  serveAvatar(@Param('file') file: string, @Res() response: Response): void {
    if (!STORED_FILE_PATTERN.test(file)) {
      throw new NotFoundException();
    }
    response.sendFile(
      file,
      { root: this.config.avatarDir, maxAge: '1d', headers: { 'X-Content-Type-Options': 'nosniff' } },
      (error) => {
        if (error && !response.headersSent) {
          response.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Avatar not found' });
        }
      },
    );
  }

  // Keep this route last: ":handle" matches any single segment.
  @Get(':handle')
  @HttpCode(200)
  @ApiOperation({ summary: 'Public profile by handle' })
  @ApiOkResponse({ type: PublicProfileResponseDto })
  async byHandle(@Param('handle') handle: string): Promise<PublicProfileResponseDto> {
    return toPublicProfile(await this.getPublicProfile.execute(handle));
  }
}
