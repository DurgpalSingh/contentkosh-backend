import * as permissionRepo from '../repositories/permission.repo';
import * as userRepo from '../repositories/user.repo';
import { AssignPermissionDto } from '../dtos/permission.dto';
import { NotFoundError, BadRequestError } from '../errors/api.errors';

export class PermissionService {
    async getAllPermissions() {
        return permissionRepo.findAll();
    }

    async getUserPermissions(userId: number) {
        // Verify user exists
        const user = await userRepo.findPublicById(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const rolePermissions = await permissionRepo.findUserPermissions(userId);

        return {
            user: {
                id: user.id,
                role: user.role,
            },
            permissions: rolePermissions.map((rp) => rp.permission.code),
        };
    }

    async assignPermissions(dto: AssignPermissionDto) {
        const { userId, permissions = [] } = dto;

        // Verify user exists
        const userExists = await userRepo.exists(userId);
        if (!userExists) {
            throw new NotFoundError('User not found');
        }

        // Get permission records to verify valid codes
        const permissionRecords = await permissionRepo.findByCodes(permissions);
        if (permissionRecords.length !== permissions.length) {
            throw new BadRequestError('Some permissions are invalid');
        }

        const permissionIds = permissionRecords.map(p => p.id);

        // Use repository to assign (skip duplicates)
        await permissionRepo.assignPermissions(userId, permissionIds);

        return this.getUserPermissions(userId);
    }

    async updatePermissions(dto: AssignPermissionDto) {
        const { userId, permissions = [] } = dto;

        const userExists = await userRepo.exists(userId);
        if (!userExists) {
            throw new NotFoundError('User not found');
        }

        const permissionRecords = await permissionRepo.findByCodes(permissions);
        if (permissionRecords.length !== permissions.length) {
            throw new BadRequestError('Some permissions are invalid');
        }

        const permissionIds = permissionRecords.map(p => p.id);

        // Replace all permissions
        await permissionRepo.replacePermissions(userId, permissionIds);

        return this.getUserPermissions(userId);
    }

    async deletePermissions(userId: number) {
        const userExists = await userRepo.exists(userId);
        if (!userExists) {
            throw new NotFoundError('User not found');
        }

        return await permissionRepo.removePermissions(userId);
    }

    async deleteSpecificPermissions(dto: AssignPermissionDto) {
        const { userId, permissions = [] } = dto;

        const userExists = await userRepo.exists(userId);
        if (!userExists) {
            throw new NotFoundError('User not found');
        }

        const permissionRecords = await permissionRepo.findByCodes(permissions);
        const idsToDelete = permissionRecords.map(p => p.id);

        await permissionRepo.removePermissions(userId, idsToDelete);

        return this.getUserPermissions(userId);
    }
}
