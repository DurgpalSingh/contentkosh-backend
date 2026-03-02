import { Request, Response } from 'express';
import { config } from '../config/config';

type CookieSameSite = 'lax' | 'strict' | 'none';

const COOKIE_SAME_SITE = {
  LAX: 'lax',
  STRICT: 'strict',
  NONE: 'none',
} as const;

const COOKIE_PATH = '/';

function normalizeSameSite(value: string | undefined): CookieSameSite {
  const normalizedValue = value?.trim().toLowerCase();

  if (
    normalizedValue === COOKIE_SAME_SITE.LAX ||
    normalizedValue === COOKIE_SAME_SITE.STRICT ||
    normalizedValue === COOKIE_SAME_SITE.NONE
  ) {
    return normalizedValue;
  }

  return COOKIE_SAME_SITE.LAX;
}

function getCookieSameSite(): CookieSameSite {
  const sameSite = normalizeSameSite(config.cookies.sameSite);

  if (sameSite === COOKIE_SAME_SITE.NONE && !config.cookies.secure) {
    throw new Error("Invalid cookie configuration: COOKIE_SAME_SITE='none' requires COOKIE_SECURE=true");
  }

  return sameSite;
}

function getBaseCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: getCookieSameSite(),
    path: COOKIE_PATH,
    domain: config.cookies.domain,
    maxAge,
  } as const;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(config.cookies.accessCookieName, accessToken, getBaseCookieOptions(config.cookies.accessCookieMaxAgeMs));
  res.cookie(config.cookies.refreshCookieName, refreshToken, getBaseCookieOptions(config.cookies.refreshCookieMaxAgeMs));
}

export function clearAuthCookies(res: Response): void {
  const clearOptions = {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: getCookieSameSite(),
    path: COOKIE_PATH,
    domain: config.cookies.domain,
  } as const;

  res.clearCookie(config.cookies.accessCookieName, clearOptions);
  res.clearCookie(config.cookies.refreshCookieName, clearOptions);
}

export function getAccessTokenFromRequest(req: Request): string | undefined {
  const cookieValue = req.cookies?.[config.cookies.accessCookieName];
  if (typeof cookieValue === 'string' && cookieValue.length > 0) return cookieValue;
  return undefined;
}

export function getRefreshTokenFromRequest(req: Request): string | undefined {
  const cookieValue = req.cookies?.[config.cookies.refreshCookieName];
  if (typeof cookieValue === 'string' && cookieValue.length > 0) return cookieValue;
  return undefined;
}
