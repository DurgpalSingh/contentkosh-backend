import { escapeHtml } from '../utils/parserHtml.utils';

const BUSINESS_SIGNUP_EMAIL_TEXT = {
  SUBJECT_PREFIX: 'New business signup: ',
  HEADING: 'New business signup on Contentkosh',
  FALLBACK_VALUE: '—',
  LABEL_INSTITUTE_NAME: 'Institute name',
  LABEL_SLUG: 'Slug',
  LABEL_BUSINESS_EMAIL: 'Contact email',
  LABEL_ADMIN_NAME: 'Admin name',
  LABEL_ADMIN_EMAIL: 'Admin email',
} as const;

export interface BusinessSignupEmailData {
  instituteName: string;
  slug: string | null;
  businessEmail: string | null;
  adminName: string;
  adminEmail: string;
}

function buildRow(label: string, value: string | null): string {
  return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value ?? BUSINESS_SIGNUP_EMAIL_TEXT.FALLBACK_VALUE)}</li>`;
}

export function buildBusinessSignupEmailSubject(instituteName: string): string {
  return `${BUSINESS_SIGNUP_EMAIL_TEXT.SUBJECT_PREFIX}${instituteName}`;
}

export function buildBusinessSignupEmailHtml(data: BusinessSignupEmailData): string {
  return [
    `<h2>${BUSINESS_SIGNUP_EMAIL_TEXT.HEADING}</h2>`,
    '<ul>',
    buildRow(BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_INSTITUTE_NAME, data.instituteName),
    buildRow(BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_SLUG, data.slug),
    buildRow(BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_BUSINESS_EMAIL, data.businessEmail),
    buildRow(BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_ADMIN_NAME, data.adminName),
    buildRow(BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_ADMIN_EMAIL, data.adminEmail),
    '</ul>',
  ].join('');
}
