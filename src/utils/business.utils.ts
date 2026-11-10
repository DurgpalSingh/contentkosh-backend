import { Business } from '@prisma/client';
import { config } from '../config/config';
import { mailConfig } from '../config/mail.config';
import { BusinessCreateInput } from '../repositories/business.repo';
import { CreateBusinessDto } from '../dtos/business.dto';
import { sendMail } from '../services/mail.service';
import { buildBusinessSignupEmailHtml, buildBusinessSignupEmailSubject } from '../templates/businessSignupEmail.template';
import logger from './logger';

/** Maps the public CreateBusinessDto fields to the DB column names used when creating a business. */
export function toBusinessCreateInput(dto: CreateBusinessDto): BusinessCreateInput {
  const { instituteName, slug, logo_url, phone, email, ...otherData } = dto;
  return {
    instituteName,
    slug,
    logo: logo_url ?? null,
    contactNumber: phone ?? null,
    email: email ?? null,
    ...otherData,
  };
}

/** Tells the platform team a new business signed up. Never throws: a failed email must not fail signup. */
export async function sendBusinessSignupNotification(business: Business, admin: { name: string; email: string }): Promise<void> {
  try {
    await sendMail({
      to: mailConfig.businessSignupNotificationEmail,
      cc: mailConfig.businessSignupNotificationCc,
      bcc: mailConfig.businessSignupNotificationBcc,
      subject: buildBusinessSignupEmailSubject(business.instituteName),
      html: buildBusinessSignupEmailHtml({
        instituteName: business.instituteName,
        slug: business.slug,
        adminName: admin.name,
        adminEmail: admin.email,
        registeredOn: business.provisionedAt ?? new Date(),
        dashboardUrl: `${config.server.frontendUrl}/superadmin/businesses`,
        privacyUrl: `${config.server.frontendUrl}/privacy-policy`,
      }),
    });
    logger.info('Business signup notification sent', { businessId: business.id });
  } catch (error) {
    logger.error('Failed to send business signup notification email', { businessId: business.id, error });
  }
}
