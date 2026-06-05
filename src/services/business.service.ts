import { UserRole, UserStatus, BusinessProvisioningStatus } from '@prisma/client';
import * as businessRepo from '../repositories/business.repo';
import * as userRepo from '../repositories/user.repo';
import { AlreadyExistsError, BadRequestError, NotFoundError } from '../errors/api.errors';
import { prisma, publicPrisma } from '../config/database';
import logger from '../utils/logger';
import {
  ensureTenantSchema,
  migrateTenantSchema,
  normalizeTenantSchemaName,
  renameTenantSchema,
  dropTenantSchema,
  seedTenantDefaults,
} from './tenantProvisioning.service';

export class BusinessService {
  static async createBusiness(data: businessRepo.BusinessCreateInput, userId: number) {
    if (!data.slug) {
      throw new BadRequestError('Slug is required');
    }

    const normalizedSlug = data.slug.trim();
    const schemaName = normalizeTenantSchemaName(normalizedSlug);

    // Check for an existing active business with this slug
    const existingSlug = await businessRepo.findBusinessBySlug(normalizedSlug);
    if (existingSlug) {
      throw new AlreadyExistsError(`Business with slug '${normalizedSlug}' already exists`);
    }

    const business = await businessRepo.createBusiness({
      ...data,
      slug: normalizedSlug,
      schemaName,
      provisioningStatus: BusinessProvisioningStatus.PENDING,
      isDeleted: false,
    });

    try {
      // 1) Create the schema
      await ensureTenantSchema(schemaName);

      // 1.a) Verify schema creation at DB level
      const schemaRows: Array<{ schema_name: string }> = (await publicPrisma.$queryRaw`
        SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schemaName}
      `) as any;
      if (!schemaRows || schemaRows.length === 0) {
        throw new Error(`Tenant schema '${schemaName}' was not created`);
      }

      // 2) Apply migrations (if present)
      try {
        await migrateTenantSchema(schemaName);
      } catch (migErr) {
        logger.error('Tenant migration failed', { schemaName, error: migErr });
        throw migErr;
      }

      // 3) Seed tenant defaults (permissions, roles, etc.)
      try {
        await seedTenantDefaults(schemaName);
      } catch (seedErr) {
        logger.error('Tenant seeding failed', { schemaName, error: seedErr });
        throw seedErr;
      }

      // 4) Link the creating user's public-schema row to this business
      await userRepo.updateUser(userId, {
        businessId: business.id,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });

      return await businessRepo.updateBusiness(business.id, {
        provisioningStatus: BusinessProvisioningStatus.ACTIVE,
        provisionedAt: new Date(),
      });
    } catch (error) {
      logger.error('Business provisioning failed', { businessId: business.id, schemaName, error });

      // Hard-delete the FAILED business record so the slug is immediately available for retry.
      // A soft-delete (isDeleted: true) would still block re-registration since findBusinessBySlug
      // only filters isDeleted=false — but the user would see the same slug rejected on retry.
      try {
        await publicPrisma.business.delete({ where: { id: business.id } });
      } catch (deleteErr) {
        // Fall back to soft-delete if hard-delete fails (e.g. FK constraints from partial data)
        logger.warn('Could not hard-delete FAILED business record, falling back to soft-delete', {
          businessId: business.id,
          deleteErr,
        });
        await businessRepo.updateBusiness(business.id, {
          provisioningStatus: BusinessProvisioningStatus.FAILED,
          isDeleted: true,
        });
      }

      // Drop the partially-created tenant schema to allow clean re-provisioning.
      try {
        await dropTenantSchema(schemaName);
      } catch (dropErr) {
        logger.warn('Failed to drop tenant schema during provisioning cleanup', { schemaName, dropErr });
      }

      throw error;
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
        await prisma.businessSlugHistory.create({
          data: {
            businessId: existing.id,
            slug: existing.slug,
          },
        });
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
