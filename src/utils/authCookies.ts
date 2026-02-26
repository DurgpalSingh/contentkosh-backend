import { Request, Response } from 'express';
import { config } from '../config/config';

type CookieSameSite = 'lax' | 'strict' | 'none';

function getCookieSameSite(): CookieSameSite {
  const sameSite = config.cookies.sameSite;
  if (sameSite === 'strict' || sameSite === 'none') return sameSite;
  return 'lax';
}

function getBaseCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: getCookieSameSite(),
    path: '/',
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
    path: '/',
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
