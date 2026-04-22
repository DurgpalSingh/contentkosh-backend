import { UserRole } from '@prisma/client';
import { IUser } from '../dtos/auth.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import * as userRepo from '../repositories/user.repo';
import logger from '../utils/logger';

type AccessLevel = 'read' | 'write' | 'create';

/**
 * Centralized authorization service for profile management (Student, Teacher, etc.)
 * Handles all common authorization and validation logic to avoid code duplication
 */
export class ProfileAuthorizationService {
    /**
     * Validate user authorization based on access level
     * - read: SUPERADMIN, same business, or owner
     * - write: ADMIN/SUPERADMIN, same business, or owner
     * - create: ADMIN/SUPERADMIN only (with business check)
     * @throws ForbiddenError if user doesn't have permission
     */
    static validateAccess(
        user: IUser,
        businessId: number,
        level: AccessLevel = 'read',
        userId?: number
    ): void {
        switch (level) {
            case 'create':
                return this.checkCreationAccess(user, businessId);
            case 'write':
                return this.checkWriteAccess(user, businessId, userId);
            case 'read':
                return this.checkReadAccess(user, businessId, userId);
        }
    }

    /**
     * Check read access: SUPERADMIN, same business, or profile owner
     */
    private static checkReadAccess(user: IUser, businessId: number, userId?: number): void {
        if (
            user.role === UserRole.SUPERADMIN ||
            (user.role === UserRole.ADMIN && user.businessId === businessId) ||
            (userId && user.id === userId)
        ) {
            return;
        }

        logger.warn('Access denied: Insufficient permissions for read access', {
            userId: user.id,
            userRole: user.role,
            targetBusinessId: businessId
        });
        throw new ForbiddenError('You do not have access to this profile');
    }

    /**
     * Check write access: ADMIN/SUPERADMIN, same business, or profile owner
     */
    private static checkWriteAccess(user: IUser, businessId: number, userId?: number): void {
        if (
            user.role === UserRole.SUPERADMIN ||
            (user.role === UserRole.ADMIN && user.businessId === businessId) ||
            (userId && user.id === userId)
        ) {
            return;
        }

        logger.warn('Access denied: Insufficient permissions for write access', {
            userId: user.id,
            userRole: user.role,
            targetBusinessId: businessId
        });
        throw new ForbiddenError('You do not have permission to update this profile');
    }

    /**
     * Check creation access: Only ADMIN/SUPERADMIN, and ADMIN must belong to business
     */
    private static checkCreationAccess(user: IUser, businessId: number): void {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
            logger.warn('Access denied: Insufficient role for profile creation', {
                userId: user.id,
                userRole: user.role
            });
            throw new ForbiddenError('Only administrators can create profiles');
        }

        if (user.role === UserRole.ADMIN && user.businessId !== businessId) {
            logger.warn('Access denied: Admin cannot access this business', {
                userId: user.id,
                userBusinessId: user.businessId,
                targetBusinessId: businessId
            });
            throw new ForbiddenError('You do not have access to this business');
        }
    }

    /**
     * Validate that user exists and belongs to specified business
     * Used during profile creation to verify target user
     * @throws NotFoundError if user not found
     * @throws BadRequestError if user doesn't belong to business
     */
    static async validateUserBelongsToBusiness(
        userId: number,
        businessId: number
    ): Promise<void> {
        const targetUser = await userRepo.findPublicById(userId);
        if (!targetUser) {
            logger.warn('Validation failed: User not found', { userId });
            throw new NotFoundError('User not found');
        }

        if (targetUser.businessId !== businessId) {
            logger.warn('Validation failed: User does not belong to business', {
                userId,
                userBusinessId: targetUser.businessId,
                targetBusinessId: businessId
            });
            throw new BadRequestError('User does not belong to the specified business');
        }
    }

    /**
     * Validate that a profile doesn't already exist
     * @throws BadRequestError if profile already exists
     */
    static ensureProfileDoesNotExist(
        existingProfile: any,
        userId: number,
        profileType: string
    ): void {
        if (existingProfile) {
            logger.warn(`Validation failed: ${profileType} profile already exists`, {
                userId,
                profileId: existingProfile.id
            });
            throw new BadRequestError(`${profileType} profile already exists for this user`);
        }
    }
}
