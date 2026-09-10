export const mailConfig = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    senderEmail: process.env.GMAIL_SENDER_EMAIL,
  },
  businessSignupNotificationEmail: process.env.BUSINESS_SIGNUP_NOTIFICATION_EMAIL || 'info@contentkosh.in',
};
