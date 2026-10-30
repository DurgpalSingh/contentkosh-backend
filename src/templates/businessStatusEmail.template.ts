import { buildEmailLayout, EmailIconName, EmailInfoRow } from './emailLayout.template';
import { mailConfig } from '../config/mail.config';

const BUSINESS_STATUS_EMAIL_TEXT = {
  DOCUMENT_TITLE: 'Business Account Update - ContentKosh',
  SUBJECT_PREFIX: 'Your business account has been ',
  HEADING_PREFIX: 'Your business has been ',
  GREETING: 'Hi there,',
  LABEL_REASON: 'Reason',
  CONTACT_INTRO: 'If you have any questions or believe this is a mistake, please contact our administration team:',
  LABEL_SUPPORT_EMAIL: 'Email',
  LABEL_SUPPORT_PHONE: 'Phone',
} as const;

function buildIntro(instituteName: string, action: BusinessStatusEmailAction): string {
  return action === 'paused'
    ? `Access to "${instituteName}"'s ContentKosh workspace has been paused by our administration team.`
    : `"${instituteName}"'s ContentKosh workspace has been removed by our administration team.`;
}

const HERO_BADGE: Record<BusinessStatusEmailAction, { icon: EmailIconName; color: string }> = {
  paused: { icon: 'pause', color: '#d97706' },
  removed: { icon: 'cross', color: '#dc2626' },
};

export type BusinessStatusEmailAction = 'paused' | 'removed';

export interface BusinessStatusEmailData {
  instituteName: string;
  action: BusinessStatusEmailAction;
  reason: string | null;
  privacyUrl: string;
}

export function buildBusinessStatusEmailSubject(instituteName: string, action: BusinessStatusEmailAction): string {
  return `${BUSINESS_STATUS_EMAIL_TEXT.SUBJECT_PREFIX}${action}: ${instituteName}`;
}

export function buildBusinessStatusEmailHtml(data: BusinessStatusEmailData): string {
  const badge = HERO_BADGE[data.action];

  const reasonRow: EmailInfoRow[] = [{ icon: 'document', label: BUSINESS_STATUS_EMAIL_TEXT.LABEL_REASON, value: data.reason }];

  const contactRows: EmailInfoRow[] = [
    { icon: 'mail', label: BUSINESS_STATUS_EMAIL_TEXT.LABEL_SUPPORT_EMAIL, value: mailConfig.contact.supportEmail },
    ...(mailConfig.contact.supportPhone
      ? [{ icon: 'phone' as const, label: BUSINESS_STATUS_EMAIL_TEXT.LABEL_SUPPORT_PHONE, value: mailConfig.contact.supportPhone }]
      : []),
  ];

  return buildEmailLayout({
    documentTitle: BUSINESS_STATUS_EMAIL_TEXT.DOCUMENT_TITLE,
    heroIcon: 'building',
    heroBadgeIcon: badge.icon,
    heroBadgeColor: badge.color,
    headingLines: [`${BUSINESS_STATUS_EMAIL_TEXT.HEADING_PREFIX}${data.action}`],
    greeting: BUSINESS_STATUS_EMAIL_TEXT.GREETING,
    sections: [
      { type: 'paragraph', text: buildIntro(data.instituteName, data.action) },
      { type: 'card', rows: reasonRow },
      { type: 'paragraph', text: BUSINESS_STATUS_EMAIL_TEXT.CONTACT_INTRO },
      { type: 'card', rows: contactRows },
    ],
    privacyUrl: data.privacyUrl,
  });
}
