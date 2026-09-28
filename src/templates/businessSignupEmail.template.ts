import { buildEmailLayout, EmailInfoRow } from './emailLayout.template';

const BUSINESS_SIGNUP_EMAIL_TEXT = {
  DOCUMENT_TITLE: 'New Business Registered - ContentKosh',
  SUBJECT_PREFIX: 'New business registered: ',
  HEADING_LINE_1: 'New business registered',
  HEADING_LINE_2: 'on ContentKosh',
  GREETING: 'Hi Team,',
  INTRO: 'A new business has been successfully registered on the ContentKosh platform. Here are the details of the newly registered business:',
  LABEL_BUSINESS: 'Business',
  LABEL_SLUG: 'Slug',
  LABEL_ADMIN_NAME: 'Admin Name',
  LABEL_ADMIN_EMAIL: 'Admin Email',
  LABEL_REGISTERED_ON: 'Registered On',
  CTA_LABEL: 'View Business',
} as const;

const HERO_BADGE_COLOR = '#356dcc';

export interface BusinessSignupEmailData {
  instituteName: string;
  slug: string | null;
  adminName: string;
  adminEmail: string;
  registeredOn: Date;
  dashboardUrl: string;
  privacyUrl: string;
}

export function buildBusinessSignupEmailSubject(instituteName: string): string {
  return `${BUSINESS_SIGNUP_EMAIL_TEXT.SUBJECT_PREFIX}${instituteName}`;
}

export function buildBusinessSignupEmailHtml(data: BusinessSignupEmailData): string {
  const rows: EmailInfoRow[] = [
    { icon: 'building', label: BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_BUSINESS, value: data.instituteName },
    { icon: 'link', label: BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_SLUG, value: data.slug },
    { icon: 'person', label: BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_ADMIN_NAME, value: data.adminName },
    { icon: 'mail', label: BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_ADMIN_EMAIL, value: data.adminEmail },
    {
      icon: 'calendar',
      label: BUSINESS_SIGNUP_EMAIL_TEXT.LABEL_REGISTERED_ON,
      value: data.registeredOn.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  return buildEmailLayout({
    documentTitle: BUSINESS_SIGNUP_EMAIL_TEXT.DOCUMENT_TITLE,
    heroIcon: 'building',
    heroBadgeIcon: 'check',
    heroBadgeColor: HERO_BADGE_COLOR,
    headingLines: [BUSINESS_SIGNUP_EMAIL_TEXT.HEADING_LINE_1, BUSINESS_SIGNUP_EMAIL_TEXT.HEADING_LINE_2],
    greeting: BUSINESS_SIGNUP_EMAIL_TEXT.GREETING,
    sections: [
      { type: 'paragraph', text: BUSINESS_SIGNUP_EMAIL_TEXT.INTRO },
      { type: 'card', rows },
      { type: 'cta', cta: { label: BUSINESS_SIGNUP_EMAIL_TEXT.CTA_LABEL, url: data.dashboardUrl } },
    ],
    privacyUrl: data.privacyUrl,
  });
}
