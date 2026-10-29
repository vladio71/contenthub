import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccessTokenClaims, CurrentUser, JwtAuthGuard, ParseObjectIdPipe } from '@contenthub/common';
import { CompleteGithubLoginUseCase } from '../../application/complete-github-login.use-case';
import { GetCurrentUserUseCase } from '../../application/get-current-user.use-case';
import { ListProvidersUseCase } from '../../application/list-providers.use-case';
import { ListSessionsUseCase } from '../../application/list-sessions.use-case';
import { LogoutUseCase } from '../../application/logout.use-case';
import { RefreshSessionUseCase } from '../../application/refresh-session.use-case';
import { RevokeSessionUseCase } from '../../application/revoke-session.use-case';
import { StartGithubLoginUseCase } from '../../application/start-github-login.use-case';
import { AUTH_CONFIG, AUTH_PREFIX, AuthConfig } from '../../config';
import { toAuthResponse, toProviderResponse, toSessionResponse, toUserResponse } from './auth.mapper';
import {
  AuthResponseDto,
  CallbackQueryDto,
  ProviderResponseDto,
  RefreshTokenDto,
  SessionResponseDto,
  TokensResponseDto,
  UserResponseDto,
} from './dto/auth.dto';

const STATE_COOKIE = 'oauth_state';
const STATE_COOKIE_PATH = `/${AUTH_PREFIX}/github`;
const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly startLogin: StartGithubLoginUseCase,
    private readonly completeLogin: CompleteGithubLoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly listSessions: ListSessionsUseCase,
    private readonly revokeSession: RevokeSessionUseCase,
    private readonly listProviders: ListProvidersUseCase,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Get('github/login')
  @ApiOperation({ summary: 'Redirect to the provider. Sets a short-lived httpOnly state cookie.' })
  login(@Res() response: Response): void {
    const { authorizeUrl, state } = this.startLogin.execute();
    response.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.cookieSecure,
      maxAge: STATE_COOKIE_MAX_AGE_MS,
      path: STATE_COOKIE_PATH,
    });
    response.redirect(302, authorizeUrl);
  }

  @Get('github/callback')
  @ApiOperation({ summary: 'Provider redirects here. Returns the tokens as JSON.' })
  @ApiOkResponse({ type: AuthResponseDto })
  async callback(
    @Query() query: CallbackQueryDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    // The cookie is single use, even when the login fails.
    response.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });
    const result = await this.completeLogin.execute({
      code: query.code,
      state: query.state,
      expectedState: cookies?.[STATE_COOKIE],
      userAgent: request.header('user-agent') ?? null,
      ip: request.ip ?? null,
    });
    return toAuthResponse(result);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Swap a refresh token for a new access token and a new refresh token' })
  @ApiOkResponse({ type: TokensResponseDto })
  refresh(@Body() body: RefreshTokenDto, @Req() request: Request): Promise<TokensResponseDto> {
    return this.refreshSession.execute({
      refreshToken: body.refreshToken,
      userAgent: request.header('user-agent') ?? null,
      ip: request.ip ?? null,
    });
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the session of this refresh token' })
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.logoutUseCase.execute(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() claims: AccessTokenClaims): Promise<UserResponseDto> {
    return toUserResponse(await this.getCurrentUser.execute(claims.sub));
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: [SessionResponseDto] })
  async sessions(@CurrentUser() claims: AccessTokenClaims): Promise<SessionResponseDto[]> {
    const sessions = await this.listSessions.execute(claims.sub, claims.sid);
    return sessions.map(toSessionResponse);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out one session. Its refresh tokens stop working.' })
  async deleteSession(@CurrentUser() claims: AccessTokenClaims, @Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.revokeSession.execute(claims.sub, id);
  }

  @Get('providers')
  @ApiOkResponse({ type: [ProviderResponseDto] })
  providers(): ProviderResponseDto[] {
    return this.listProviders.execute().map(toProviderResponse);
  }
}
