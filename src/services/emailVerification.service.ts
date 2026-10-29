import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { config } from '../config/config';
import { EMAIL_VERIFICATION } from '../constants/emailVerification.constants';
import * as emailVerificationTokenRepo from '../repositories/emailVerificationToken.repo';
import * as userRepo from '../repositories/user.repo';
import * as businessRepo from '../repositories/business.repo';
import {
  buildEmailVerificationEmailHtml,
  buildEmailVerificationEmailSubject,
  buildVerifyUrl,
} from '../templates/emailVerificationEmail.template';
import logger from '../utils/logger';
import { sendMail } from './mail.service';

export interface VerificationRecipient {
  id: number;
  name: string;
  email: string;
  businessId: number | null;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateRawToken(): string {
  return crypto.randomBytes(EMAIL_VERIFICATION.TOKEN_BYTES).toString('hex');
}

export function findRecordByRawToken(rawToken: string) {
  return emailVerificationTokenRepo.findByTokenHash(hashToken(rawToken));
}

/**
 * Issues a fresh magic link for the user (overwriting any previous one, so older links stop
 * working) and emails it. The token row is written first and its failure propagates; only the
 * mail send is best-effort, so a Gmail outage never fails signup - the caller gets `false`
 * and the user can request a resend.
 */
export async function sendVerificationEmail(
  recipient: VerificationRecipient,
  pendingBusiness?: Prisma.InputJsonValue | null,
): Promise<boolean> {
  const rawToken = generateRawToken();
  await emailVerificationTokenRepo.upsertForUser({
    userId: recipient.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION.LINK_EXPIRY_MS),
    ...(pendingBusiness !== undefined && { pendingBusiness }),
  });

  try {
    // A user without a business is a new institute owner; otherwise a guest joining one.
    const business = recipient.businessId ? await businessRepo.findBusinessById(recipient.businessId) : null;
    const audience = business ? 'guest' : 'admin';

    await sendMail({
      to: recipient.email,
      subject: buildEmailVerificationEmailSubject(audience, business?.instituteName),
      html: buildEmailVerificationEmailHtml({
        name: recipient.name,
        audience,
        instituteName: business?.instituteName ?? null,
        verifyUrl: buildVerifyUrl(config.server.frontendUrl, rawToken),
        privacyUrl: `${config.server.frontendUrl}/privacy-policy`,
      }),
    });
    logger.info('Verification email sent', { userId: recipient.id, audience });
    return true;
  } catch (error) {
    logger.error('Failed to send verification email', { userId: recipient.id, error });
    return false;
  }
}

/**
 * Re-sends the link for every unverified account registered with this email. Never reveals
 * whether the email exists: unknown, already-verified and cooling-down accounts are skipped silently.
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  const unverifiedUsers = await userRepo.findUnverifiedByEmail(email);
  if (unverifiedUsers.length === 0) {
    logger.info('Resend verification skipped: no unverified account', { email });
    return;
  }

  for (const user of unverifiedUsers) {
    const existing = await emailVerificationTokenRepo.findByUserId(user.id);

    if (existing && Date.now() - existing.lastSentAt.getTime() < EMAIL_VERIFICATION.RESEND_COOLDOWN_MS) {
      logger.info('Resend verification skipped: cooldown active', { userId: user.id });
      continue;
    }
    // A new institute owner without a stored signup cannot be verified (nothing to create).
    if (!existing && !user.businessId) {
      logger.warn('Resend verification skipped: owner has no pending signup', { userId: user.id });
      continue;
    }

    await sendVerificationEmail(user);
  }
}
