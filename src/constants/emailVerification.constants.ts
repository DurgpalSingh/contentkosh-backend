export const EMAIL_VERIFICATION = {
  TOKEN_BYTES: 32,
  LINK_EXPIRY_MS: 2 * 60 * 1000,
  RESEND_COOLDOWN_MS: 60 * 1000,
  VERIFY_PATH: '/verify-email',
  TOKEN_QUERY_PARAM: 'token',
} as const;

export const EMAIL_VERIFICATION_MESSAGES = {
  EMAIL_NOT_VERIFIED: 'Please verify your email first. We have sent you a verification link, check your inbox.',
  LINK_INVALID: 'This verification link is invalid. Please request a new one.',
  LINK_EXPIRED: 'This verification link has expired. Please request a new one.',
  BUSINESS_DETAILS_REQUIRED: 'Business details are required to register an institute',
  BUSINESS_CREATION_FAILED: 'We could not set up your institute. Please sign up again with a different institute name or slug.',
  RESEND_GENERIC: 'If an unverified account exists for this email, a new verification link has been sent.',
  SIGNUP_SUCCESS: 'Registration successful. Please verify your email using the link we sent.',
  VERIFIED: 'Email verified successfully',
} as const;
