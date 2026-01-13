export const config = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key',
    // Legacy - kept for backward compatibility during migration
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  server: {
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'development',
  }
};
