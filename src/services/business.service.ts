import { Business, UserRole, UserStatus, BusinessProvisioningStatus } from '@prisma/client';
import * as businessRepo from '../repositories/business.repo';
import * as userRepo from '../repositories/user.repo';
import * as refreshTokenRepo from '../repositories/refreshToken.repo';
import { AlreadyExistsError, BadRequestError, NotFoundError } from '../errors/api.errors';
import { prisma, publicPrisma } from '../config/database';
import { config } from '../config/config';
import { mailConfig } from '../config/mail.config';
import logger from '../utils/logger';
import { sendMail } from './mail.service';
import { CreateBusinessDto } from '../dtos/business.dto';
import { buildBusinessSignupEmailHtml, buildBusinessSignupEmailSubject } from '../templates/businessSignupEmail.template';
import {
  ensureTenantSchema,
  migrateTenantSchema,
  normalizeTenantSchemaName,
  renameTenantSchema,
  dropTenantSchema,
  seedTenantDefaults,
} from './tenantProvisioning.service';

async function notifyBusinessSignup(business: Business, admin: { name: string; email: string }): Promise<void> {
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
  } catch (error) {
    logger.error('Failed to send business signup notification email', { businessId: business.id, error });
  }
}

export class BusinessService {
  /** Maps the public CreateBusinessDto fields to the DB column names used by createBusiness. */
  static toCreateInput(dto: CreateBusinessDto): businessRepo.BusinessCreateInput {
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

  /** Registers the business row only; the tenant schema is built later by provisionBusiness. */
  static async createPendingBusiness(data: businessRepo.BusinessCreateInput) {
    if (!data.slug) {
      throw new BadRequestError('Slug is required');
    }

    const slug = data.slug.trim();
    await businessRepo.deleteAbandonedPendingBusinessBySlug(slug);
    if (await businessRepo.findBusinessBySlug(slug)) {
      throw new AlreadyExistsError(`Business with slug '${slug}' already exists`);
    }

    return businessRepo.createBusiness({
      ...data,
      slug,
      schemaName: normalizeTenantSchemaName(slug),
      provisioningStatus: BusinessProvisioningStatus.PENDING,
      isDeleted: false,
    });
  }

  static async createBusiness(data: businessRepo.BusinessCreateInput, userId: number) {
    const business = await this.createPendingBusiness(data);

    try {
      return await this.provisionBusiness(business, userId);
    } catch (error) {
      // Hard-delete the failed business so the slug is immediately available for retry. A
      // soft-delete would still block it, since findBusinessBySlug only skips isDeleted rows.
      try {
        await publicPrisma.business.delete({ where: { id: business.id } });
      } catch (deleteErr) {
        logger.warn('Could not hard-delete FAILED business record, falling back to soft-delete', {
          businessId: business.id,
          deleteErr,
        });
        await businessRepo.updateBusiness(business.id, {
          provisioningStatus: BusinessProvisioningStatus.FAILED,
          isDeleted: true,
        });
      }
      throw error;
    }
  }

  /**
   * Builds the tenant schema for a pending business and makes `userId` its admin. On failure the
   * partial schema is dropped and the business stays pending, so the caller decides whether to retry.
   */
  static async provisionBusiness(business: Business, userId: number) {
    const { schemaName } = business;
    if (!schemaName) {
      throw new BadRequestError('Business has no tenant schema name');
    }

    try {
      await ensureTenantSchema(schemaName);

      const schemaRows: Array<{ schema_name: string }> = (await publicPrisma.$queryRaw`
        SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schemaName}
      `) as any;
      if (!schemaRows || schemaRows.length === 0) {
        throw new Error(`Tenant schema '${schemaName}' was not created`);
      }

      await migrateTenantSchema(schemaName);
      await seedTenantDefaults(schemaName);

      const adminUser = await userRepo.updateUser(userId, {
        businessId: business.id,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });
      await refreshTokenRepo.revokeAllUserTokens(userId);

      const activeBusiness = await businessRepo.updateBusiness(business.id, {
        provisioningStatus: BusinessProvisioningStatus.ACTIVE,
        provisionedAt: new Date(),
      });

      // Fire-and-forget: a notification failure must not fail signup itself.
      void notifyBusinessSignup(activeBusiness, { name: adminUser.name, email: adminUser.email });

      return activeBusiness;
    } catch (error) {
      logger.error('Business provisioning failed', { businessId: business.id, schemaName, error });

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
