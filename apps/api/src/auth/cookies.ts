import type { CookieOptions, Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { IssuedTokens } from './auth.types';

export const ACCESS_COOKIE = 'as_access';
export const REFRESH_COOKIE = 'as_refresh';
export const ENTRA_STATE_COOKIE = 'as_entra';

function base(config: AppConfigService): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: config.cookies.secure, path: '/' };
}

export function setAuthCookies(res: Response, config: AppConfigService, tokens: IssuedTokens) {
  res.cookie(ACCESS_COOKIE, tokens.access, { ...base(config), maxAge: config.jwt.accessTtlMs });
  res.cookie(REFRESH_COOKIE, tokens.refresh, { ...base(config), maxAge: config.jwt.refreshTtlMs });
}

export function clearAuthCookies(res: Response, config: AppConfigService) {
  res.clearCookie(ACCESS_COOKIE, base(config));
  res.clearCookie(REFRESH_COOKIE, base(config));
}

export function setEntraStateCookie(res: Response, config: AppConfigService, value: string) {
  res.cookie(ENTRA_STATE_COOKIE, value, { ...base(config), maxAge: 10 * 60 * 1000 });
}

export function clearEntraStateCookie(res: Response, config: AppConfigService) {
  res.clearCookie(ENTRA_STATE_COOKIE, base(config));
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Access token from the cookie, falling back to `Authorization: Bearer` for API clients. */
export function extractAccessToken(req: Request): string | undefined {
  const fromCookie = readCookie(req, ACCESS_COOKIE);
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header && /^bearer\s+/i.test(header)) return header.replace(/^bearer\s+/i, '').trim();
  return undefined;
}
