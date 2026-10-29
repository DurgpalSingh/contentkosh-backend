import { buildEmailLayout } from './emailLayout.template';
import { EMAIL_VERIFICATION } from '../constants/emailVerification.constants';

const EMAIL_VERIFICATION_TEXT = {
  DOCUMENT_TITLE: 'Verify your email - ContentKosh',
  SUBJECT_ADMIN: 'Verify your email to set up your institute on ContentKosh',
  SUBJECT_GUEST_PREFIX: 'Verify your email to join ',
  HEADING_LINE_1: 'Verify your email',
  HEADING_LINE_2: 'to get started',
  GREETING_PREFIX: 'Hi ',
  GREETING_FALLBACK: 'Hi there,',
  INTRO_ADMIN: 'Thanks for signing up on ContentKosh. Click the button below to verify your email. We will then set up your institute and log you in.',
  INTRO_GUEST_PREFIX: 'Thanks for signing up. Click the button below to verify your email and activate your account on ',
  EXPIRY_NOTE_PREFIX: 'This link is valid for ',
  EXPIRY_NOTE_SUFFIX: ' minutes. If it expires, you can request a new one from the verification page.',
  IGNORE_NOTE: 'If you did not create this account, you can safely ignore this email.',
  CTA_LABEL: 'Verify Email',
} as const;

const HERO_BADGE_COLOR = '#356dcc';
const MS_PER_MINUTE = 60 * 1000;

export type EmailVerificationAudience = 'admin' | 'guest';

export interface EmailVerificationEmailData {
  name: string;
  audience: EmailVerificationAudience;
  /** Institute the guest is joining; unused for admin signups (the business does not exist yet). */
  instituteName?: string | null;
  verifyUrl: string;
  privacyUrl: string;
}

export function buildVerifyUrl(frontendUrl: string, rawToken: string): string {
  return `${frontendUrl}${EMAIL_VERIFICATION.VERIFY_PATH}?${EMAIL_VERIFICATION.TOKEN_QUERY_PARAM}=${encodeURIComponent(rawToken)}`;
}

export function buildEmailVerificationEmailSubject(audience: EmailVerificationAudience, instituteName?: string | null): string {
  return audience === 'guest' && instituteName
    ? `${EMAIL_VERIFICATION_TEXT.SUBJECT_GUEST_PREFIX}${instituteName}`
    : EMAIL_VERIFICATION_TEXT.SUBJECT_ADMIN;
}

export function buildEmailVerificationEmailHtml(data: EmailVerificationEmailData): string {
  const greeting = data.name?.trim()
    ? `${EMAIL_VERIFICATION_TEXT.GREETING_PREFIX}${data.name.trim()},`
    : EMAIL_VERIFICATION_TEXT.GREETING_FALLBACK;
  const intro =
    data.audience === 'guest' && data.instituteName
      ? `${EMAIL_VERIFICATION_TEXT.INTRO_GUEST_PREFIX}${data.instituteName}.`
      : EMAIL_VERIFICATION_TEXT.INTRO_ADMIN;
  const expiryMinutes = Math.round(EMAIL_VERIFICATION.LINK_EXPIRY_MS / MS_PER_MINUTE);

  return buildEmailLayout({
    documentTitle: EMAIL_VERIFICATION_TEXT.DOCUMENT_TITLE,
    heroIcon: 'mail',
    heroBadgeIcon: 'check',
    heroBadgeColor: HERO_BADGE_COLOR,
    headingLines: [EMAIL_VERIFICATION_TEXT.HEADING_LINE_1, EMAIL_VERIFICATION_TEXT.HEADING_LINE_2],
    greeting,
    sections: [
      { type: 'paragraph', text: intro },
      { type: 'cta', cta: { label: EMAIL_VERIFICATION_TEXT.CTA_LABEL, url: data.verifyUrl } },
      {
        type: 'paragraph',
        text: `${EMAIL_VERIFICATION_TEXT.EXPIRY_NOTE_PREFIX}${expiryMinutes}${EMAIL_VERIFICATION_TEXT.EXPIRY_NOTE_SUFFIX}`,
      },
      { type: 'paragraph', text: EMAIL_VERIFICATION_TEXT.IGNORE_NOTE },
    ],
    privacyUrl: data.privacyUrl,
  });
}
