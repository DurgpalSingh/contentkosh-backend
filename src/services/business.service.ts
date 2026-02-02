import { Prisma } from '@prisma/client';
import * as businessRepo from '../repositories/business.repo';
import * as userRepo from '../repositories/user.repo';
import { AlreadyExistsError, BadRequestError, NotFoundError } from '../errors/api.errors';

export class BusinessService {

    static async createBusiness(data: Prisma.BusinessCreateInput, userId: number) {
        // Validation: Check if slug is taken
        if (data.slug) {
            const existingSlug = await businessRepo.findBusinessBySlug(data.slug);
            if (existingSlug) {
                throw new AlreadyExistsError(`Business with slug '${data.slug}' already exists`);
            }
        } else {
            throw new BadRequestError('Slug is required');
        }

        // Create Business
        const business = await businessRepo.createBusiness(data);

        // Update User to be associated with this business (Owner)
        await userRepo.updateUser(userId, { businessId: business.id });

        return business;
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

    static async updateBusiness(id: number, data: Prisma.BusinessUpdateInput) {
        // Check existence
        const existing = await businessRepo.findBusinessById(id);
        if (!existing) throw new NotFoundError('Business not found');

        // Check slug uniqueness if changing slug
        if (data.slug && typeof data.slug === 'string' && data.slug !== existing.slug) {
            const slugTaken = await businessRepo.findBusinessBySlug(data.slug);
            if (slugTaken) {
                throw new AlreadyExistsError(`Slug '${data.slug}' is already taken`);
            }
        }

        return await businessRepo.updateBusiness(id, data);
    }

    static async deleteBusiness(id: number) {
        const business = await businessRepo.findBusinessById(id);
        if (!business) {
            throw new NotFoundError('Business not found');
        }
        await businessRepo.deleteBusiness(id);
    }
}
