import { buildEmailLayout } from './emailLayout.template';
import { EMAIL_VERIFICATION } from '../constants/emailVerification.constants';

const EMAIL_VERIFICATION_TEXT = {
  DOCUMENT_TITLE: 'Verify your email - ContentKosh',
  SUBJECT_PREFIX: 'Verify your email for ',
  HEADING_LINE_1: 'Verify your email',
  HEADING_LINE_2: 'to get started',
  INTRO_PREFIX: 'Thanks for signing up. Click the button below to verify your email and activate your account on ',
  EXPIRY_NOTE_PREFIX: 'This link is valid for ',
  EXPIRY_NOTE_SUFFIX: ' minutes. If it expires, you can request a new one from the verification page.',
  IGNORE_NOTE: 'If you did not create this account, you can safely ignore this email.',
  CTA_LABEL: 'Verify Email',
} as const;

const HERO_BADGE_COLOR = '#356dcc';
const MS_PER_MINUTE = 60 * 1000;

export interface EmailVerificationEmailData {
  name: string;
  instituteName: string;
  verifyUrl: string;
  privacyUrl: string;
}

export function buildVerifyUrl(frontendUrl: string, rawToken: string): string {
  return `${frontendUrl}${EMAIL_VERIFICATION.VERIFY_PATH}?${EMAIL_VERIFICATION.TOKEN_QUERY_PARAM}=${encodeURIComponent(rawToken)}`;
}

export function buildEmailVerificationEmailSubject(instituteName: string): string {
  return `${EMAIL_VERIFICATION_TEXT.SUBJECT_PREFIX}${instituteName}`;
}

export function buildEmailVerificationEmailHtml(data: EmailVerificationEmailData): string {
  const expiryMinutes = Math.round(EMAIL_VERIFICATION.TOKEN_TTL_MS / MS_PER_MINUTE);

  return buildEmailLayout({
    documentTitle: EMAIL_VERIFICATION_TEXT.DOCUMENT_TITLE,
    heroIcon: 'mail',
    heroBadgeIcon: 'check',
    heroBadgeColor: HERO_BADGE_COLOR,
    headingLines: [EMAIL_VERIFICATION_TEXT.HEADING_LINE_1, EMAIL_VERIFICATION_TEXT.HEADING_LINE_2],
    greeting: `Hi ${data.name},`,
    sections: [
      { type: 'paragraph', text: `${EMAIL_VERIFICATION_TEXT.INTRO_PREFIX}${data.instituteName}.` },
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
