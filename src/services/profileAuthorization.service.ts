import { UserRole } from '@prisma/client';
import { IUser } from '../dtos/auth.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/api.errors';
import * as userRepo from '../repositories/user.repo';
import logger from '../utils/logger';

export const ACCESS_LEVEL = {
    READ: 'read',
    WRITE: 'write',
    CREATE: 'create',
} as const;

export type AccessLevel = typeof ACCESS_LEVEL[keyof typeof ACCESS_LEVEL];

/**
 * Centralized authorization service for profile management (Student, Teacher, etc.)
 */
export class ProfileAuthorizationService {
    /**
     * Validate user authorization based on access level.
     * - READ/WRITE: SUPERADMIN, same-business ADMIN, or profile owner
     * - CREATE: ADMIN/SUPERADMIN only (ADMIN must belong to the business)
     */
    static validateAccess(
        user: IUser,
        businessId: number,
        level: AccessLevel = ACCESS_LEVEL.READ,
        userId?: number,
    ): void {
        if (level === ACCESS_LEVEL.CREATE) {
            return this.checkCreationAccess(user, businessId);
        }
        return this.checkProfileAccess(user, businessId, level, userId);
    }

    /**
     * Shared check for READ and WRITE: SUPERADMIN, same-business ADMIN, or profile owner.
     */
    private static checkProfileAccess(
        user: IUser,
        businessId: number,
        level: AccessLevel,
        userId?: number,
    ): void {
        const allowed =
            user.role === UserRole.SUPERADMIN ||
            (user.role === UserRole.ADMIN && user.businessId === businessId) ||
            (userId !== undefined && user.id === userId);

        if (allowed) return;

        logger.warn(`Access denied: Insufficient permissions for ${level} access`, {
            userId: user.id,
            userRole: user.role,
            targetBusinessId: businessId,
        });

        throw new ForbiddenError(
            level === ACCESS_LEVEL.WRITE
                ? 'You do not have permission to update this profile'
                : 'You do not have access to this profile',
        );
    }

    /**
     * CREATE access: only ADMIN/SUPERADMIN; ADMIN must belong to the target business.
     */
    private static checkCreationAccess(user: IUser, businessId: number): void {
        if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
            logger.warn('Access denied: Insufficient role for profile creation', {
                userId: user.id,
                userRole: user.role,
            });
            throw new ForbiddenError('Only administrators can create profiles');
        }

        if (user.role === UserRole.ADMIN && user.businessId !== businessId) {
            logger.warn('Access denied: Admin cannot access this business', {
                userId: user.id,
                userBusinessId: user.businessId,
                targetBusinessId: businessId,
            });
            throw new ForbiddenError('You do not have access to this business');
        }
    }

    /**
     * Validate that a user exists and belongs to the specified business.
     * @throws NotFoundError if user not found
     * @throws BadRequestError if user doesn't belong to business
     */
    static async validateUserBelongsToBusiness(userId: number, businessId: number): Promise<void> {
        const targetUser = await userRepo.findPublicById(userId);
        if (!targetUser) {
            logger.warn('Validation failed: User not found', { userId });
            throw new NotFoundError('User not found');
        }

        if (targetUser.businessId !== businessId) {
            logger.warn('Validation failed: User does not belong to business', {
                userId,
                userBusinessId: targetUser.businessId,
                targetBusinessId: businessId,
            });
            throw new BadRequestError('User does not belong to the specified business');
        }
    }

    /**
     * Ensure a profile does not already exist for the given user.
     * @throws BadRequestError if profile already exists
     */
    static ensureProfileDoesNotExist(
        existingProfile: { id: unknown } | null | undefined,
        userId: number,
        profileType: string,
    ): void {
        if (existingProfile) {
            logger.warn(`Validation failed: ${profileType} profile already exists`, {
                userId,
                profileId: existingProfile.id,
            });
            throw new BadRequestError(`${profileType} profile already exists for this user`);
        }
    }
}
