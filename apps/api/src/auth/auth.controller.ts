import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AllowDuringMfaEnrolment, AllowDuringPasswordChange, CurrentUser, Public } from '../common/decorators';
import { AppConfigService } from '../config/app-config.service';
import { AuthService } from './auth.service';
import { AuthUser, RequestMeta } from './auth.types';
import {
  clearAuthCookies,
  clearEntraStateCookie,
  ENTRA_STATE_COOKIE,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
  setEntraStateCookie,
} from './cookies';
import { ChangePasswordDto, EntraStartQueryDto, LoginDto, MfaCodeDto, MfaVerifyDto } from './dto/auth.dto';
import { EntraService } from './entra.service';
import { toPublicUser } from './user-access.service';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

function meta(req: Request): RequestMeta {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) || req.ip || null;
  return { ip, userAgent: req.headers['user-agent'] ?? null };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly entra: EntraService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Local login with email and password' })
  @ApiResponse({ status: 200, description: '`{ user }` with cookies, or `{ mfaRequired: true, mfaToken }`' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, meta(req));
    if (result.kind === 'mfa') return { mfaRequired: true, mfaToken: result.mfaToken };
    setAuthCookies(res, this.config, result.tokens);
    return { user: toPublicUser(result.user) };
  }

  @Public()
  @Throttle(STRICT)
  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete login with a TOTP or recovery code' })
  async mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyMfa(dto.mfaToken, dto.code, meta(req));
    setAuthCookies(res, this.config, result.tokens);
    return { user: toPublicUser(result.user) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.refresh(readCookie(req, REFRESH_COOKIE), meta(req));
      setAuthCookies(res, this.config, result.tokens);
      return { user: toPublicUser(result.user) };
    } catch (err) {
      clearAuthCookies(res, this.config);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the session and clear cookies' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user?: AuthUser) {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE), user);
    clearAuthCookies(res, this.config);
  }

  @Get('me')
  @AllowDuringPasswordChange()
  @AllowDuringMfaEnrolment()
  @ApiCookieAuth('as_access')
  @ApiOperation({ summary: 'Current user with roles and permissions' })
  async me(@CurrentUser() user: AuthUser) {
    const fresh = await this.auth.me(user.id);
    return { user: toPublicUser(fresh) };
  }

  @Post('mfa/setup')
  @AllowDuringMfaEnrolment()
  @ApiCookieAuth('as_access')
  @ApiOperation({ summary: 'Generate a TOTP secret (stored encrypted, not yet enabled)' })
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.auth.mfaSetup(user.id);
  }

  @Post('mfa/enable')
  @AllowDuringMfaEnrolment()
  @ApiCookieAuth('as_access')
  @ApiOperation({ summary: 'Confirm the TOTP secret and receive recovery codes' })
  mfaEnable(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.auth.mfaEnable(user.id, dto.code);
  }

  @Post('mfa/disable')
  @HttpCode(204)
  @ApiCookieAuth('as_access')
  @ApiOperation({ summary: 'Disable MFA (requires a valid code)' })
  async mfaDisable(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    await this.auth.mfaDisable(user.id, dto.code);
  }

  @Post('password/change')
  @AllowDuringPasswordChange()
  @AllowDuringMfaEnrolment()
  @HttpCode(204)
  @ApiCookieAuth('as_access')
  @ApiOperation({ summary: 'Change the local password; other sessions are revoked' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, readCookie(req, REFRESH_COOKIE));
  }

  @Public()
  @Get('entra/start')
  @ApiOperation({ summary: 'Redirect to Microsoft Entra ID (authorization code + PKCE)' })
  @ApiResponse({ status: 302 })
  @ApiResponse({ status: 503, description: 'Entra ID is not configured' })
  async entraStart(@Query() query: EntraStartQueryDto, @Res() res: Response) {
    const { url, stateCookie } = await this.entra.start(query.returnTo);
    setEntraStateCookie(res, this.config, stateCookie);
    res.redirect(302, url);
  }

  @Public()
  @Get('entra/callback')
  @ApiOperation({ summary: 'Entra ID redirect target; sets cookies and redirects to the web app' })
  @ApiResponse({ status: 302 })
  async entraCallback(@Req() req: Request, @Res() res: Response) {
    const currentUrl = `${this.config.api.baseUrl}${req.originalUrl}`;
    const result = await this.entra.callback(currentUrl, readCookie(req, ENTRA_STATE_COOKIE), meta(req));
    clearEntraStateCookie(res, this.config);
    setAuthCookies(res, this.config, result.tokens);
    res.redirect(302, `${this.config.api.webBaseUrl}${result.returnTo}`);
  }
}
