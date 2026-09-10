import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ChangePasswordInputSchema,
  ForgotPasswordInputSchema,
  PasswordLoginInputSchema,
  ResetPasswordInputSchema,
} from '@ponto-dcit/shared-types';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth-guard';
import type { AuthenticatedUser } from './authenticated-user';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 8 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  async login(
    @Query('origin') origin: string,
    @Query('redirectUri') redirectUri: string | undefined,
    @Res() res: Response,
  ) {
    const safeOrigin = origin === 'mobile' ? 'mobile' : 'web';
    const url = await this.authService.buildAuthorizationUrl(
      safeOrigin,
      safeOrigin === 'mobile' ? redirectUri : undefined,
    );
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const { sessionToken, origin, mobileRedirectUri } =
      await this.authService.handleCallback(
        process.env.OIDC_REDIRECT_URI as string,
        req.query as Record<string, string>,
      );

    if (origin === 'mobile') {
      // expo-web-browser's openAuthSessionAsync needs a redirect back to the
      // exact redirect URI it was given to close the in-app browser and hand
      // control back to JS. In Expo Go that's an exp:// URL computed by
      // expo-auth-session's makeRedirectUri (Expo Go doesn't own a custom
      // URL scheme like a standalone/dev-client build would), so the app
      // sends it up front on /auth/login and we hand it back here rather
      // than hardcoding one scheme that would only work in a real build.
      if (!mobileRedirectUri) {
        throw new BadRequestException('Missing mobile redirect URI');
      }
      const separator = mobileRedirectUri.includes('?') ? '&' : '?';
      res.redirect(
        `${mobileRedirectUri}${separator}token=${encodeURIComponent(sessionToken)}`,
      );
      return;
    }

    res.cookie('ponto_session', sessionToken, SESSION_COOKIE_OPTIONS);
    res.redirect(process.env.WEB_APP_URL ?? 'http://localhost:3001');
  }

  // Same JWT shape (`{sub, role, name}`) as the SSO callback above — nothing
  // downstream (AuthGuard, client-side decode) needs to know which login
  // path produced the token. One endpoint serves both platforms: web sets
  // the session cookie here (a fetch from a Server Action can't rely on a
  // top-level redirect the way SSO's browser-navigation flow does), mobile
  // reads `token` from the body and stores it itself.
  @Post('password-login')
  @HttpCode(200)
  async passwordLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = PasswordLoginInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    const { email, password, origin } = result.data;
    const { sessionToken, role, name } = await this.authService.loginWithPassword(
      email,
      password,
    );

    if (origin === 'web') {
      res.cookie('ponto_session', sessionToken, SESSION_COOKIE_OPTIONS);
    }
    return { token: sessionToken, role, name };
  }

  // Always 200, even for an unknown email/phone — revealing which
  // identifiers have an account would let an attacker enumerate real users.
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: unknown) {
    const result = ForgotPasswordInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.authService.requestPasswordReset(result.data.identifier);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: unknown) {
    const result = ResetPasswordInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    await this.authService.resetPassword(
      result.data.identifier,
      result.data.code,
      result.data.newPassword,
    );
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const result = ChangePasswordInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    await this.authService.changePassword(
      req.user.sub,
      result.data.currentPassword,
      result.data.newPassword,
    );
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('ponto_session');
  }
}
