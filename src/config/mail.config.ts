export const mailConfig = {
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
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
