import { UserRole, UserStatus } from '@prisma/client';
import * as userRepo from '../repositories/user.repo';
import * as businessRepo from '../repositories/business.repo';
import { NotFoundError, AlreadyExistsError, ForbiddenError } from '../errors/api.errors';
import { IUser } from '../dtos/auth.dto';
import { CreateUserDto, UpdateUserDto } from '../dtos/user.dto';
import { AuthService } from './auth.service';

export const createUserForBusiness = async (businessId: number, userData: CreateUserDto) => {
    // Verify business exists
    const business = await businessRepo.findBusinessById(businessId);
    if (!business) {
        throw new NotFoundError('Business not found');
    }

    try {
        // Build create object, only including mobile if defined
        const createData: {
            name: string;
            email: string;
            password: string;
            role: UserRole;
            businessId: number;
            status: UserStatus;
            mobile?: string;
        } = {
            name: userData.name,
            email: userData.email,
            password: await AuthService.hashPassword(userData.password),
            role: userData.role,
            businessId,
            status: UserStatus.ACTIVE
        };
        if (userData.mobile !== undefined) createData.mobile = userData.mobile;

        const newUser = await userRepo.createUser(createData);
        return newUser;
    } catch (error: any) {
        if (error.message === 'EMAIL_ALREADY_EXISTS') {
            throw new AlreadyExistsError('User with this email already exists');
        }
        if (error.message === 'MOBILE_ALREADY_EXISTS') {
            throw new AlreadyExistsError('User with this mobile already exists');
        }
        throw error;
    }
};

export const getUsersByBusiness = async (businessId: number, role?: UserRole) => {
    // Verify business exists
    const business = await businessRepo.findBusinessById(businessId);
    if (!business) {
        throw new NotFoundError('Business not found');
    }

    const users = await userRepo.findByBusinessId(businessId, role);
    return users;
};

export const updateUser = async (userId: number, userData: UpdateUserDto) => {
    // Check if user exists
    const exists = await userRepo.exists(userId);
    if (!exists) {
        throw new NotFoundError('User not found');
    }

    // Build update object, only including defined properties
    const updateData: { name?: string; mobile?: string; role?: UserRole; status?: UserStatus } = {};
    if (userData.name !== undefined) updateData.name = userData.name;
    if (userData.mobile !== undefined) updateData.mobile = userData.mobile;
    if (userData.role !== undefined) updateData.role = userData.role;
    if (userData.status !== undefined) updateData.status = userData.status;

    const updatedUser = await userRepo.updateUser(userId, updateData);
    return updatedUser;
};

export const deleteUser = async (userId: number) => {
    const exists = await userRepo.exists(userId);
    if (!exists) {
        throw new NotFoundError('User not found');
    }

    await userRepo.softDeleteUser(userId);
};

export const validateUserAccess = async (targetUserId: number, requestingUser: IUser): Promise<void> => {
    const targetUser = await userRepo.findPublicById(targetUserId);
    if (!targetUser) {
        throw new NotFoundError('User not found');
    }

    const isSuperAdmin = requestingUser.role === UserRole.SUPERADMIN;
    const hasBusinessAccess = targetUser.businessId === requestingUser.businessId;

    if (!isSuperAdmin && !hasBusinessAccess) {
        throw new ForbiddenError('You do not have access to this user');
    }
};
