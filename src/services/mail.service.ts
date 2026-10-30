import nodemailer, { Transporter } from 'nodemailer';
import { mailConfig } from '../config/mail.config';
import { MAIL_ERROR_MESSAGES } from '../constants/mail.constants';

export interface SendMailParams {
  to: string | string[];
  subject: string;
  html: string;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  const { host, port, secure, user, password } = mailConfig.smtp;
  if (!host || !user || !password) {
    throw new Error(MAIL_ERROR_MESSAGES.MISSING_SMTP_CONFIG);
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: password },
    });
  }

  return cachedTransporter;
}

/**
 * Sends an email via SMTP (nodemailer).
 * Generic and reusable across features — throws on failure so each caller can
 * decide whether a failed send should be fatal to its own flow.
 */
export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const { name, email } = mailConfig.from;
  if (!email) {
    throw new Error(MAIL_ERROR_MESSAGES.MISSING_SENDER);
  }

  await getTransporter().sendMail({
    from: { name, address: email },
    to,
    subject,
    html,
  });
}
