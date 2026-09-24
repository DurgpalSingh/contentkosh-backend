import { escapeHtml } from '../utils/parserHtml.utils';

const BUSINESS_STATUS_EMAIL_TEXT = {
  SUBJECT_PREFIX: 'Your business account has been ',
  HEADING_PREFIX: 'Your business has been ',
  FALLBACK_VALUE: '—',
  LABEL_INSTITUTE_NAME: 'Institute name',
  LABEL_REASON: 'Reason',
  INTRO_PAUSED: 'Access to your Contentkosh workspace has been paused by an administrator.',
  INTRO_REMOVED: 'Your Contentkosh workspace has been removed by an administrator.',
} as const;

export type BusinessStatusEmailAction = 'paused' | 'removed';

export interface BusinessStatusEmailData {
  instituteName: string;
  action: BusinessStatusEmailAction;
  reason: string | null;
}

function buildRow(label: string, value: string | null): string {
  return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value ?? BUSINESS_STATUS_EMAIL_TEXT.FALLBACK_VALUE)}</li>`;
}

export function buildBusinessStatusEmailSubject(instituteName: string, action: BusinessStatusEmailAction): string {
  return `${BUSINESS_STATUS_EMAIL_TEXT.SUBJECT_PREFIX}${action}: ${instituteName}`;
}

export function buildBusinessStatusEmailHtml(data: BusinessStatusEmailData): string {
  const intro = data.action === 'paused' ? BUSINESS_STATUS_EMAIL_TEXT.INTRO_PAUSED : BUSINESS_STATUS_EMAIL_TEXT.INTRO_REMOVED;

  return [
    `<h2>${escapeHtml(BUSINESS_STATUS_EMAIL_TEXT.HEADING_PREFIX + data.action)}</h2>`,
    `<p>${escapeHtml(intro)}</p>`,
    '<ul>',
    buildRow(BUSINESS_STATUS_EMAIL_TEXT.LABEL_INSTITUTE_NAME, data.instituteName),
    buildRow(BUSINESS_STATUS_EMAIL_TEXT.LABEL_REASON, data.reason),
    '</ul>',
  ].join('');
}
