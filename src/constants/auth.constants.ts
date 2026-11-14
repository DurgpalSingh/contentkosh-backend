export const AUTH_ERROR_MESSAGES = {
  INVALID_INSTITUTE_OR_PASSWORD: 'Invalid institute or password',
  USER_ACCOUNT_INACTIVE: 'User account is inactive',
  INVALID_EMAIL_OR_PASSWORD: 'Invalid email or password',
} as const;

export const AUTH_LOG_MESSAGES = {
  LOGIN_ATTEMPT: 'Login attempt',
  LOGIN_REJECTED_INACTIVE_ACCOUNT: 'Login rejected: account inactive',
  LOGIN_REJECTED_INACTIVE_BUSINESS: 'Login rejected: business not active',
  LOGIN_SUCCESS: 'Login successful',
  LOGIN_REJECTED_INVALID_CREDENTIALS: 'Login rejected: invalid credentials',
  REFRESH_TOKEN_CREATED: 'Refresh token generated for new login session',
} as const;

export const AUTH_TOKEN_CONFIG = {
  REFRESH_TOKEN_RANDOM_BYTES: 64,
  REFRESH_TOKEN_ENCODING: 'hex',
} as const;
