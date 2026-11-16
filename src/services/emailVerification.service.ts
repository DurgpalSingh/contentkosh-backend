import crypto from 'crypto';
import { config } from '../config/config';
import { EMAIL_VERIFICATION } from '../constants/emailVerification.constants';
import * as emailVerificationTokenRepo from '../repositories/emailVerificationToken.repo';
import {
  buildEmailVerificationEmailHtml,
  buildEmailVerificationEmailSubject,
  buildVerifyUrl,
} from '../templates/emailVerificationEmail.template';
import logger from '../utils/logger';
import { sendMail } from './mail.service';

export interface VerificationUser {
  id: number;
  name: string;
  email: string;
}

export interface VerificationBusiness {
  id: number;
  instituteName: string;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function findVerificationByRawToken(rawToken: string) {
  return emailVerificationTokenRepo.findByTokenHash(hashToken(rawToken));
}

function isResendCoolingDown(expiresAt: Date): boolean {
  const sentAt = expiresAt.getTime() - EMAIL_VERIFICATION.TOKEN_TTL_MS;
  return Date.now() - sentAt < EMAIL_VERIFICATION.RESEND_COOLDOWN_MS;
}

/**
 * Issues a fresh verification link (replacing any previous one) and emails it. Saving the token
 * is required and its failure propagates; only the mail send is best-effort, so a mail outage
 * never fails signup - the caller gets `false` and the user can request a resend.
 */
export async function sendVerificationEmail(user: VerificationUser, business: VerificationBusiness): Promise<boolean> {
  const rawToken = crypto.randomBytes(EMAIL_VERIFICATION.TOKEN_BYTES).toString('hex');
  await emailVerificationTokenRepo.upsertForUser(user.id, {
    businessId: business.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION.TOKEN_TTL_MS),
  });

  try {
    await sendMail({
      to: user.email,
      subject: buildEmailVerificationEmailSubject(business.instituteName),
      html: buildEmailVerificationEmailHtml({
        name: user.name,
        instituteName: business.instituteName,
        verifyUrl: buildVerifyUrl(config.server.frontendUrl, rawToken),
        privacyUrl: `${config.server.frontendUrl}/privacy-policy`,
      }),
    });
    logger.info('Verification email sent', { userId: user.id });
    return true;
  } catch (error) {
    logger.error('Failed to send verification email', { userId: user.id, error });
    return false;
  }
}

/**
 * Re-sends the link for every unverified account registered with this email. Never reveals
 * whether the email exists: unknown, already-verified and cooling-down accounts are skipped silently.
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  const pendingVerifications = await emailVerificationTokenRepo.findUnverifiedByEmail(email);

  for (const { expiresAt, business, user } of pendingVerifications) {
    if (isResendCoolingDown(expiresAt)) {
      logger.info('Resend verification skipped: cooldown active', { userId: user.id });
      continue;
    }
    await sendVerificationEmail(user, business);
  }
}
