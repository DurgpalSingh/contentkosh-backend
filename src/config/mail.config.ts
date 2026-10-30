import { readSecretFromFile } from '../utils/secretFile';

const SMTP_PASSWORD_KEY = 'SMTP_PASSWORD';

// SMTP_PASSWORD holds the path to a JSON secrets file kept outside the project, not the password itself.
function resolveSmtpPassword(): string | undefined {
  const passwordFile = process.env.SMTP_PASSWORD;
  return passwordFile ? readSecretFromFile(passwordFile, SMTP_PASSWORD_KEY) : undefined;
}

export const mailConfig = {
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true,
    user: process.env.SMTP_USER,
    password: resolveSmtpPassword(),
  },
  from: {
    name: process.env.MAIL_FROM_NAME || 'ContentKosh',
    email: process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER,
  },
  businessSignupNotificationEmail: process.env.BUSINESS_SIGNUP_NOTIFICATION_EMAIL || 'info@contentkosh.in',

  contact: {
    supportEmail: 'info@contentkosh.in' as string,
    supportPhone: '9351274467' as string | null,
  },
};
