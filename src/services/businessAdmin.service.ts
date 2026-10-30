import { Business, BusinessProvisioningStatus, BusinessStatus, UserRole } from '@prisma/client';
import * as businessRepo from '../repositories/business.repo';
import * as userRepo from '../repositories/user.repo';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { AuthService } from './auth.service';
import { config } from '../config/config';
import logger from '../utils/logger';
import { sendMail } from './mail.service';
import { buildBusinessStatusEmailHtml, buildBusinessStatusEmailSubject, BusinessStatusEmailAction } from '../templates/businessStatusEmail.template';
import { BUSINESS_STATUS_ACTION } from '../constants/business.constants';

async function notifyBusinessStatusChange(business: Business, action: BusinessStatusEmailAction): Promise<void> {
  try {
    const admins = await userRepo.findByBusinessId(business.id, UserRole.ADMIN);
    const recipients = admins.map((admin) => admin.user.email);

    if (recipients.length === 0) {
      logger.warn('No admin email found to notify about business status change', { businessId: business.id, action });
      return;
    }

    await sendMail({
      to: recipients,
      subject: buildBusinessStatusEmailSubject(business.instituteName, action),
      html: buildBusinessStatusEmailHtml({
        instituteName: business.instituteName,
        action,
        reason: business.statusReason,
        privacyUrl: `${config.server.frontendUrl}/privacy-policy`,
      }),
    });
  } catch (error) {
    logger.error('Failed to send business status change notification email', { businessId: business.id, action, error });
  }
}

export interface ListBusinessesQuery {
  page?: number | undefined;
  limit?: number | undefined;
  status?: BusinessStatus | undefined;
  search?: string | undefined;
}

export class BusinessAdminService {
  static async listBusinesses(query: ListBusinessesQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;

    const { items, total } = await businessRepo.listBusinessesForSuperAdmin({
      skip: (page - 1) * limit,
      take: limit,
      status: query.status,
      search: query.search,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  static async getBusinessDetail(id: number) {
    const business = await businessRepo.findBusinessById(id);
    if (!business) {
      throw new NotFoundError('Business');
    }
    return business;
  }

  static async updateStatus(id: number, actorId: number, status: BusinessStatus, reason?: string) {
    const business = await businessRepo.findBusinessById(id);
    if (!business) {
      throw new NotFoundError('Business');
    }

    if (status !== BusinessStatus.ACTIVE && !reason?.trim()) {
      throw new BadRequestError('A reason is required to pause or delete a business');
    }

    const updated = await businessRepo.updateBusinessStatus(id, {
      status,
      statusReason: status === BusinessStatus.ACTIVE ? null : reason!.trim(),
      statusChangedBy: actorId,
    });

    if (status === BusinessStatus.PAUSED || status === BusinessStatus.DELETED) {
      void notifyBusinessStatusChange(updated, BUSINESS_STATUS_ACTION[status === BusinessStatus.PAUSED ? 'PAUSED' : 'REMOVED']);
    }

    return updated;
  }

  static async impersonate(businessId: number, actor: { id: number; email: string }) {
    const business = await businessRepo.findBusinessById(businessId);
    if (!business) {
      throw new NotFoundError('Business');
    }

    if (business.status !== BusinessStatus.ACTIVE || business.provisioningStatus !== BusinessProvisioningStatus.ACTIVE) {
      throw new BadRequestError('Cannot open a business that is not active');
    }

    const accessToken = AuthService.generateAccessToken(
      {
        id: actor.id,
        email: actor.email,
        role: UserRole.ADMIN,
        businessId: business.id,
        businessSlug: business.slug,
        tenantSchema: business.schemaName,
      },
      config.cookies.workspaceExpiryTime,
    );

    return { accessToken, business };
  }
}
