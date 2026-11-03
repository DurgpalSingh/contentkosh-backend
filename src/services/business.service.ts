import { Business, UserRole, UserStatus, BusinessProvisioningStatus } from '@prisma/client';
import * as businessRepo from '../repositories/business.repo';
import * as userRepo from '../repositories/user.repo';
import * as refreshTokenRepo from '../repositories/refreshToken.repo';
import { AlreadyExistsError, BadRequestError, NotFoundError } from '../errors/api.errors';
import logger from '../utils/logger';
import { sendBusinessSignupNotification } from '../utils/business.utils';
import {
  ensureTenantSchema,
  migrateTenantSchema,
  normalizeTenantSchemaName,
  renameTenantSchema,
  dropTenantSchema,
  seedTenantDefaults,
} from './tenantProvisioning.service';

export class BusinessService {
  /**
   * Reserves the slug by saving the business as PENDING. The tenant schema is built later by
   * provisionPendingBusiness, so nothing heavy happens for signups that are never verified.
   */
  static async createPendingBusiness(data: businessRepo.BusinessCreateInput) {
    if (!data.slug) {
      throw new BadRequestError('Slug is required');
    }
    const slug = data.slug.trim();

    if (await businessRepo.findBusinessBySlug(slug)) {
      logger.warn('Business creation rejected: slug already exists', { slug });
      throw new AlreadyExistsError(`Business with slug '${slug}' already exists`);
    }

    const pendingBusiness = await businessRepo.createBusiness({
      ...data,
      slug,
      schemaName: normalizeTenantSchemaName(slug),
      provisioningStatus: BusinessProvisioningStatus.PENDING,
      isDeleted: false,
    });
    logger.info('Pending business created', { businessId: pendingBusiness.id, slug });

    return pendingBusiness;
  }

  /** Creates a business and provisions it right away for `adminUserId` (used by POST /api/business). */
  static async createBusiness(data: businessRepo.BusinessCreateInput, adminUserId: number) {
    const pendingBusiness = await this.createPendingBusiness(data);

    try {
      return await this.provisionPendingBusiness(pendingBusiness, adminUserId);
    } catch (error) {
      await this.discardFailedBusiness(pendingBusiness);
      throw error;
    }
  }

  /**
   * Turns a pending business into a working one: builds its tenant schema, makes `adminUserId`
   * its admin and marks it ACTIVE. On failure the partial schema is dropped and the business stays
   * pending, so the caller decides whether to retry or discard it.
   */
  static async provisionPendingBusiness(pendingBusiness: Business, adminUserId: number) {
    const { schemaName } = pendingBusiness;
    if (!schemaName) {
      throw new BadRequestError('Business has no tenant schema name');
    }
    logger.info('Provisioning business', { businessId: pendingBusiness.id, schemaName, adminUserId });

    try {
      await this.buildTenantSchema(schemaName);
      const activeBusiness = await this.activateBusinessForAdmin(pendingBusiness, adminUserId);
      logger.info('Business provisioned', { businessId: activeBusiness.id, schemaName });
      return activeBusiness;
    } catch (error) {
      logger.error('Business provisioning failed', { businessId: pendingBusiness.id, schemaName, error });
      await this.dropPartialTenantSchema(schemaName);
      throw error;
    }
  }

  private static async buildTenantSchema(schemaName: string) {
    await ensureTenantSchema(schemaName);

    if (!(await businessRepo.tenantSchemaExists(schemaName))) {
      throw new Error(`Tenant schema '${schemaName}' was not created`);
    }

    await migrateTenantSchema(schemaName);
    await seedTenantDefaults(schemaName);
    logger.info('Tenant schema built', { schemaName });
  }

  private static async activateBusinessForAdmin(pendingBusiness: Business, adminUserId: number) {
    const adminUser = await userRepo.updateUser(adminUserId, {
      businessId: pendingBusiness.id,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    // Sessions issued before the user belonged to a business carry no business or tenant claims.
    await refreshTokenRepo.revokeAllUserTokens(adminUserId);

    const activeBusiness = await businessRepo.updateBusiness(pendingBusiness.id, {
      provisioningStatus: BusinessProvisioningStatus.ACTIVE,
      provisionedAt: new Date(),
    });

    // Fire-and-forget: a notification failure must not fail signup itself.
    void sendBusinessSignupNotification(activeBusiness, { name: adminUser.name, email: adminUser.email });

    return activeBusiness;
  }

  /** Removes a business whose provisioning failed so its slug can be used again right away. */
  private static async discardFailedBusiness(business: Business) {
    try {
      await businessRepo.hardDeleteBusiness(business.id);
      logger.info('Failed business discarded', { businessId: business.id });
    } catch (deleteError) {
      // A soft-delete still blocks nothing: findBusinessBySlug skips isDeleted rows.
      logger.warn('Could not hard-delete failed business, falling back to soft-delete', {
        businessId: business.id,
        deleteError,
      });
      await businessRepo.updateBusiness(business.id, {
        provisioningStatus: BusinessProvisioningStatus.FAILED,
        isDeleted: true,
      });
    }
  }

  private static async dropPartialTenantSchema(schemaName: string) {
    try {
      await dropTenantSchema(schemaName);
      logger.info('Partial tenant schema dropped', { schemaName });
    } catch (dropError) {
      logger.warn('Failed to drop tenant schema during provisioning cleanup', { schemaName, dropError });
    }
  }

  static async getBusinessById(id: number) {
    const business = await businessRepo.findBusinessById(id);
    if (!business) {
      throw new NotFoundError('Business not found');
    }
    return business;
  }

  static async getBusinessBySlug(slug: string) {
    const business = await businessRepo.findBusinessBySlug(slug);
    if (!business) {
      throw new NotFoundError('Business not found');
    }
    return business;
  }

  static async checkSlugExists(slug: string) {
    const business = await businessRepo.findBusinessBySlug(slug);
    return Boolean(business);
  }

  static async updateBusiness(id: number, data: businessRepo.BusinessUpdateInput) {
    const existing = await businessRepo.findBusinessById(id);
    if (!existing) throw new NotFoundError('Business not found');

    const nextSlug = typeof data.slug === 'string' ? data.slug.trim() : undefined;
    const slugChanged = Boolean(nextSlug && nextSlug !== existing.slug);

    if (slugChanged) {
      const slugTaken = await businessRepo.findBusinessBySlug(nextSlug!);
      if (slugTaken) {
        throw new AlreadyExistsError(`Slug '${nextSlug}' is already taken`);
      }
    }

    const nextSchema = slugChanged ? normalizeTenantSchemaName(nextSlug!) : existing.schemaName;
    if (slugChanged && !existing.schemaName) {
      throw new BadRequestError('Slug changes require a provisioned tenant schema');
    }
    if (slugChanged && existing.schemaName && nextSchema) {
      await renameTenantSchema(existing.schemaName, nextSchema);
      if (existing.slug) {
        await businessRepo.createSlugHistory(existing.id, existing.slug);
      }
    }

    return businessRepo.updateBusiness(id, {
      ...data,
      ...(nextSlug ? { slug: nextSlug } : {}),
      ...(nextSchema ? { schemaName: nextSchema } : {}),
    });
  }

  static async deleteBusiness(id: number) {
    const business = await businessRepo.findBusinessById(id);
    if (!business) {
      throw new NotFoundError('Business not found');
    }

    return businessRepo.updateBusiness(id, {
      isDeleted: true,
      archivedAt: new Date(),
      provisioningStatus: BusinessProvisioningStatus.ARCHIVED,
    });
  }
}
