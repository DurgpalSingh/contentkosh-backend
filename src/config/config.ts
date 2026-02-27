export const config = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ? parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN) : '7d',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key',
    // Legacy - kept for backward compatibility during migration
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  server: {
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  cookies: {
    accessCookieName: process.env.ACCESS_COOKIE_NAME || 'ck_access_token',
    refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'ck_refresh_token',
    domain: process.env.COOKIE_DOMAIN || undefined,
    accessCookieMaxAgeMs: process.env.ACCESS_COOKIE_MAX_AGE_MS ? parseInt(process.env.ACCESS_COOKIE_MAX_AGE_MS) : 16 * 60 * 1000,
    refreshCookieMaxAgeMs: process.env.REFRESH_COOKIE_MAX_AGE_MS ? parseInt(process.env.REFRESH_COOKIE_MAX_AGE_MS) : 7 * 24 * 60 * 60 * 1000,
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase(),
  },
};
