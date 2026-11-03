export const EMAIL_VERIFICATION = {
  TOKEN_BYTES: 32,
  TOKEN_TTL_MS: 2 * 60 * 1000,
  RESEND_COOLDOWN_MS: 60 * 1000,
  VERIFY_PATH: '/verify-email',
  TOKEN_QUERY_PARAM: 'token',
} as const;

export const EMAIL_VERIFICATION_MESSAGES = {
  EMAIL_NOT_VERIFIED: 'Please verify your email first. We have sent you a verification link, check your inbox.',
  LINK_INVALID: 'This verification link is invalid. Please request a new one.',
  LINK_EXPIRED: 'This verification link has expired. Please request a new one.',
  INSTITUTE_DETAILS_REQUIRED: 'Institute details are required to register an institute',
  RESEND_GENERIC: 'If an unverified account exists for this email, a new verification link has been sent.',
  SIGNUP_SUCCESS: 'Registration successful. Please verify your email using the link we sent.',
  VERIFIED: 'Email verified successfully',
} as const;
