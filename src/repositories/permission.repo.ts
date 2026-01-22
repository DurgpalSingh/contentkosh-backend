import { prisma } from '../config/database';

export const findAllPermissions = async () => {
    // Potentially filter system permissions if they can be soft deleted, but usually this is for user assignment
    return prisma.permission.findMany();
};

export const findPermissionsByCodes = async (codes: string[]) => {
    return prisma.permission.findMany({
        where: {
            code: { in: codes },
        },
    });
};

export const findUserPermissions = async (userId: number) => {
    return prisma.rolePermission.findMany({
        where: {
            userId,
            isDeleted: false // Filter out soft-deleted permissions
        },
        include: {
            permission: true,
        },
    });
};

export const assignUserPermissions = async (userId: number, permissionIds: number[]) => {
    // We use upsert to handle both new assignments and "reviving" soft-deleted ones
    return prisma.$transaction(
        permissionIds.map((permissionId) =>
            prisma.rolePermission.upsert({
                where: {
                    userId_permissionId: {
                        userId,
                        permissionId,
                    },
                },
                update: {
                    isDeleted: false, // Revive if it exists (even if was soft deleted)
                },
                create: {
                    userId,
                    permissionId,
                    isDeleted: false,
                },
            })
        )
    );
};

export const removeUserPermissions = async (userId: number, permissionIds?: number[]) => {
    if (permissionIds && permissionIds.length > 0) {
        return prisma.rolePermission.updateMany({
            where: {
                userId,
                permissionId: { in: permissionIds },
            },
            data: {
                isDeleted: true,
            },
        });
    } else {
        return prisma.rolePermission.updateMany({
            where: { userId },
            data: {
                isDeleted: true,
            },
        });
    }
};

export const replaceUserPermissions = async (userId: number, permissionIds: number[]) => {
    return prisma.$transaction(async (tx) => {
        // Soft delete ALL existing permissions for the user
        await tx.rolePermission.updateMany({
            where: { userId },
            data: { isDeleted: true },
        });

        // Revive or create the new set of permissions
        for (const permissionId of permissionIds) {
            await tx.rolePermission.upsert({
                where: {
                    userId_permissionId: {
                        userId,
                        permissionId,
                    },
                },
                update: {
                    isDeleted: false,
                },
                create: {
                    userId,
                    permissionId,
                    isDeleted: false,
                },
            });
        }
    });
};
