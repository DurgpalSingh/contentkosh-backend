import { BusinessProvisioningStatus, BusinessStatus, UserRole } from '@prisma/client';
import * as businessRepo from '../repositories/business.repo';
import { BadRequestError, NotFoundError } from '../errors/api.errors';
import { AuthService } from './auth.service';

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

    return businessRepo.updateBusinessStatus(id, {
      status,
      statusReason: status === BusinessStatus.ACTIVE ? null : reason!.trim(),
      statusChangedBy: actorId,
    });
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
      '60m'
    );

    return { accessToken, business };
  }
}
